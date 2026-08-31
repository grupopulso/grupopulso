"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  createAdminClient,
} from "@/app/lib/supabase/admin";

import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  addDays,
  addMonthsClamped,
  diffInDays,
} from "@/app/lib/date-utils";

export type RenewalPrefill = {
  sourceContractId: string;
  clientId: string;
  companyId: string;
  productId: string | null;
  title: string;
  value: number;
  billingFrequency: string;
  paymentMethodId: string | null;
  installments: number;
  autoRenew: boolean;
  notes: string;
  startDate: string;
  endDate: string;
  firstDueDate: string;
};

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
   * Escopo de empresa: busca o contrato e confirma que o
   * usuário tem acesso à empresa dele antes de excluir
   * (permissão "contracts.delete" sozinha permitia excluir
   * contrato de qualquer empresa só sabendo o id).
   */

  const {
    data: contractScope,
    error:
      contractScopeError,
  } = await supabase
    .from(
      "contracts"
    )
    .select(`
      id,
      company_id
    `)
    .eq(
      "id",
      contractId
    )
    .maybeSingle();

  if (
    contractScopeError ||
    !contractScope
  ) {
    return {
      success: false,
      error:
        "Contrato não encontrado.",
    };
  }

  await requireCompanyAccess(
    contractScope.company_id
  );

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


/*
 * =====================================================
 * RENOVAR CONTRATO
 * =====================================================
 *
 * O fluxo de renovação agora abre o formulário de contrato
 * já pré-preenchido (/contratos/[id]/renovar). O usuário
 * pode ajustar valor, produto, responsável (é sempre quem
 * está criando), datas e parcelas antes de confirmar.
 *
 * getRenewalPrefill() monta os dados sugeridos e aplica as
 * travas (permissão, escopo de empresa, contrato cancelado,
 * contrato já renovado, vigência inconsistente).
 *
 * linkRenewalContracts() é chamado após a criação para
 * registrar no contrato original a referência ao novo
 * contrato (o novo já nasce com a referência ao antigo
 * embutida em `notes`).
 *
 * O vínculo entre os dois contratos vive apenas no campo
 * `notes` de cada um (sem coluna nova no banco).
 */

export async function getRenewalPrefill(
  contractId: string
): Promise<
  | { success: true; prefill: RenewalPrefill }
  | {
      success: false;
      error: string;
      alreadyRenewedId?: string;
    }
