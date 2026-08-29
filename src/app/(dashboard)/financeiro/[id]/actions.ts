"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireAuthenticatedUser,
  requireCompanyAccess,
  requireFinancialEntryAccess,
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
  await requireAuthenticatedUser();

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
   * Acesso por natureza do lançamento: "financial.edit"
   * (geral) OU o módulo específico da natureza
   * (accounts_receivable p/ receita, accounts_payable p/
   * despesa) com permissão de editar.
   */
  await requireFinancialEntryAccess(
    entry.type === "expense"
      ? "expense"
      : "income",
    "edit"
  );

  /*
   * Garante que o usuário só possa registrar uma
   * movimentação para lançamentos de empresas às quais
   * ele tem acesso (a permissão de módulo sozinha não
   * bastava — permitia baixar lançamento de qualquer
   * empresa só sabendo o id).
   */
  await requireCompanyAccess(
    entry.company_id
  );

  /*
   * =====================================================
   * VALIDAÇÕES
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
    input.amount <=
      0 ||
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
   * BAIXA FINANCEIRA ATÔMICA
   * =====================================================
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
   * COMISSÕES LIBERADAS PELO RECEBIMENTO
   * =====================================================
   */

  let saleInfo: {
    saleId: string;
    editionId: string;
  } | null =
    null;

  let contractInfo: {
    contractId: string;
  } | null =
    null;

  let saleCommissionWarning:
    string | null =
    null;

  let contractCommissionWarning:
    string | null =
    null;

  /*
   * Só recebimentos liberam
   * comissão.
   */

  if (
    entry.type ===
    "income"
  ) {
    /*
     * VENDA DE EDIÇÃO
     */

    const saleSyncResult =
      await syncSaleCommissions(
        supabase,
        entryId,
        input.date
      );

    if (
      saleSyncResult.saleId &&
      saleSyncResult.editionId
    ) {
      saleInfo = {
        saleId:
          saleSyncResult.saleId,

        editionId:
          saleSyncResult.editionId,
      };
    }

    if (
      !saleSyncResult.success
    ) {
      console.error(
        "Recebimento registrado, mas houve erro ao atualizar comissão da venda:",
        saleSyncResult.message
      );

      saleCommissionWarning =
        saleSyncResult.message ??
        "Não foi possível atualizar as comissões da venda.";
    }

    /*
     * CONTRATO
     */

    const contractSyncResult =
      await syncContractCommissions(
        supabase,
        entryId,
        input.date
      );

    if (
      contractSyncResult.contractId
    ) {
      contractInfo = {
        contractId:
          contractSyncResult.contractId,
      };
    }

    if (
      !contractSyncResult.success
    ) {
      console.error(
        "Recebimento registrado, mas houve erro ao atualizar comissão do contrato:",
        contractSyncResult.message
      );

      contractCommissionWarning =
        contractSyncResult.message ??
        "Não foi possível atualizar as comissões do contrato.";
    }
  }

  /*
   * =====================================================
   * PAGAMENTO DE UMA COMISSÃO
   * =====================================================
   *
   * Quando a despesa automática
   * da comissão for efetivamente
   * paga, atualizamos amount_paid.
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
    const paymentSyncResult =
      await syncCommissionPayment(
        supabase,
        entryId
      );

    if (
      paymentSyncResult.commissionId
    ) {
      commissionPaymentInfo = {
        commissionId:
          paymentSyncResult.commissionId,

        originType:
          paymentSyncResult.originType,

        saleId:
          paymentSyncResult.saleId,

        editionId:
          paymentSyncResult.editionId,

        contractId:
          paymentSyncResult.contractId,
      };
    }

    if (
      !paymentSyncResult.success
    ) {
      console.error(
        "Pagamento registrado, mas houve erro ao atualizar comissão:",
        paymentSyncResult.message
      );

      commissionPaymentWarning =
        paymentSyncResult.message ??
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

      contract_commissions_updated:
        Boolean(
          contractInfo
        ),

      commission_payment_updated:
        Boolean(
          commissionPaymentInfo
        ),
    },
  });

  /*
   * =====================================================
   * REVALIDAÇÕES
   * =====================================================
   */

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

  revalidatePath(
    "/comissoes"
  );

  /*
   * VENDA
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

  /*
   * CONTRATO
   */

  if (
    contractInfo
  ) {
    revalidatePath(
      "/contratos"
    );

    revalidatePath(
      `/contratos/${contractInfo.contractId}`
    );
  }

  /*
   * PAGAMENTO DE COMISSÃO
   */

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
  }

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
 */

