"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/app/lib/supabase/admin";
import { fetchAllRows } from "@/app/lib/fetch-all";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

type Failure = {
  success: false;
  error: string;
};

export async function createProspectingList(input: {
  companyId: string;
  name: string;
}): Promise<
  | { success: true; listId: string }
  | Failure
> {
  const access =
    await requireModulePermission(
      "prospecting",
      "create"
    );

  await requireCompanyAccess(
    input.companyId
  );

  const name = input.name.trim();

  if (!name) {
    return {
      success: false,
      error:
        "Informe o nome da lista.",
    };
  }

  const adminDb = createAdminClient();

  const { data, error } =
    await adminDb
      .from("prospecting_lists")
      .insert({
        company_id: input.companyId,
        name,
        created_by:
          access.user.id,
      })
      .select("id")
      .single();

  if (error || !data) {
    console.error(
      "Erro ao criar lista de prospecção:",
      error
    );

    return {
      success: false,
      error:
        error?.message ??
        "Não foi possível criar a lista.",
    };
  }

  revalidatePath(
    `/prospeccao/${input.companyId}`
  );

  return {
    success: true,
    listId: data.id,
  };
}

export async function deleteProspectingList(
  companyId: string,
  listId: string
): Promise<{ success: true } | Failure> {
  await requireModulePermission(
    "prospecting",
    "delete"
  );

  await requireCompanyAccess(
    companyId
  );

  const adminDb = createAdminClient();

  const { error } = await adminDb
    .from("prospecting_lists")
    .delete()
    .eq("id", listId)
    .eq("company_id", companyId);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath(
    `/prospeccao/${companyId}`
  );

  return { success: true };
}

/*
 * Duplica um caderno (ex.: o especial de Natal deste ano vira o
 * do ano que vem). Mantém todos os clientes e vendedores; os que
 * FECHARAM ficam como estão (pra saber o que foi vendido), e o
 * resto (contato feito, não quis, sem contato) volta zerado —
 * "Sem contato", sem valor, tamanho ou cobrança.
 */
export async function duplicateProspectingList(input: {
  companyId: string;
  listId: string;
  name: string;
}): Promise<
  | { success: true; listId: string; count: number }
  | Failure
> {
  const access =
    await requireModulePermission(
      "prospecting",
      "create"
    );

  await requireCompanyAccess(
    input.companyId
  );

  const name = input.name.trim();

  if (!name) {
    return {
      success: false,
      error: "Informe o nome do novo caderno.",
    };
  }

  const adminDb = createAdminClient();

  const { data: source } = await adminDb
    .from("prospecting_lists")
    .select("id")
    .eq("id", input.listId)
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (!source) {
    return {
      success: false,
      error: "Caderno não encontrado.",
    };
  }

  type LeadRow = {
    client_name: string;
    seller_user_id: string | null;
    value: number | null;
    size: string | null;
    status: string;
    billing_note: string | null;
    kind?: string | null;
  };

  const loadLeads = (columns: string) =>
    fetchAllRows<LeadRow>((from, to) =>
      adminDb
        .from("prospecting_leads")
        .select(columns)
        .eq("list_id", input.listId)
        .order("created_at")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{
        data: LeadRow[] | null;
        error: { message: string } | null;
      }>
    );

  /*
   * A coluna `kind` (Telão/TV) pode não existir ainda
   * (MIGRACOES_PENDENTES.md) — cai na leitura sem ela.
   */
  let leadsResult = await loadLeads(
    "client_name, seller_user_id, value, size, status, billing_note, kind"
  );

  let hasKind = true;

  if (leadsResult.error) {
    hasKind = false;

    leadsResult = await loadLeads(
      "client_name, seller_user_id, value, size, status, billing_note"
    );
  }

  if (leadsResult.error) {
    return {
      success: false,
      error: "Não foi possível ler o caderno original.",
    };
  }

  const { data: list, error: listError } =
    await adminDb
      .from("prospecting_lists")
      .insert({
        company_id: input.companyId,
        name,
        created_by: access.user.id,
      })
      .select("id")
      .single();

  if (listError || !list) {
    return {
      success: false,
      error:
        listError?.message ??
        "Não foi possível criar o caderno.",
    };
  }

  const rows = leadsResult.data.map((lead) => {
    const closed = lead.status === "closed";

    return {
      list_id: list.id,
      client_name: lead.client_name,
      seller_user_id: lead.seller_user_id,
      value: closed ? lead.value : null,
      size: closed ? lead.size : null,
      status: closed ? "closed" : "none",
      billing_note: closed ? lead.billing_note : null,
      ...(hasKind && lead.kind
        ? { kind: lead.kind }
        : {}),
    };
  });

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await adminDb
      .from("prospecting_leads")
      .insert(rows.slice(i, i + 500));

    if (error) {
      console.error(
        "Erro ao duplicar caderno de prospecção:",
        error
      );

      await adminDb
        .from("prospecting_lists")
        .delete()
        .eq("id", list.id);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  revalidatePath(
    `/prospeccao/${input.companyId}`
  );

  return {
    success: true,
    listId: list.id,
    count: rows.length,
  };
}
