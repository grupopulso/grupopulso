"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

export async function deleteContract(
  contractId: string
) {
  await requireModulePermission(
    "contracts",
    "delete"
  );

  const supabase =
    await createClient();

  if (!contractId) {
    return {
      success: false,
      error:
        "Contrato inválido.",
    };
  }

  /*
   * Verificar se existem
   * movimentações financeiras
   * efetivamente pagas/recebidas.
   */

  const {
    data: entries,
    error: entriesError,
  } = await supabase
    .from(
      "financial_entries"
    )
    .select(`
      id,
      amount_paid
    `)
    .eq(
      "contract_id",
      contractId
    );

  if (entriesError) {
    return {
      success: false,
      error:
        entriesError.message,
    };
  }

  const hasPayments =
    (entries ?? []).some(
      (entry) =>
        Number(
          entry.amount_paid
        ) > 0
    );

  if (hasPayments) {
    return {
      success: false,
      error:
        "Este contrato possui pagamentos ou recebimentos registrados e não pode ser excluído. Cancele o contrato para preservar o histórico financeiro.",
    };
  }

  /*
   * Excluir parcelas primeiro.
   */

  const {
    error:
      installmentsError,
  } = await supabase
    .from(
      "contract_installments"
    )
    .delete()
    .eq(
      "contract_id",
      contractId
    );

  if (
    installmentsError
  ) {
    return {
      success: false,
      error:
        installmentsError.message,
    };
  }

  /*
   * Excluir lançamentos
   * financeiros ainda não pagos.
   */

  const {
    error:
      financialError,
  } = await supabase
    .from(
      "financial_entries"
    )
    .delete()
    .eq(
      "contract_id",
      contractId
    );

  if (
    financialError
  ) {
    return {
      success: false,
      error:
        financialError.message,
    };
  }

  /*
   * Excluir contrato.
   */

  const {
    error:
      contractError,
  } = await supabase
    .from(
      "contracts"
    )
    .delete()
    .eq(
      "id",
      contractId
    );

  if (
    contractError
  ) {
    return {
      success: false,
      error:
        contractError.message,
    };
  }

  revalidatePath(
    "/contratos"
  );

  revalidatePath(
    "/financeiro"
  );

  return {
    success: true,
  };
}