async function syncSaleCommissions(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  financialEntryId: string,
  receiptDate: string
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
   * Não é parcela de venda.
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
        company_id,
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
    saleTotal <=
      0
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
   * TODAS AS PARCELAS DA VENDA
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

  /*
   * =====================================================
   * LANÇAMENTOS
   * =====================================================
   */

  const {
    data: financialEntries,
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
   * Juros e multa não geram comissão.
   */

  const receivedPrincipal =
    roundMoney(
      installments.reduce(
        (
          totalReceived,
          installment
        ) => {
          if (
            !installment
              .financial_entry_id
          ) {
            return totalReceived;
          }

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
              installment.amount ??
                0
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
        beneficiary_user_id,
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
   * ATUALIZAR E GERAR PAGAMENTO
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

    /*
     * Atualiza quanto está liberado.
     */

    const {
      error:
        updateError,
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
      updateError
    ) {
      console.error(
        "Erro ao atualizar comissão da venda:",
        updateError
      );

      return {
        success: false,

        message:
          "O recebimento foi registrado, mas uma comissão da venda não pôde ser atualizada.",

        ...baseResult,
      };
    }

    /*
     * Cria automaticamente a
     * conta a pagar do novo valor
     * liberado.
     */

    const generationResult =
      await generateAutomaticSaleCommissionPayment(
        supabase,
        {
          commissionId:
            commission.id,

          companyId:
            sale.company_id,

          sourceFinancialEntryId:
            financialEntryId,

          releasedAmount,

          receiptDate,
        }
      );

    if (
      !generationResult.success
    ) {
      return {
        success: false,

        message:
          generationResult.message,

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
 * SINCRONIZAR COMISSÕES DE CONTRATO
 * =====================================================
 */

async function syncContractCommissions(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  financialEntryId: string,
  receiptDate: string
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
    data: installmentLink,
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
        company_id,
        value,
        status,
        title
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
   * LANÇAMENTOS
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
        beneficiary_user_id,
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
   * ATUALIZAR E GERAR PAGAMENTO
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

    /*
     * Cria conta a pagar
     * automaticamente.
     */

    const generationResult =
      await generateAutomaticContractCommissionPayment(
        supabase,
        {
          commissionId:
            commission.id,

          companyId:
            contract.company_id,

          sourceFinancialEntryId:
            financialEntryId,

          releasedAmount,

          receiptDate,
        }
      );

    if (
      !generationResult.success
    ) {
      return {
        success: false,

        message:
          generationResult.message,

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
 * GERAR PAGAMENTO AUTOMÁTICO
 * COMISSÃO DE VENDA
 * =====================================================
 */

async function generateAutomaticSaleCommissionPayment(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  input: {
    commissionId: string;
    companyId: string;
    sourceFinancialEntryId: string;
    releasedAmount: number;
    receiptDate: string;
  }
): Promise<{
  success: boolean;
  message?: string;
}> {
  /*
   * =====================================================
   * TOTAL JÁ GERADO
   * =====================================================
   */

  const {
    data: generatedPayments,
    error:
      generatedPaymentsError,
  } =
    await supabase
      .from(
        "commission_payments"
      )
      .select(`
        id,
        financial_entry_id,
        source_financial_entry_id,
        amount,
        status
      `)
      .eq(
        "commission_id",
        input.commissionId
      )
      .neq(
        "status",
        "cancelled"
      );

  if (
    generatedPaymentsError
  ) {
    return {
      success: false,

      message:
        "Não foi possível calcular quanto da comissão já foi gerado.",
    };
  }

  const alreadyGenerated =
    roundMoney(
      (
        generatedPayments ??
        []
      ).reduce(
        (
          total,
          payment
        ) =>
          total +
          Number(
            payment.amount ??
              0
          ),
        0
      )
    );

  const amountToGenerate =
    roundMoney(
      Math.max(
        input.releasedAmount -
          alreadyGenerated,
        0
      )
    );

  /*
   * Nada novo para gerar.
   */

  if (
    amountToGenerate <=
    0
  ) {
    return {
      success: true,
    };
  }

  /*
   * =====================================================
   * PROTEÇÃO DO MESMO RECEBIMENTO
   * =====================================================
   */

  const {
    data: existingSourcePayment,
    error:
      existingSourceError,
  } =
    await supabase
      .from(
        "commission_payments"
      )
      .select(`
        id
      `)
      .eq(
        "commission_id",
        input.commissionId
      )
      .eq(
        "source_financial_entry_id",
        input.sourceFinancialEntryId
      )
      .maybeSingle();

  if (
    existingSourceError
  ) {
    return {
      success: false,

      message:
        "Não foi possível verificar a origem da comissão.",
    };
  }

  if (
    existingSourcePayment
  ) {
    return {
      success: true,
    };
  }

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
        beneficiary_user_id,
        commission_type,

        sale:edition_sales (
          id,
          edition_id,

          edition:newspaper_editions (
            id,
            name,
            edition_number
          )
        )
      `)
      .eq(
        "id",
        input.commissionId
      )
      .maybeSingle();

  if (
    commissionError ||
    !commission
  ) {
    return {
      success: false,

      message:
        "Não foi possível localizar a comissão da venda.",
    };
  }

  const sale =
    getFirst(
      commission.sale
    );

  const edition =
    sale
      ? getFirst(
          sale.edition
        )
      : null;

  const beneficiaryName =
    await getBeneficiaryName(
      supabase,
      commission.beneficiary_user_id
    );

  const dueDate =
    getNextCommissionDueDate(
      input.receiptDate
    );

  const description =
    edition
      ? `Comissão - ${beneficiaryName} - ${edition.name}`
      : `Comissão - ${beneficiaryName}`;

  /*
   * =====================================================
   * CONTA A PAGAR
   * =====================================================
   */

  const {
    data: financialEntry,
    error:
      financialEntryError,
  } =
    await supabase
      .from(
        "financial_entries"
      )
      .insert({
        company_id:
          input.companyId,

        type:
          "expense",

        client_id:
          null,

        supplier_id:
          null,

        contract_id:
          null,

        product_id:
          null,

        category_id:
          null,

        cost_center_id:
          null,

        financial_account_id:
          null,

        description,

        document_number:
          null,

        competence_date:
          input.receiptDate,

        issue_date:
          today(),

        due_date:
          dueDate,

        amount:
          amountToGenerate,

        amount_paid:
          0,

        interest:
          0,

        fine:
          0,

        discount:
          0,

        status:
          "pending",

        recurring:
          false,

        recurrence_frequency:
          null,

        invoice_issued:
          false,

        invoice_number:
          null,

        invoice_issued_at:
          null,

        charge_sent:
          false,

        charge_sent_at:
          null,

        notes:
          `Comissão gerada automaticamente após recebimento. Origem financeira: ${input.sourceFinancialEntryId}.`,
      })
      .select(`
        id
      `)
      .single();

  if (
    financialEntryError ||
    !financialEntry
  ) {
    console.error(
      "Erro ao gerar conta a pagar da comissão:",
      financialEntryError
    );

    return {
      success: false,

      message:
        financialEntryError
          ?.message ??
        "Não foi possível gerar a conta a pagar da comissão.",
    };
  }

  /*
   * =====================================================
   * VÍNCULO
   * =====================================================
   */

  const {
    error: paymentError,
  } =
    await supabase
      .from(
        "commission_payments"
      )
      .insert({
        commission_id:
          input.commissionId,

        financial_entry_id:
          financialEntry.id,

        source_financial_entry_id:
          input.sourceFinancialEntryId,

        amount:
          amountToGenerate,

        amount_applied:
          0,

        status:
          "generated",
      });

  if (
    paymentError
  ) {
    /*
     * Evita despesa órfã.
     */

    await supabase
      .from(
        "financial_entries"
      )
      .delete()
      .eq(
        "id",
        financialEntry.id
      );

    /*
     * UNIQUE:
     * outra execução pode ter
     * gerado no mesmo momento.
     */

    if (
      paymentError.code ===
      "23505"
    ) {
      return {
        success: true,
      };
    }

    console.error(
      "Erro ao vincular comissão automática:",
      paymentError
    );

    return {
      success: false,

      message:
        paymentError.message,
    };
  }

  return {
    success: true,
  };
}

/*
 * =====================================================
 * GERAR PAGAMENTO AUTOMÁTICO
 * COMISSÃO DE CONTRATO
 * =====================================================
 */

async function generateAutomaticContractCommissionPayment(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  input: {
    commissionId: string;
    companyId: string;
    sourceFinancialEntryId: string;
    releasedAmount: number;
    receiptDate: string;
  }
): Promise<{
  success: boolean;
  message?: string;
}> {
  /*
   * =====================================================
   * TOTAL JÁ GERADO
   * =====================================================
   */

  const {
    data: generatedPayments,
    error:
      generatedPaymentsError,
  } =
    await supabase
      .from(
        "contract_commission_payments"
      )
      .select(`
        id,
        amount,
        status
      `)
      .eq(
        "commission_id",
        input.commissionId
      )
      .neq(
        "status",
        "cancelled"
      );

  if (
    generatedPaymentsError
  ) {
    return {
      success: false,

      message:
        "Não foi possível calcular quanto da comissão do contrato já foi gerado.",
    };
  }

  const alreadyGenerated =
    roundMoney(
      (
        generatedPayments ??
        []
      ).reduce(
        (
          total,
          payment
        ) =>
          total +
          Number(
            payment.amount ??
              0
          ),
        0
      )
    );

  const amountToGenerate =
    roundMoney(
      Math.max(
        input.releasedAmount -
          alreadyGenerated,
        0
      )
    );

  if (
    amountToGenerate <=
    0
  ) {
    return {
      success: true,
    };
  }

  /*
   * =====================================================
   * PROTEÇÃO DO MESMO RECEBIMENTO
   * =====================================================
   */

  const {
    data: existingSourcePayment,
    error:
      existingSourceError,
  } =
    await supabase
      .from(
        "contract_commission_payments"
      )
      .select(`
        id
      `)
      .eq(
        "commission_id",
        input.commissionId
      )
      .eq(
        "source_financial_entry_id",
        input.sourceFinancialEntryId
      )
      .maybeSingle();

  if (
    existingSourceError
  ) {
    return {
      success: false,

      message:
        "Não foi possível verificar a origem da comissão do contrato.",
    };
  }

  if (
    existingSourcePayment
  ) {
    return {
      success: true,
    };
  }

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
        beneficiary_user_id,

        contract:contracts (
          id,
          title
        )
      `)
      .eq(
        "id",
        input.commissionId
      )
      .maybeSingle();

  if (
    commissionError ||
    !commission
  ) {
    return {
      success: false,

      message:
        "Não foi possível localizar a comissão do contrato.",
    };
  }

  const contract =
    getFirst(
      commission.contract
    );

  const beneficiaryName =
    await getBeneficiaryName(
      supabase,
      commission.beneficiary_user_id
    );

  const dueDate =
    getNextCommissionDueDate(
      input.receiptDate
    );

  const description =
    contract
      ? `Comissão - ${beneficiaryName} - ${contract.title}`
      : `Comissão - ${beneficiaryName}`;

  /*
   * =====================================================
   * CONTA A PAGAR
   * =====================================================
   */

  const {
    data: financialEntry,
    error:
      financialEntryError,
  } =
    await supabase
      .from(
        "financial_entries"
      )
      .insert({
        company_id:
          input.companyId,

        type:
          "expense",

        client_id:
          null,

        supplier_id:
          null,

        contract_id:
          contract?.id ??
          null,

        product_id:
          null,

        category_id:
          null,

        cost_center_id:
          null,

        financial_account_id:
          null,

        description,

        document_number:
          null,

        competence_date:
          input.receiptDate,

        issue_date:
          today(),

        due_date:
          dueDate,

        amount:
          amountToGenerate,

        amount_paid:
          0,

        interest:
          0,

        fine:
          0,

        discount:
          0,

        status:
          "pending",

        recurring:
          false,

        recurrence_frequency:
          null,

        invoice_issued:
          false,

        invoice_number:
          null,

        invoice_issued_at:
          null,

        charge_sent:
          false,

        charge_sent_at:
          null,

        notes:
          `Comissão de contrato gerada automaticamente após recebimento. Origem financeira: ${input.sourceFinancialEntryId}.`,
      })
      .select(`
        id
      `)
      .single();

  if (
    financialEntryError ||
    !financialEntry
  ) {
    console.error(
      "Erro ao gerar conta a pagar da comissão do contrato:",
      financialEntryError
    );

    return {
      success: false,

      message:
        financialEntryError
          ?.message ??
        "Não foi possível gerar a conta a pagar da comissão do contrato.",
    };
  }

  /*
   * =====================================================
   * VÍNCULO
   * =====================================================
   */

  const {
    error: paymentError,
  } =
    await supabase
      .from(
        "contract_commission_payments"
      )
      .insert({
        commission_id:
          input.commissionId,

        financial_entry_id:
          financialEntry.id,

        source_financial_entry_id:
          input.sourceFinancialEntryId,

        amount:
          amountToGenerate,

        amount_applied:
          0,

        status:
          "generated",
      });

  if (
    paymentError
  ) {
    await supabase
      .from(
        "financial_entries"
      )
      .delete()
      .eq(
        "id",
        financialEntry.id
      );

    if (
      paymentError.code ===
      "23505"
    ) {
      return {
        success: true,
      };
    }

    console.error(
      "Erro ao vincular comissão automática do contrato:",
      paymentError
    );

    return {
      success: false,

      message:
        paymentError.message,
    };
  }

  return {
    success: true,
  };
}

/*
 * =====================================================
 * SINCRONIZAR PAGAMENTO DE COMISSÃO
 * =====================================================
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
   * COMISSÃO DE VENDA
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
   * COMISSÃO DE CONTRATO
   * =====================================================
   */

  const {
    data: contractPayment,
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
   * Despesa comum.
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
  originType?: "sale";
}> {
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

  const paymentStatus =
    getPaymentStatus(
      paidOnThisPayment,
      paymentAmount
    );

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
   * PAGAMENTO
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
   * COMISSÃO
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
  originType?: "contract";
}> {
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

  const paymentStatus =
    getPaymentStatus(
      paidOnThisPayment,
      paymentAmount
    );

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
    return {
      success: false,

      message:
        "O financeiro foi atualizado, mas o pagamento da comissão do contrato não pôde ser sincronizado.",

      ...baseResult,
    };
  }

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
 * BUSCAR LANÇAMENTO DA COMISSÃO
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
    data: financialEntry,
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
 * NOME DO BENEFICIÁRIO
 * =====================================================
 */

async function getBeneficiaryName(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  userId: string
) {
  const {
    data: profile,
  } =
    await supabase
      .from(
        "user_profiles"
      )
      .select(`
        name
      `)
      .eq(
        "id",
        userId
      )
      .maybeSingle();

  return (
    profile?.name ??
    "Beneficiário"
  );
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
 * PRÓXIMO DIA 10
 * =====================================================
 *
 * Recebeu 26/08
 * → vence 10/09
 *
 * Recebeu 05/12
 * → vence 10/01
 * =====================================================
 */

function getNextCommissionDueDate(
  receiptDate: string
) {
  const [
    year,
    month,
  ] =
    receiptDate
      .split("-")
      .map(
        Number
      );

  /*
   * month recebido de "08" = 8.
   *
   * Date.UTC usa:
   * janeiro = 0.
   *
   * Passar month diretamente
   * nos leva ao próximo mês.
   */

  const targetDate =
    new Date(
      Date.UTC(
        year,
        month,
        10
      )
    );

  const targetYear =
    targetDate
      .getUTCFullYear();

  const targetMonth =
    String(
      targetDate
        .getUTCMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  return `${targetYear}-${targetMonth}-10`;
}

/*
 * =====================================================
 * DATA DE HOJE
 * =====================================================
 */

function today() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
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