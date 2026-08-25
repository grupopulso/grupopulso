"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

/*
 * =====================================================
 * REGISTRAR MOVIMENTAÇÃO FINANCEIRA
 * =====================================================
 */

export async function registerFinancialTransaction(
  entryId: string,
  input: {
    amount: number;
    date: string;
    paymentMethod: string;
    financialAccountId: string;
    notes?: string;
  }
) {
  await requireModulePermission(
    "financial",
    "edit"
  );

  const supabase =
    await createClient();

  /*
   * =====================================================
   * LANÇAMENTO
   * =====================================================
   */

  const {
    data: entry,
    error: entryError,
  } =
    await supabase
      .from(
        "financial_entries"
      )
      .select(`
        id,
        company_id,
        type,
        description,
        amount,
        amount_paid,
        interest,
        fine,
        discount,
        status
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
      message:
        "Lançamento não encontrado.",
    };
  }

  /*
   * =====================================================
   * VALIDAÇÕES BÁSICAS
   * =====================================================
   */

  const total =
    Number(
      entry.amount
    ) +
    Number(
      entry.interest
    ) +
    Number(
      entry.fine
    ) -
    Number(
      entry.discount
    );

  const currentPaid =
    Number(
      entry.amount_paid
    );

  const openAmount =
    Math.max(
      total -
        currentPaid,
      0
    );

  if (
    !Number.isFinite(
      input.amount
    ) ||
    input.amount <= 0 ||
    input.amount >
      openAmount
  ) {
    return {
      success: false,
      message:
        "Valor inválido para o saldo em aberto.",
    };
  }

  if (
    !input.date
  ) {
    return {
      success: false,
      message:
        "Informe a data da movimentação.",
    };
  }

  if (
    !input.financialAccountId
  ) {
    return {
      success: false,

      message:
        entry.type ===
        "income"
          ? "Selecione a conta que recebeu o valor."
          : "Selecione a conta utilizada para o pagamento.",
    };
  }

  /*
   * =====================================================
   * FORMA DE PAGAMENTO
   * =====================================================
   */

  const {
    data: method,
    error: methodError,
  } =
    await supabase
      .from(
        "financial_payment_methods"
      )
      .select(`
        id,
        name,
        code,
        usage_type,
        active
      `)
      .eq(
        "code",
        input.paymentMethod
      )
      .maybeSingle();

  if (
    methodError ||
    !method ||
    !method.active
  ) {
    return {
      success: false,
      message:
        "Forma de pagamento inválida ou inativa.",
    };
  }

  const compatible =
    method.usage_type ===
      "both" ||
    method.usage_type ===
      entry.type;

  if (
    !compatible
  ) {
    return {
      success: false,
      message:
        "Esta forma não é compatível com o tipo do lançamento.",
    };
  }

  /*
   * =====================================================
   * CONTA FINANCEIRA
   * =====================================================
   */

  const {
    data: account,
    error: accountError,
  } =
    await supabase
      .from(
        "financial_accounts"
      )
      .select(`
        id,
        company_id,
        name,
        current_balance,
        active
      `)
      .eq(
        "id",
        input.financialAccountId
      )
      .maybeSingle();

  if (
    accountError ||
    !account ||
    !account.active
  ) {
    return {
      success: false,
      message:
        "Conta financeira inválida ou inativa.",
    };
  }

  if (
    account.company_id &&
    account.company_id !==
      entry.company_id
  ) {
    return {
      success: false,
      message:
        "A conta selecionada não pertence à empresa deste lançamento.",
    };
  }

  /*
   * =====================================================
   * OPERAÇÃO FINANCEIRA ATÔMICA
   * =====================================================
   *
   * PostgreSQL:
   *
   * 1. cria financial_transaction;
   * 2. atualiza amount_paid;
   * 3. atualiza status;
   * 4. altera saldo da conta.
   */

  const {
    data,
    error:
      transactionError,
  } =
    await supabase.rpc(
      "register_financial_transaction_atomic",
      {
        p_entry_id:
          entryId,

        p_financial_account_id:
          input.financialAccountId,

        p_amount:
          input.amount,

        p_transaction_date:
          input.date,

        p_payment_method:
          method.code,

        p_notes:
          input.notes
            ?.trim() ||
          null,
      }
    );

  if (
    transactionError
  ) {
    console.error(
      "Erro na baixa financeira:",
      transactionError
    );

    return {
      success: false,
      message:
        transactionError.message,
    };
  }

  const result =
    Array.isArray(
      data
    )
      ? data[0]
      : data;

  if (
    !result
  ) {
    return {
      success: false,
      message:
        "A movimentação não retornou resultado.",
    };
  }

  /*
   * =====================================================
   * VENDA / RECEBIMENTO
   * =====================================================
   *
   * Quando um cliente paga uma
   * parcela de publicidade:
   *
   * aumenta amount_released
   * das comissões vinculadas.
   */

  let saleInfo: {
    saleId: string;
    editionId: string;
  } | null =
    null;

  let saleCommissionWarning:
    string | null =
    null;

  if (
    entry.type ===
    "income"
  ) {
    const syncResult =
      await syncSaleCommissions(
        supabase,
        entryId
      );

    if (
      syncResult.saleId &&
      syncResult.editionId
    ) {
      saleInfo = {
        saleId:
          syncResult.saleId,

        editionId:
          syncResult.editionId,
      };
    }

    if (
      !syncResult.success
    ) {
      /*
       * A baixa financeira já
       * aconteceu.
       *
       * Portanto NÃO retornamos
       * success:false.
       */

      console.error(
        "Recebimento registrado, mas houve erro ao atualizar comissões:",
        syncResult.message
      );

      saleCommissionWarning =
        syncResult.message ??
        "Não foi possível atualizar as comissões da venda.";
    }
  }
  /*
 * =====================================================
 * COMISSÕES DE CONTRATO
 * =====================================================
 */

let contractCommissionInfo: {
  contractId: string;
} | null =
  null;

let contractCommissionWarning:
  string | null =
  null;

/*
 * =====================================================
 * SINCRONIZAR COMISSÕES DE CONTRATO
 * =====================================================
 */

async function syncContractCommissions(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  financialEntryId: string
): Promise<{
  success: boolean;
  message?: string;
  contractId?: string;
}> {
  /*
   * =====================================================
   * LOCALIZAR PARCELA
   * =====================================================
   */

  const {
    data:
      installmentLink,
    error:
      installmentError,
  } =
    await supabase
      .from(
        "contract_installments"
      )
      .select(`
        id,
        contract_id,
        financial_entry_id
      `)
      .eq(
        "financial_entry_id",
        financialEntryId
      )
      .maybeSingle();

  if (
    installmentError
  ) {
    return {
      success: false,
      message:
        "Não foi possível identificar se o recebimento pertence a um contrato.",
    };
  }

  /*
   * Não é parcela de contrato.
   */

  if (
    !installmentLink
  ) {
    return {
      success: true,
    };
  }

  /*
   * =====================================================
   * CONTRATO
   * =====================================================
   */

  const {
    data: contract,
    error:
      contractError,
  } =
    await supabase
      .from(
        "contracts"
      )
      .select(`
        id,
        value,
        status
      `)
      .eq(
        "id",
        installmentLink.contract_id
      )
      .maybeSingle();

  if (
    contractError ||
    !contract
  ) {
    return {
      success: false,
      message:
        "Contrato vinculado ao recebimento não encontrado.",
    };
  }

  const baseResult = {
    contractId:
      contract.id,
  };

  if (
    contract.status ===
    "cancelled"
  ) {
    return {
      success: true,
      ...baseResult,
    };
  }

  const contractValue =
    Number(
      contract.value ??
        0
    );

  if (
    !Number.isFinite(
      contractValue
    ) ||
    contractValue <=
      0
  ) {
    return {
      success: false,
      message:
        "O contrato possui valor inválido.",
      ...baseResult,
    };
  }

  /*
   * =====================================================
   * TODAS AS PARCELAS
   * =====================================================
   */

  const {
    data: installments,
    error:
      installmentsError,
  } =
    await supabase
      .from(
        "contract_installments"
      )
      .select(`
        id,
        amount,
        financial_entry_id
      `)
      .eq(
        "contract_id",
        contract.id
      );

  if (
    installmentsError
  ) {
    return {
      success: false,
      message:
        "Não foi possível consultar as parcelas do contrato.",
      ...baseResult,
    };
  }

  if (
    !installments?.length
  ) {
    return {
      success: false,
      message:
        "O contrato não possui parcelas financeiras vinculadas.",
      ...baseResult,
    };
  }

  const financialEntryIds =
    installments
      .map(
        (
          installment
        ) =>
          installment
            .financial_entry_id
      )
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            value
          )
      );

  if (
    !financialEntryIds.length
  ) {
    return {
      success: false,
      message:
        "As parcelas do contrato não possuem lançamentos financeiros vinculados.",
      ...baseResult,
    };
  }

  /*
   * =====================================================
   * LANÇAMENTOS FINANCEIROS
   * =====================================================
   */

  const {
    data:
      financialEntries,
    error:
      financialEntriesError,
  } =
    await supabase
      .from(
        "financial_entries"
      )
      .select(`
        id,
        amount,
        amount_paid,
        interest,
        fine,
        discount,
        status
      `)
      .in(
        "id",
        financialEntryIds
      );

  if (
    financialEntriesError
  ) {
    return {
      success: false,
      message:
        "Não foi possível calcular quanto do contrato já foi recebido.",
      ...baseResult,
    };
  }

  const entriesById =
    new Map(
      (
        financialEntries ??
        []
      ).map(
        (
          financialEntry
        ) => [
          financialEntry.id,
          financialEntry,
        ]
      )
    );

  /*
   * =====================================================
   * PRINCIPAL RECEBIDO
   * =====================================================
   *
   * Juros e multas não aumentam
   * a comissão.
   */

  const receivedPrincipal =
    roundMoney(
      installments.reduce(
        (
          total,
          installment
        ) => {
          if (
            !installment
              .financial_entry_id
          ) {
            return total;
          }

          const financialEntry =
            entriesById.get(
              installment
                .financial_entry_id
            );

          if (
            !financialEntry
          ) {
            return total;
          }

          const installmentAmount =
            Number(
              installment.amount ??
                0
            );

          const amountPaid =
            Number(
              financialEntry
                .amount_paid ??
                0
            );

          const principalReceived =
            Math.max(
              0,
              Math.min(
                amountPaid,
                installmentAmount
              )
            );

          return (
            total +
            principalReceived
          );
        },
        0
      )
    );

  /*
   * =====================================================
   * PROPORÇÃO RECEBIDA
   * =====================================================
   */

  const receivedRatio =
    Math.max(
      0,
      Math.min(
        receivedPrincipal /
          contractValue,
        1
      )
    );

  /*
   * =====================================================
   * COMISSÕES
   * =====================================================
   */

  const {
    data: commissions,
    error:
      commissionsError,
  } =
    await supabase
      .from(
        "contract_commissions"
      )
      .select(`
        id,
        amount,
        amount_released,
        amount_paid,
        paid_at,
        status
      `)
      .eq(
        "contract_id",
        contract.id
      );

  if (
    commissionsError
  ) {
    return {
      success: false,
      message:
        "Não foi possível consultar as comissões do contrato.",
      ...baseResult,
    };
  }

  /*
   * =====================================================
   * ATUALIZAR
   * =====================================================
   */

  for (
    const commission of
      commissions ??
      []
  ) {
    if (
      commission.status ===
      "cancelled"
    ) {
      continue;
    }

    const totalCommission =
      Number(
        commission.amount ??
          0
      );

    if (
      !Number.isFinite(
        totalCommission
      ) ||
      totalCommission <
        0
    ) {
      continue;
    }

    const releasedAmount =
      receivedRatio >=
      1
        ? totalCommission
        : roundMoney(
            totalCommission *
              receivedRatio
          );

    const alreadyPaid =
      Math.max(
        0,
        Number(
          commission
            .amount_paid ??
            0
        )
      );

    let commissionStatus:
      | "pending"
      | "generated"
      | "paid" =
      "pending";

    if (
      totalCommission >
        0 &&
      alreadyPaid >=
        totalCommission
    ) {
      commissionStatus =
        "paid";
    } else if (
      releasedAmount >
      0
    ) {
      commissionStatus =
        "generated";
    }

    const {
      error:
        updateError,
    } =
      await supabase
        .from(
          "contract_commissions"
        )
        .update({
          amount_released:
            releasedAmount,

          status:
            commissionStatus,

          paid_at:
            commissionStatus ===
            "paid"
              ? commission
                  .paid_at ??
                new Date()
                  .toISOString()
              : null,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          commission.id
        );

    if (
      updateError
    ) {
      console.error(
        "Erro ao atualizar comissão do contrato:",
        updateError
      );

      return {
        success: false,
        message:
          "O recebimento foi registrado, mas a comissão do contrato não pôde ser atualizada.",
        ...baseResult,
      };
    }
  }

  return {
    success: true,
    ...baseResult,
  };
}

if (
  entry.type ===
  "income"
) {
  const syncResult =
    await syncContractCommissions(
      supabase,
      entryId
    );

  if (
    syncResult.contractId
  ) {
    contractCommissionInfo = {
      contractId:
        syncResult.contractId,
    };
  }

  if (
    !syncResult.success
  ) {
    console.error(
      "Recebimento registrado, mas houve erro ao atualizar comissão do contrato:",
      syncResult.message
    );

    contractCommissionWarning =
      syncResult.message ??
      "Não foi possível atualizar a comissão do contrato.";
  }
}

  /*
   * =====================================================
   * PAGAMENTO DE COMISSÃO
   * =====================================================
   *
   * Quando uma despesa vinculada
   * à comissão é efetivamente paga:
   *
   * aumenta amount_paid
   * da comissão.
   */

 let commissionPaymentInfo: {
  commissionId: string;

  originType?:
    | "sale"
    | "contract";

  saleId?: string;

  editionId?: string;

  contractId?: string;
} | null =
  null;

  let commissionPaymentWarning:
    string | null =
    null;

  if (
    entry.type ===
    "expense"
  ) {
    const syncResult =
      await syncCommissionPayment(
        supabase,
        entryId
      );

    if (
      syncResult.commissionId
    ) {
      commissionPaymentInfo = {
        commissionId:
          syncResult.commissionId,

        saleId:
          syncResult.saleId,

        editionId:
          syncResult.editionId,
      };
    }

    if (
      !syncResult.success
    ) {
      /*
       * O pagamento financeiro já
       * aconteceu.
       *
       * Não retornamos erro para
       * evitar uma segunda baixa.
       */

      console.error(
        "Pagamento registrado, mas houve erro ao atualizar comissão:",
        syncResult.message
      );

      commissionPaymentWarning =
        syncResult.message ??
        "Não foi possível atualizar o pagamento da comissão.";
    }
  }

  /*
   * =====================================================
   * AUDITORIA
   * =====================================================
   */

  await createAuditLog({
    module:
      "financial",

    action:
      entry.type ===
      "income"
        ? "receipt"
        : "payment",

    entityType:
      "financial_entry",

    entityId:
      entryId,

    description:
      entry.type ===
      "income"
        ? `Recebimento de ${formatCurrency(
            input.amount
          )} registrado em ${entry.description}.`
        : `Pagamento de ${formatCurrency(
            input.amount
          )} registrado em ${entry.description}.`,

    oldData: {
      amount_paid:
        currentPaid,

      status:
        entry.status,

      account_balance:
        Number(
          account.current_balance
        ),
    },

    newData: {
      amount_paid:
        Number(
          result.new_amount_paid
        ),

      status:
        result.new_status,

      financial_account_id:
        account.id,

      financial_account_name:
        account.name,

      account_balance:
        Number(
          result.new_account_balance
        ),

      payment_method:
        method.code,

      payment_method_name:
        method.name,

      transaction_date:
        input.date,

      amount:
        input.amount,

      sale_commissions_updated:
        Boolean(
          saleInfo
        ),

      commission_payment_updated:
        Boolean(
          commissionPaymentInfo
        ),
    },
  });

  /*
   * =====================================================
   * REVALIDAR FINANCEIRO
   * =====================================================
   */

if (
  contractCommissionInfo
) {
  revalidatePath(
    "/contratos"
  );

  revalidatePath(
    `/contratos/${contractCommissionInfo.contractId}`
  );
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
    "/financeiro/pagar"
  );

  revalidatePath(
    "/financeiro/recebimentos"
  );

  revalidatePath(
    "/financeiro/pagamentos"
  );

  revalidatePath(
    "/financeiro/configuracoes/contas"
  );

  /*
   * =====================================================
   * REVALIDAR COMISSÕES
   * =====================================================
   */

  revalidatePath(
    "/comissoes"
  );

  /*
   * =====================================================
   * REVALIDAR VENDA
   * =====================================================
   */

  if (
    saleInfo
  ) {
    revalidatePath(
      "/edicoes"
    );

    revalidatePath(
      `/edicoes/${saleInfo.editionId}`
    );

    revalidatePath(
      `/edicoes/${saleInfo.editionId}/vendas/${saleInfo.saleId}`
    );
  }

  if (
    commissionPaymentInfo
      ?.saleId &&
    commissionPaymentInfo
      ?.editionId
  ) {
    revalidatePath(
      `/edicoes/${commissionPaymentInfo.editionId}`
    );

    revalidatePath(
      `/edicoes/${commissionPaymentInfo.editionId}/vendas/${commissionPaymentInfo.saleId}`
    );

    if (
  commissionPaymentInfo
    ?.contractId
) {
  revalidatePath(
    "/contratos"
  );

  revalidatePath(
    `/contratos/${commissionPaymentInfo.contractId}`
  );
}
  }

  const warning =
  saleCommissionWarning ??
  contractCommissionWarning ??
  commissionPaymentWarning ??
  null;

  return {
    success: true,

    newAmountPaid:
      Number(
        result.new_amount_paid
      ),

    newStatus:
      result.new_status,

    newAccountBalance:
      Number(
        result.new_account_balance
      ),

    commissionWarning:
      warning,
  };
}

/*
 * =====================================================
 * SINCRONIZAR COMISSÕES DA VENDA
 * =====================================================
 *
 * É chamado quando o cliente
 * paga uma conta a receber.
 *
 * Fluxo:
 *
 * financial_entry
 *      ↓
 * edition_sale_installments
 *      ↓
 * edition_sales
 *      ↓
 * total efetivamente recebido
 *      ↓
 * amount_released
 */

async function syncSaleCommissions(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  financialEntryId: string
): Promise<{
  success: boolean;
  message?: string;
  saleId?: string;
  editionId?: string;
}> {
  /*
   * =====================================================
   * LOCALIZAR PARCELA
   * =====================================================
   */

  const {
    data: installmentLink,
    error:
      installmentLinkError,
  } =
    await supabase
      .from(
        "edition_sale_installments"
      )
      .select(`
        id,
        sale_id,
        financial_entry_id
      `)
      .eq(
        "financial_entry_id",
        financialEntryId
      )
      .maybeSingle();

  if (
    installmentLinkError
  ) {
    return {
      success: false,
      message:
        "Não foi possível identificar se o recebimento pertence a uma venda de publicidade.",
    };
  }

  /*
   * Lançamento normal.
   */

  if (
    !installmentLink
  ) {
    return {
      success: true,
    };
  }

  /*
   * =====================================================
   * VENDA
   * =====================================================
   */

  const {
    data: sale,
    error: saleError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .select(`
        id,
        edition_id,
        total_amount,
        status
      `)
      .eq(
        "id",
        installmentLink.sale_id
      )
      .maybeSingle();

  if (
    saleError ||
    !sale
  ) {
    return {
      success: false,
      message:
        "A venda vinculada ao recebimento não foi encontrada.",
    };
  }

  const baseResult = {
    saleId:
      sale.id,

    editionId:
      sale.edition_id,
  };

  if (
    sale.status ===
    "cancelled"
  ) {
    return {
      success: true,
      ...baseResult,
    };
  }

  const saleTotal =
    Number(
      sale.total_amount
    );

  if (
    !Number.isFinite(
      saleTotal
    ) ||
    saleTotal <= 0
  ) {
    return {
      success: false,

      message:
        "A venda possui valor total inválido.",

      ...baseResult,
    };
  }

  /*
   * =====================================================
   * PARCELAS DA VENDA
   * =====================================================
   */

  const {
    data: installments,
    error:
      installmentsError,
  } =
    await supabase
      .from(
        "edition_sale_installments"
      )
      .select(`
        id,
        installment_number,
        amount,
        financial_entry_id
      `)
      .eq(
        "sale_id",
        sale.id
      );

  if (
    installmentsError
  ) {
    return {
      success: false,

      message:
        "Não foi possível consultar as parcelas da venda.",

      ...baseResult,
    };
  }

  if (
    !installments?.length
  ) {
    return {
      success: false,

      message:
        "A venda não possui parcelas financeiras vinculadas.",

      ...baseResult,
    };
  }

  const financialEntryIds =
    installments.map(
      (
        installment
      ) =>
        installment
          .financial_entry_id
    );

  /*
   * =====================================================
   * LANÇAMENTOS DAS PARCELAS
   * =====================================================
   */

  const {
    data:
      financialEntries,
    error:
      financialEntriesError,
  } =
    await supabase
      .from(
        "financial_entries"
      )
      .select(`
        id,
        amount,
        amount_paid,
        interest,
        fine,
        discount,
        status
      `)
      .in(
        "id",
        financialEntryIds
      );

  if (
    financialEntriesError
  ) {
    return {
      success: false,

      message:
        "Não foi possível calcular quanto da venda já foi recebido.",

      ...baseResult,
    };
  }

  const entriesById =
    new Map(
      (
        financialEntries ??
        []
      ).map(
        (
          financialEntry
        ) => [
          financialEntry.id,
          financialEntry,
        ]
      )
    );

  /*
   * =====================================================
   * PRINCIPAL RECEBIDO
   * =====================================================
   *
   * Comissão não incide sobre:
   *
   * - juros;
   * - multas.
   *
   * Cada parcela fica limitada
   * ao principal original dela.
   */

  const receivedPrincipal =
    roundMoney(
      installments.reduce(
        (
          totalReceived,
          installment
        ) => {
          const financialEntry =
            entriesById.get(
              installment
                .financial_entry_id
            );

          if (
            !financialEntry
          ) {
            return totalReceived;
          }

          const installmentAmount =
            Number(
              installment.amount
            );

          const amountPaid =
            Number(
              financialEntry.amount_paid ??
                0
            );

          const principalReceived =
            Math.max(
              0,
              Math.min(
                amountPaid,
                installmentAmount
              )
            );

          return (
            totalReceived +
            principalReceived
          );
        },
        0
      )
    );

  /*
   * =====================================================
   * PROPORÇÃO RECEBIDA
   * =====================================================
   */

  const receivedRatio =
    Math.max(
      0,
      Math.min(
        receivedPrincipal /
          saleTotal,
        1
      )
    );

  /*
   * =====================================================
   * COMISSÕES
   * =====================================================
   */

  const {
    data: commissions,
    error:
      commissionsError,
  } =
    await supabase
      .from(
        "sale_commissions"
      )
      .select(`
        id,
        commission_type,
        percentage,
        base_amount,
        amount,
        amount_released,
        amount_paid,
        paid_at,
        status
      `)
      .eq(
        "sale_id",
        sale.id
      );

  if (
    commissionsError
  ) {
    return {
      success: false,

      message:
        "Não foi possível consultar as comissões da venda.",

      ...baseResult,
    };
  }

  /*
   * =====================================================
   * ATUALIZAR COMISSÕES
   * =====================================================
   */

  for (
    const commission of
      commissions ??
      []
  ) {
    if (
      commission.status ===
      "cancelled"
    ) {
      continue;
    }

    const totalCommission =
      Number(
        commission.amount ??
          0
      );

    if (
      !Number.isFinite(
        totalCommission
      ) ||
      totalCommission <
        0
    ) {
      continue;
    }

    /*
     * Comissão liberada proporcional
     * ao principal recebido.
     */

    const releasedAmount =
      receivedRatio >= 1
        ? totalCommission
        : roundMoney(
            totalCommission *
              receivedRatio
          );

    /*
     * Quanto já foi efetivamente
     * pago ao beneficiário.
     */

    const alreadyPaid =
      Math.max(
        0,
        Number(
          commission
            .amount_paid ??
            0
        )
      );

    /*
     * STATUS
     *
     * pending:
     * nada liberado.
     *
     * generated:
     * existe valor liberado.
     *
     * paid:
     * a comissão total foi
     * efetivamente paga.
     */

    let commissionStatus:
      | "pending"
      | "generated"
      | "paid" =
      "pending";

    if (
      totalCommission >
        0 &&
      alreadyPaid >=
        totalCommission
    ) {
      commissionStatus =
        "paid";
    } else if (
      releasedAmount >
      0
    ) {
      commissionStatus =
        "generated";
    }

    const {
      error:
        commissionUpdateError,
    } =
      await supabase
        .from(
          "sale_commissions"
        )
        .update({
          amount_released:
            releasedAmount,

          status:
            commissionStatus,

          paid_at:
            commissionStatus ===
            "paid"
              ? commission
                  .paid_at ??
                new Date()
                  .toISOString()
              : null,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          commission.id
        );

    if (
      commissionUpdateError
    ) {
      console.error(
        "Erro ao atualizar comissão:",
        commissionUpdateError
      );

      return {
        success: false,

        message:
          "O recebimento foi registrado, mas uma comissão não pôde ser atualizada.",

        ...baseResult,
      };
    }
  }

  return {
    success: true,
    ...baseResult,
  };
}

/*
 * =====================================================
 * SINCRONIZAR PAGAMENTO DA COMISSÃO
 * =====================================================
 *
 * É chamado quando uma despesa
 * vinculada à comissão é paga.
 *
 * financial_entry
 *      ↓
 * sale_commissions
 *      ↓
 * calcula valor novo pago
 *      ↓
 * amount_paid
 */

/*
 * =====================================================
 * SINCRONIZAR PAGAMENTO DA COMISSÃO
 * =====================================================
 *
 * É chamado quando uma despesa
 * vinculada à comissão é paga.
 *
 * financial_entry
 *      ↓
 * commission_payments
 *      ↓
 * sale_commissions
 *      ↓
 * amount_paid acumulado
 */

/*
 * =====================================================
 * SINCRONIZAR PAGAMENTO DE COMISSÃO
 * =====================================================
 *
 * Detecta automaticamente se a despesa
 * pertence a:
 *
 * - comissão de venda
 * - comissão de contrato
 */

async function syncCommissionPayment(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  financialEntryId: string
): Promise<{
  success: boolean;
  message?: string;
  commissionId?: string;
  saleId?: string;
  editionId?: string;
  contractId?: string;
  originType?:
    | "sale"
    | "contract";
}> {
  /*
   * =====================================================
   * PRIMEIRO: TENTA COMISSÃO DE VENDA
   * =====================================================
   */

  const {
    data: salePayment,
    error:
      salePaymentError,
  } =
    await supabase
      .from(
        "commission_payments"
      )
      .select(`
        id,
        commission_id,
        financial_entry_id,
        amount,
        amount_applied,
        status
      `)
      .eq(
        "financial_entry_id",
        financialEntryId
      )
      .maybeSingle();

  if (
    salePaymentError
  ) {
    return {
      success: false,
      message:
        "Não foi possível verificar se o pagamento pertence a uma comissão de venda.",
    };
  }

  if (
    salePayment
  ) {
    return syncSaleCommissionPayment(
      supabase,
      financialEntryId,
      salePayment
    );
  }

  /*
   * =====================================================
   * DEPOIS: TENTA COMISSÃO DE CONTRATO
   * =====================================================
   */

  const {
    data:
      contractPayment,
    error:
      contractPaymentError,
  } =
    await supabase
      .from(
        "contract_commission_payments"
      )
      .select(`
        id,
        commission_id,
        financial_entry_id,
        amount,
        amount_applied,
        status
      `)
      .eq(
        "financial_entry_id",
        financialEntryId
      )
      .maybeSingle();

  if (
    contractPaymentError
  ) {
    return {
      success: false,
      message:
        "Não foi possível verificar se o pagamento pertence a uma comissão de contrato.",
    };
  }

  if (
    contractPayment
  ) {
    return syncContractCommissionPayment(
      supabase,
      financialEntryId,
      contractPayment
    );
  }

  /*
   * =====================================================
   * DESPESA NORMAL
   * =====================================================
   */

  return {
    success: true,
  };
}

/*
 * =====================================================
 * PAGAMENTO DE COMISSÃO DE VENDA
 * =====================================================
 */

async function syncSaleCommissionPayment(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  financialEntryId: string,
  commissionPayment: {
    id: string;
    commission_id: string;
    financial_entry_id: string;
    amount:
      | number
      | string;
    amount_applied:
      | number
      | string;
    status: string;
  }
): Promise<{
  success: boolean;
  message?: string;
  commissionId?: string;
  saleId?: string;
  editionId?: string;
  originType?:
    | "sale";
}> {
  /*
   * =====================================================
   * COMISSÃO
   * =====================================================
   */

  const {
    data: commission,
    error:
      commissionError,
  } =
    await supabase
      .from(
        "sale_commissions"
      )
      .select(`
        id,
        sale_id,
        amount,
        amount_released,
        amount_paid,
        status,

        sale:edition_sales (
          id,
          edition_id
        )
      `)
      .eq(
        "id",
        commissionPayment
          .commission_id
      )
      .maybeSingle();

  if (
    commissionError ||
    !commission
  ) {
    return {
      success: false,
      message:
        "Comissão de venda vinculada ao pagamento não encontrada.",
    };
  }

  const sale =
    getFirst(
      commission.sale
    );

  const baseResult = {
    commissionId:
      commission.id,

    saleId:
      sale?.id,

    editionId:
      sale?.edition_id,

    originType:
      "sale" as const,
  };

  if (
    commission.status ===
    "cancelled" ||
    commissionPayment.status ===
    "cancelled"
  ) {
    return {
      success: true,
      ...baseResult,
    };
  }

  /*
   * =====================================================
   * LANÇAMENTO FINANCEIRO
   * =====================================================
   */

  const financialEntryResult =
    await getCommissionFinancialEntry(
      supabase,
      financialEntryId
    );

  if (
    !financialEntryResult.success
  ) {
    return {
      ...financialEntryResult,
      ...baseResult,
    };
  }

  const {
    financialEntry,
  } =
    financialEntryResult;

  const paymentAmount =
    Math.max(
      0,
      Number(
        commissionPayment.amount ??
          0
      )
    );

  const paidOnThisPayment =
    Math.min(
      Math.max(
        0,
        Number(
          financialEntry
            .amount_paid ??
            0
        )
      ),
      paymentAmount
    );

  const previouslyApplied =
    Math.max(
      0,
      Number(
        commissionPayment
          .amount_applied ??
          0
      )
    );

  const paymentDelta =
    Math.max(
      roundMoney(
        paidOnThisPayment -
          previouslyApplied
      ),
      0
    );

  const totalCommission =
    Math.max(
      0,
      Number(
        commission.amount ??
          0
      )
    );

  const releasedCommission =
    Math.max(
      0,
      Math.min(
        Number(
          commission
            .amount_released ??
            0
        ),
        totalCommission
      )
    );

  const currentCommissionPaid =
    Math.max(
      0,
      Math.min(
        Number(
          commission
            .amount_paid ??
            0
        ),
        totalCommission
      )
    );

  const availableToApply =
    Math.max(
      roundMoney(
        releasedCommission -
          currentCommissionPaid
      ),
      0
    );

  const applicableDelta =
    Math.min(
      paymentDelta,
      availableToApply
    );

  const newCommissionPaid =
    Math.min(
      roundMoney(
        currentCommissionPaid +
          applicableDelta
      ),
      releasedCommission,
      totalCommission
    );

  /*
   * =====================================================
   * STATUS DO PAGAMENTO
   * =====================================================
   */

  const paymentStatus =
    getPaymentStatus(
      paidOnThisPayment,
      paymentAmount
    );

  /*
   * =====================================================
   * STATUS DA COMISSÃO
   * =====================================================
   */

  const commissionFullyPaid =
    totalCommission >
      0 &&
    newCommissionPaid >=
      totalCommission;

  const newCommissionStatus:
    | "pending"
    | "generated"
    | "paid" =
    commissionFullyPaid
      ? "paid"
      : releasedCommission >
          0
        ? "generated"
        : "pending";

  /*
   * =====================================================
   * ATUALIZAR PAGAMENTO
   * =====================================================
   */

  const {
    error:
      updatePaymentError,
  } =
    await supabase
      .from(
        "commission_payments"
      )
      .update({
        amount_applied:
          paidOnThisPayment,

        status:
          paymentStatus,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        commissionPayment.id
      );

  if (
    updatePaymentError
  ) {
    return {
      success: false,

      message:
        "O financeiro foi atualizado, mas o pagamento da comissão de venda não pôde ser sincronizado.",

      ...baseResult,
    };
  }

  /*
   * =====================================================
   * ATUALIZAR COMISSÃO
   * =====================================================
   */

  const {
    error:
      updateCommissionError,
  } =
    await supabase
      .from(
        "sale_commissions"
      )
      .update({
        amount_paid:
          newCommissionPaid,

        status:
          newCommissionStatus,

        paid_at:
          commissionFullyPaid
            ? new Date()
                .toISOString()
            : null,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        commission.id
      );

  if (
    updateCommissionError
  ) {
    return {
      success: false,

      message:
        "O pagamento foi registrado, mas a comissão de venda não pôde ser atualizada.",

      ...baseResult,
    };
  }

  return {
    success: true,
    ...baseResult,
  };
}

/*
 * =====================================================
 * PAGAMENTO DE COMISSÃO DE CONTRATO
 * =====================================================
 */

async function syncContractCommissionPayment(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  financialEntryId: string,
  commissionPayment: {
    id: string;
    commission_id: string;
    financial_entry_id: string;
    amount:
      | number
      | string;
    amount_applied:
      | number
      | string;
    status: string;
  }
): Promise<{
  success: boolean;
  message?: string;
  commissionId?: string;
  contractId?: string;
  originType?:
    | "contract";
}> {
  /*
   * =====================================================
   * COMISSÃO
   * =====================================================
   */

  const {
    data: commission,
    error:
      commissionError,
  } =
    await supabase
      .from(
        "contract_commissions"
      )
      .select(`
        id,
        contract_id,
        amount,
        amount_released,
        amount_paid,
        status,

        contract:contracts (
          id
        )
      `)
      .eq(
        "id",
        commissionPayment
          .commission_id
      )
      .maybeSingle();

  if (
    commissionError ||
    !commission
  ) {
    return {
      success: false,
      message:
        "Comissão de contrato vinculada ao pagamento não encontrada.",
    };
  }

  const contract =
    getFirst(
      commission.contract
    );

  const baseResult = {
    commissionId:
      commission.id,

    contractId:
      contract?.id ??
      commission.contract_id,

    originType:
      "contract" as const,
  };

  if (
    commission.status ===
    "cancelled" ||
    commissionPayment.status ===
    "cancelled"
  ) {
    return {
      success: true,
      ...baseResult,
    };
  }

  /*
   * =====================================================
   * LANÇAMENTO FINANCEIRO
   * =====================================================
   */

  const financialEntryResult =
    await getCommissionFinancialEntry(
      supabase,
      financialEntryId
    );

  if (
    !financialEntryResult.success
  ) {
    return {
      ...financialEntryResult,
      ...baseResult,
    };
  }

  const {
    financialEntry,
  } =
    financialEntryResult;

  const paymentAmount =
    Math.max(
      0,
      Number(
        commissionPayment.amount ??
          0
      )
    );

  const paidOnThisPayment =
    Math.min(
      Math.max(
        0,
        Number(
          financialEntry
            .amount_paid ??
            0
        )
      ),
      paymentAmount
    );

  /*
   * Quanto desta ordem já foi
   * refletido em amount_paid.
   */

  const previouslyApplied =
    Math.max(
      0,
      Number(
        commissionPayment
          .amount_applied ??
          0
      )
    );

  const paymentDelta =
    Math.max(
      roundMoney(
        paidOnThisPayment -
          previouslyApplied
      ),
      0
    );

  /*
   * =====================================================
   * VALORES DA COMISSÃO
   * =====================================================
   */

  const totalCommission =
    Math.max(
      0,
      Number(
        commission.amount ??
          0
      )
    );

  const releasedCommission =
    Math.max(
      0,
      Math.min(
        Number(
          commission
            .amount_released ??
            0
        ),
        totalCommission
      )
    );

  const currentCommissionPaid =
    Math.max(
      0,
      Math.min(
        Number(
          commission
            .amount_paid ??
            0
        ),
        totalCommission
      )
    );

  /*
   * Não pode pagar comissão ainda
   * não liberada pelo recebimento
   * do contrato.
   */

  const availableToApply =
    Math.max(
      roundMoney(
        releasedCommission -
          currentCommissionPaid
      ),
      0
    );

  const applicableDelta =
    Math.min(
      paymentDelta,
      availableToApply
    );

  const newCommissionPaid =
    Math.min(
      roundMoney(
        currentCommissionPaid +
          applicableDelta
      ),
      releasedCommission,
      totalCommission
    );

  /*
   * =====================================================
   * STATUS DO PAGAMENTO
   * =====================================================
   */

  const paymentStatus =
    getPaymentStatus(
      paidOnThisPayment,
      paymentAmount
    );

  /*
   * =====================================================
   * STATUS DA COMISSÃO
   * =====================================================
   */

  const commissionFullyPaid =
    totalCommission >
      0 &&
    newCommissionPaid >=
      totalCommission;

  const newCommissionStatus:
    | "pending"
    | "generated"
    | "paid" =
    commissionFullyPaid
      ? "paid"
      : releasedCommission >
          0
        ? "generated"
        : "pending";

  /*
   * =====================================================
   * ATUALIZAR PAGAMENTO
   * =====================================================
   */

  const {
    error:
      updatePaymentError,
  } =
    await supabase
      .from(
        "contract_commission_payments"
      )
      .update({
        amount_applied:
          paidOnThisPayment,

        status:
          paymentStatus,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        commissionPayment.id
      );

  if (
    updatePaymentError
  ) {
    console.error(
      "Erro ao atualizar pagamento da comissão de contrato:",
      updatePaymentError
    );

    return {
      success: false,

      message:
        "O financeiro foi atualizado, mas o pagamento da comissão do contrato não pôde ser sincronizado.",

      ...baseResult,
    };
  }

  /*
   * =====================================================
   * ATUALIZAR COMISSÃO DO CONTRATO
   * =====================================================
   */

  const {
    error:
      updateCommissionError,
  } =
    await supabase
      .from(
        "contract_commissions"
      )
      .update({
        amount_paid:
          newCommissionPaid,

        status:
          newCommissionStatus,

        paid_at:
          commissionFullyPaid
            ? new Date()
                .toISOString()
            : null,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        commission.id
      );

  if (
    updateCommissionError
  ) {
    console.error(
      "Erro ao atualizar comissão do contrato:",
      updateCommissionError
    );

    return {
      success: false,

      message:
        "O pagamento foi registrado, mas a comissão do contrato não pôde ser atualizada.",

      ...baseResult,
    };
  }

  return {
    success: true,
    ...baseResult,
  };
}

/*
 * =====================================================
 * BUSCAR LANÇAMENTO FINANCEIRO
 * =====================================================
 */

async function getCommissionFinancialEntry(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  financialEntryId: string
): Promise<
  | {
      success: true;
      financialEntry: {
        id: string;
        amount:
          | number
          | string;
        amount_paid:
          | number
          | string;
        interest:
          | number
          | string;
        fine:
          | number
          | string;
        discount:
          | number
          | string;
        status: string;
      };
    }
  | {
      success: false;
      message: string;
    }
> {
  const {
    data:
      financialEntry,
    error:
      financialError,
  } =
    await supabase
      .from(
        "financial_entries"
      )
      .select(`
        id,
        amount,
        amount_paid,
        interest,
        fine,
        discount,
        status
      `)
      .eq(
        "id",
        financialEntryId
      )
      .maybeSingle();

  if (
    financialError ||
    !financialEntry
  ) {
    return {
      success: false,
      message:
        "Não foi possível consultar o lançamento financeiro da comissão.",
    };
  }

  return {
    success: true,
    financialEntry,
  };
}

/*
 * =====================================================
 * STATUS DO PAGAMENTO
 * =====================================================
 */

function getPaymentStatus(
  paidAmount: number,
  totalAmount: number
):
  | "generated"
  | "partial"
  | "paid" {
  if (
    totalAmount >
      0 &&
    paidAmount >=
      totalAmount
  ) {
    return "paid";
  }

  if (
    paidAmount >
    0
  ) {
    return "partial";
  }

  return "generated";
}
/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

function getFirst<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (
    !value
  ) {
    return null;
  }

  return Array.isArray(
    value
  )
    ? value[0] ??
        null
    : value;
}

function roundMoney(
  value: number
) {
  return (
    Math.round(
      (
        Number(
          value
        ) +
        Number.EPSILON
      ) *
        100
    ) /
    100
  );
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",
    }
  ).format(
    value
  );
}