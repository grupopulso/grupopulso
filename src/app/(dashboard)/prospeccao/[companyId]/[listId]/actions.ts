"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

type Failure = {
  success: false;
  error: string;
};

const VALID_STATUSES = [
  "none",
  "contacted",
  "closed",
  "declined",
] as const;

type LeadInput = {
  companyId: string;
  listId: string;
  clientName: string;
  sellerUserId?: string | null;
  value?: number | null;
  size?: string | null;
  status: string;
  billingNote?: string | null;

  /*
   * undefined = não mexe na coluna (tela sem o campo Tipo, ou
   * coluna ainda não criada no banco); "" / null = limpa.
   */
  kind?: string | null;
};

const VALID_KINDS = ["telao", "tv"];

function validateLead(input: LeadInput) {
  if (!input.clientName.trim()) {
    return "Informe o nome do cliente.";
  }

  if (
    input.kind &&
    !VALID_KINDS.includes(input.kind)
  ) {
    return "Tipo inválido.";
  }

  if (
    !VALID_STATUSES.includes(
      input.status as (typeof VALID_STATUSES)[number]
    )
  ) {
    return "Situação inválida.";
  }

  return null;
}

export async function createProspectingLead(
  input: LeadInput
): Promise<
  | { success: true; leadId: string }
  | Failure
> {
  await requireModulePermission(
    "prospecting",
    "create"
  );

  await requireCompanyAccess(
    input.companyId
  );

  const validationError =
    validateLead(input);

  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }

  const adminDb = createAdminClient();

  const { data, error } =
    await adminDb
      .from("prospecting_leads")
      .insert({
        list_id: input.listId,
        client_name:
          input.clientName.trim(),
        seller_user_id:
          input.sellerUserId ||
          null,
        value:
          input.value ?? null,
        size:
          input.size?.trim() ||
          null,
        status: input.status,
        billing_note:
          input.billingNote?.trim() ||
          null,
        ...(input.kind
          ? { kind: input.kind }
          : {}),
      })
      .select("id")
      .single();

  if (error || !data) {
    console.error(
      "Erro ao criar prospecção:",
      error
    );

    return {
      success: false,
      error:
        error?.message ??
        "Não foi possível adicionar o cliente.",
    };
  }

  revalidatePath(
    `/prospeccao/${input.companyId}/${input.listId}`
  );

  return {
    success: true,
    leadId: data.id,
  };
}

export async function updateProspectingLead(
  leadId: string,
  input: LeadInput
): Promise<{ success: true } | Failure> {
  await requireModulePermission(
    "prospecting",
    "edit"
  );

  await requireCompanyAccess(
    input.companyId
  );

  const validationError =
    validateLead(input);

  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }

  const adminDb = createAdminClient();

  const { error } = await adminDb
    .from("prospecting_leads")
    .update({
      client_name:
        input.clientName.trim(),
      seller_user_id:
        input.sellerUserId || null,
      value: input.value ?? null,
      size:
        input.size?.trim() || null,
      status: input.status,
      billing_note:
        input.billingNote?.trim() ||
        null,
      ...(input.kind !== undefined
        ? { kind: input.kind || null }
        : {}),
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("list_id", input.listId);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath(
    `/prospeccao/${input.companyId}/${input.listId}`
  );

  return { success: true };
}

export async function deleteProspectingLead(
  companyId: string,
  listId: string,
  leadId: string
): Promise<{ success: true } | Failure> {
  await requireModulePermission(
    "prospecting",
    "delete"
  );

  await requireCompanyAccess(companyId);

  const adminDb = createAdminClient();

  const { error } = await adminDb
    .from("prospecting_leads")
    .delete()
    .eq("id", leadId)
    .eq("list_id", listId);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath(
    `/prospeccao/${companyId}/${listId}`
  );

  return { success: true };
}

export type BulkClearFields = {
  seller: boolean;
  value: boolean;
  size: boolean;
  status: boolean;
  billingNote: boolean;
};

const BULK_CHUNK = 200;

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }

  return out;
}

/*
 * Limpa de uma vez os dados das linhas marcadas (ex.: caderno
 * duplicado pro ano seguinte): vendedor, valor, tamanho,
 * situação ("Sem contato") e observações — o nome do cliente
 * fica.
 */
export async function bulkClearProspectingLeads(
  companyId: string,
  listId: string,
  leadIds: string[],
  fields: BulkClearFields
): Promise<
  { success: true; count: number } | Failure
> {
  await requireModulePermission(
    "prospecting",
    "edit"
  );

  await requireCompanyAccess(companyId);

  const ids = Array.from(new Set(leadIds));

  if (ids.length === 0) {
    return {
      success: false,
      error: "Selecione pelo menos uma linha.",
    };
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (fields.seller) update.seller_user_id = null;
  if (fields.value) update.value = null;
  if (fields.size) update.size = null;
  if (fields.status) update.status = "none";
  if (fields.billingNote) update.billing_note = null;

  if (Object.keys(update).length === 1) {
    return {
      success: false,
      error: "Marque o que deve ser apagado.",
    };
  }

  const adminDb = createAdminClient();

  for (const part of chunk(ids, BULK_CHUNK)) {
    const { error } = await adminDb
      .from("prospecting_leads")
      .update(update)
      .eq("list_id", listId)
      .in("id", part);

    if (error) {
      revalidatePath(
        `/prospeccao/${companyId}/${listId}`
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  revalidatePath(
    `/prospeccao/${companyId}/${listId}`
  );
  revalidatePath(`/prospeccao/${companyId}`);

  return { success: true, count: ids.length };
}
