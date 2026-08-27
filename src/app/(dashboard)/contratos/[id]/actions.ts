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
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  createContract,
} from "../novo/actions";

import {
  addDays,
  addMonthsClamped,
  diffInDays,
} from "@/app/lib/date-utils";

type CreateContractInput =
  Parameters<
    typeof createContract
  >[0];

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
 * Cria um contrato novo a partir dos dados do atual,
 * com a mesma duração de vigência, começando no dia
 * seguinte ao término do contrato original (ou hoje,
 * se ele não tiver data de término).
 *
 * O contrato original NÃO é apagado nem tem o status
 * alterado manualmente — como o status já é calculado
 * dinamicamente pelas datas (@/app/lib/contract-status),
 * ele passa a aparecer como "Vencido" sozinho assim que
 * a vigência antiga expira.
 *
 * O vínculo entre os dois contratos é registrado apenas
 * no campo `notes` de cada um (sem coluna nova no banco).
 */

export async function renewContract(
  contractId: string
) {
  await requireModulePermission(
    "contracts",
    "create"
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

  const {
    data: oldContract,
    error: contractError,
  } = await supabase
    .from(
      "contracts"
    )
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
    .eq(
      "id",
      contractId
    )
    .maybeSingle();

  if (
    contractError ||
    !oldContract
  ) {
    return {
      success: false,
      error:
        "Contrato não encontrado.",
    };
  }

  /*
   * Escopo de empresa: só renova contrato de empresa à
   * qual o usuário tem acesso (admin sempre passa).
   */
  await requireCompanyAccess(
    oldContract.company_id
  );

  if (
    oldContract.status ===
    "cancelled"
  ) {
    return {
      success: false,
      error:
        "Um contrato cancelado não pode ser renovado.",
    };
  }

  /*
   * Evita renovar duas vezes o mesmo contrato:
   * verifica se já existe outro contrato cujas
   * observações referenciam este.
   */

  const {
    data: existingRenewal,
  } = await supabase
    .from(
      "contracts"
    )
    .select(
      "id"
    )
    .neq(
      "id",
      contractId
    )
    .ilike(
      "notes",
      `%${contractId}%`
    )
    .maybeSingle();

  if (
    existingRenewal
  ) {
    return {
      success: false,
      error:
        "Este contrato já foi renovado anteriormente.",
    };
  }

  /*
   * Nova vigência: baseada no "Fim da vigência"
   * (end_date) do contrato atual, que é o campo
   * que representa a vigência comercial real —
   * confirmado com o usuário em 27/08. A duração
   * da nova vigência replica a duração da atual
   * (fim − início).
   *
   * Se `end_date` vier inconsistente (fim antes ou
   * igual ao início — problema já visto em contratos
   * com digitação errada), a renovação é recusada com
   * um erro claro em vez de gerar uma data sem sentido.
   *
   * Se o contrato não tiver `end_date` (vigência em
   * aberto), usa a última parcela realmente gerada
   * como base, com a mesma quantidade de parcelas em
   * meses — mesma regra usada para gerar as parcelas
   * originais.
   */

  if (
    oldContract.end_date &&
    oldContract.end_date <=
      oldContract.start_date
  ) {
    return {
      success: false,
      error:
        `A vigência deste contrato está inconsistente (fim ${oldContract.end_date} não é depois do início ${oldContract.start_date}). Corrija a data de término em "Editar contrato" antes de renovar.`,
    };
  }

  let newStartDate: string;
  let newEndDate: string;

  if (
    oldContract.end_date
  ) {
    const durationDays =
      diffInDays(
        oldContract.start_date,
        oldContract.end_date
      );

    newStartDate =
      addDays(
        oldContract.end_date,
        1
      );

    newEndDate =
      addDays(
        newStartDate,
        durationDays
      );
  } else {
    const {
      data: lastInstallment,
    } = await supabase
      .from(
        "contract_installments"
      )
      .select(
        "due_date"
      )
      .eq(
        "contract_id",
        contractId
      )
      .order(
        "due_date",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    const baseDate =
      lastInstallment?.due_date ??
      oldContract.first_due_date ??
      oldContract.start_date;

    newStartDate =
      addDays(
        baseDate,
        1
      );

    newEndDate =
      addMonthsClamped(
        newStartDate,
        Math.max(
          oldContract.installments -
            1,
          0
        )
      );
  }

  const newFirstDueDate =
    newStartDate;

  const result =
    await createContract({
      clientId:
        oldContract.client_id,

      companyId:
        oldContract.company_id,

      productId:
        oldContract.product_id,

      title:
        oldContract.title,

      startDate:
        newStartDate,

      endDate:
        newEndDate,

      value: Number(
        oldContract.value
      ),

      billingFrequency:
        oldContract.billing_frequency as CreateContractInput["billingFrequency"],

      paymentMethodId:
        oldContract.payment_method_id,

      installments:
        oldContract.installments,

      firstDueDate:
        newFirstDueDate,

      autoRenew:
        oldContract.auto_renew,

      notes: [
        oldContract.notes,
        `Renovação do contrato ${oldContract.id}.`,
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        ),
    });

  if (
    !result.success ||
    !result.contractId
  ) {
    return result;
  }

  /*
   * Referencia a renovação no
   * contrato original, sem apagar
   * nada do que já existia.
   */

  const updatedNotes = [
    oldContract.notes,
    `Renovado em ${todayString()} pelo contrato ${result.contractId}.`,
  ]
    .filter(
      Boolean
    )
    .join(
      " "
    );

  const {
    error: updateError,
  } = await supabase
    .from(
      "contracts"
    )
    .update({
      notes:
        updatedNotes,
    })
    .eq(
      "id",
      contractId
    );

  if (
    updateError
  ) {
    console.error(
      "Erro ao registrar referência de renovação no contrato original:",
      updateError
    );
  }

  revalidatePath(
    "/contratos"
  );

  revalidatePath(
    `/contratos/${contractId}`
  );

  revalidatePath(
    `/contratos/${result.contractId}`
  );

  revalidatePath(
    "/assinaturas"
  );

  revalidatePath(
    `/clientes/${oldContract.client_id}`
  );

  return result;
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