> {
  await requireModulePermission(
    "contracts",
    "create"
  );

  /*
   * Prefill de renovação: leitura via service role para
   * não depender de o vendedor ter o módulo financeiro /
   * `contracts.view` amplo. O escopo de empresa é checado
   * abaixo com `requireCompanyAccess`.
   */
  const supabase = createAdminClient();

  if (!contractId) {
    return {
      success: false,
      error: "Contrato inválido.",
    };
  }

  const {
    data: oldContract,
    error: contractError,
  } = await supabase
    .from("contracts")
    .select(`
      id,
      client_id,
      company_id,
      product_id,
      title,
      start_date,
      end_date,
      value,
      billing_frequency,
      status,
      auto_renew,
      payment_method_id,
      installments,
      first_due_date,
      notes
    `)
    .eq("id", contractId)
    .maybeSingle();

  if (contractError || !oldContract) {
    return {
      success: false,
      error: "Contrato não encontrado.",
    };
  }

  await requireCompanyAccess(
    oldContract.company_id
  );

  if (oldContract.status === "cancelled") {
    return {
      success: false,
      error:
        "Um contrato cancelado não pode ser renovado.",
    };
  }

  /*
   * "Já renovado" = existe OUTRO contrato que nasceu como
   * renovação DESTE (as notas dele contêm exatamente
   * "Renovação do contrato <id>").
   *
   * Não basta procurar o id nas notas: o contrato de origem
   * também passa a citar o id do novo contrato ("Renovado ...
   * pelo contrato <novo>"), o que fazia o novo contrato ser
   * tratado como "já renovado" apontando de volta para o
   * antigo.
   */
  const { data: existingRenewal } =
    await supabase
      .from("contracts")
      .select("id")
      .neq("id", contractId)
      .ilike(
        "notes",
        `%Renovação do contrato ${contractId}%`
      )
      .maybeSingle();

  if (existingRenewal) {
    return {
      success: false,
      error:
        "Este contrato já foi renovado anteriormente.",
      alreadyRenewedId: existingRenewal.id,
    };
  }

  if (
    oldContract.end_date &&
    oldContract.end_date <=
      oldContract.start_date
  ) {
    return {
      success: false,
      error: `A vigência deste contrato está inconsistente (fim ${oldContract.end_date} não é depois do início ${oldContract.start_date}). Corrija a data de término em "Editar contrato" antes de renovar.`,
    };
  }

  /*
   * Nova vigência: replica a duração da atual a partir do
   * dia seguinte ao término. Sem data de término, usa a
   * última parcela gerada (ou o 1º vencimento / início) e
   * a mesma quantidade de parcelas em meses.
   */

  let newStartDate: string;
  let newEndDate: string;

  if (oldContract.end_date) {
    const durationDays = diffInDays(
      oldContract.start_date,
      oldContract.end_date
    );

    newStartDate = addDays(
      oldContract.end_date,
      1
    );

    newEndDate = addDays(
      newStartDate,
      durationDays
    );
  } else {
    const { data: lastInstallment } =
      await supabase
        .from("contract_installments")
        .select("due_date")
        .eq("contract_id", contractId)
        .order("due_date", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    const baseDate =
      lastInstallment?.due_date ??
      oldContract.first_due_date ??
      oldContract.start_date;

    newStartDate = addDays(baseDate, 1);

    newEndDate = addMonthsClamped(
      newStartDate,
      Math.max(
        oldContract.installments - 1,
        0
      )
    );
  }

  const baseNotes = (oldContract.notes ?? "").trim();

  const prefillNotes = [
    baseNotes,
    `Renovação do contrato ${oldContract.id}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    success: true,
    prefill: {
      sourceContractId: oldContract.id,
      clientId: oldContract.client_id,
      companyId: oldContract.company_id,
      productId: oldContract.product_id,
      title: oldContract.title,
      value: Number(oldContract.value),
      billingFrequency:
        oldContract.billing_frequency,
      paymentMethodId:
        oldContract.payment_method_id,
      installments:
        oldContract.installments,
      autoRenew: oldContract.auto_renew,
      notes: prefillNotes,
      startDate: newStartDate,
      endDate: newEndDate,
      firstDueDate: newStartDate,
    },
  };
}

export async function linkRenewalContracts(
  oldContractId: string,
  newContractId: string
) {
  await requireModulePermission(
    "contracts",
    "create"
  );

  /*
   * Registro do vínculo de renovação no contrato antigo:
   * update via service role (o vendedor pode não ter
   * `contracts.edit`). Escopo de empresa checado abaixo.
   */
  const supabase = createAdminClient();

  if (!oldContractId || !newContractId) {
    return {
      success: false,
      error: "Contratos inválidos.",
    };
  }

  const {
    data: oldContract,
    error: oldError,
  } = await supabase
    .from("contracts")
    .select("id, company_id, notes")
    .eq("id", oldContractId)
    .maybeSingle();

  if (oldError || !oldContract) {
    return {
      success: false,
      error:
        "Contrato original não encontrado.",
    };
  }

  await requireCompanyAccess(
    oldContract.company_id
  );

  const alreadyLinked = (
    oldContract.notes ?? ""
  ).includes(newContractId);

  if (!alreadyLinked) {
    const updatedNotes = [
      (oldContract.notes ?? "").trim(),
      `Renovado em ${todayString()} pelo contrato ${newContractId}.`,
    ]
      .filter(Boolean)
      .join(" ");

    const { error: updateError } =
      await supabase
        .from("contracts")
        .update({ notes: updatedNotes })
        .eq("id", oldContractId);

    if (updateError) {
      console.error(
        "Erro ao registrar referência de renovação no contrato original:",
        updateError
      );
    }
  }

  revalidatePath("/contratos");
  revalidatePath(
    `/contratos/${oldContractId}`
  );
  revalidatePath(
    `/contratos/${newContractId}`
  );
  revalidatePath("/assinaturas");

  return { success: true };
}

/*
 * =====================================================
 * UTILITÁRIOS DE DATA
 * =====================================================
 */

function todayString() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}