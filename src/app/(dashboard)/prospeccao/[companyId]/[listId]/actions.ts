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
};

function validateLead(input: LeadInput) {
  if (!input.clientName.trim()) {
    return "Informe o nome do cliente.";
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
