"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminClient,
} from "@/app/lib/supabase/admin";

import {
  requireCompanyAccess,
  requireFinancialEntryAccess,
} from "@/app/lib/permissions";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/*
 * Marca várias receitas de uma vez como "cobrança enviada"
 * (boleto/cobrança mandado pro cliente) ou "nota fiscal
 * emitida" — os mesmos campos do formulário de cada
 * lançamento, sem precisar abrir um por um.
 */
export async function markChargesDocumentStatus(
  entryIds: string[],
  input: {
    field: "charge" | "invoice";
    date: string;
  }
) {
  await requireFinancialEntryAccess(
    "income",
    "edit"
  );

  const ids = Array.from(new Set(entryIds));

  if (ids.length === 0 || ids.length > 200) {
    return {
      success: false as const,
      message:
        "Selecione de 1 a 200 lançamentos.",
    };
  }

  if (
    input.field !== "charge" &&
    input.field !== "invoice"
  ) {
    return {
      success: false as const,
      message: "Ação inválida.",
    };
  }

  if (!DATE_ONLY_PATTERN.test(input.date)) {
    return {
      success: false as const,
      message: "Informe uma data válida.",
    };
  }

  /*
   * Service role (mesmo motivo de document-actions.ts: a RLS
   * de financial_entries bloqueia quem só tem Contas a
   * Receber). Permissão checada acima; empresa checada abaixo.
   */
  const adminDb = createAdminClient();

  const { data: entries } = await adminDb
    .from("financial_entries")
    .select("id, type, company_id")
    .in("id", ids);

  if (!entries || entries.length !== ids.length) {
    return {
      success: false as const,
      message:
        "Algum lançamento não foi encontrado. Atualize a página e tente de novo.",
    };
  }

  if (
    entries.some(
      (entry) => entry.type !== "income"
    )
  ) {
    return {
      success: false as const,
      message:
        "Cobrança e nota fiscal valem só para receitas.",
    };
  }

  for (const companyId of new Set(
    entries.map((entry) => entry.company_id)
  )) {
    await requireCompanyAccess(companyId);
  }

  const update =
    input.field === "charge"
      ? {
          charge_sent: true,
          charge_sent_at: `${input.date}T12:00:00`,
        }
      : {
          invoice_issued: true,
          invoice_issued_at: input.date,
        };

  const { error } = await adminDb
    .from("financial_entries")
    .update({
      ...update,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (error) {
    console.error(
      "Erro ao marcar cobrança/NF em lote:",
      error
    );

    return {
      success: false as const,
      message: error.message,
    };
  }

  revalidatePath("/financeiro/cobrancas");
  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro/notas-fiscais");

  return {
    success: true as const,
    count: ids.length,
  };
}
