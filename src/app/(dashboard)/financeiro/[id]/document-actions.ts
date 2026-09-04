"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireFinancialEntryAccess,
} from "@/app/lib/permissions";

type Input = {
  invoiceIssued: boolean;

  invoiceNumber:
    | string
    | null;

  invoiceIssuedAt:
    | string
    | null;

  chargeSent: boolean;

  chargeSentAt:
    | string
    | null;
};

export async function updateFinancialDocumentStatus(
  entryId: string,
  input: Input
) {
  /*
   * Nota fiscal e cobrança só existem em lançamentos de
   * receita (checado abaixo) — usa o mesmo critério de acesso
   * da página (financial OU accounts_receivable/receipts),
   * não só o módulo geral "financial". Quem só tem "Contas a
   * Receber" (sem o módulo financeiro geral) já consegue ver
   * esse formulário e precisa também conseguir salvá-lo.
   */
  await requireFinancialEntryAccess(
    "income",
    "edit"
  );

  const supabase =
    await createClient();

  if (!entryId) {
    return {
      success: false,
      error:
        "Lançamento inválido.",
    };
  }

  /*
   * Confirma que o lançamento
   * existe e é uma receita.
   */

  const {
    data: entry,
    error:
      entryError,
  } =
    await supabase
      .from(
        "financial_entries"
      )
      .select(`
        id,
        type
      `)
      .eq(
        "id",
        entryId
      )
      .maybeSingle();

  if (
    entryError ||
    !entry
  ) {
    return {
      success: false,
      error:
        "Lançamento não encontrado.",
    };
  }

  if (
    entry.type !==
    "income"
  ) {
    return {
      success: false,
      error:
        "Nota fiscal e cobrança são controladas apenas em contas a receber.",
    };
  }

  /*
   * Validações simples.
   */

  if (
    input.invoiceIssued &&
    !input.invoiceIssuedAt
  ) {
    return {
      success: false,
      error:
        "Informe a data de emissão da nota fiscal.",
    };
  }

  if (
    input.chargeSent &&
    !input.chargeSentAt
  ) {
    return {
      success: false,
      error:
        "Informe a data de envio da cobrança.",
    };
  }

  const {
    error,
  } =
    await supabase
      .from(
        "financial_entries"
      )
      .update({
        invoice_issued:
          input.invoiceIssued,

        invoice_number:
          input.invoiceIssued
            ? input.invoiceNumber
                ?.trim() ||
              null
            : null,

        invoice_issued_at:
          input.invoiceIssued
            ? input.invoiceIssuedAt
            : null,

        charge_sent:
          input.chargeSent,

        charge_sent_at:
          input.chargeSent &&
          input.chargeSentAt
            ? `${input.chargeSentAt}T12:00:00`
            : null,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        entryId
      );

  if (error) {
    console.error(
      "Erro ao atualizar NF/cobrança:",
      error
    );

    return {
      success: false,
      error:
        error.message,
    };
  }

  revalidatePath(
    `/financeiro/${entryId}`
  );

  revalidatePath(
    "/financeiro"
  );

  revalidatePath(
    "/financeiro/receber"
  );

  revalidatePath(
    "/financeiro/recebimentos"
  );

  return {
    success: true,
  };
}