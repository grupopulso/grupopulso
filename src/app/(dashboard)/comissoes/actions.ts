"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

type CommissionOriginType =
  | "sale"
  | "contract";

type PayCommissionInput = {
  commissionId: string;

  originType:
    CommissionOriginType;

  amount: number;

  dueDate: string;

  notes?: string;
};

export async function payCommission(
  input: PayCommissionInput
) {
  const access =
    await requireEstafetaAccess();

  const supabase =
    await createClient();

  /*
   * =====================================================
   * VALIDAÇÕES
   * =====================================================
   */

  if (
    !input.commissionId
  ) {
    return {
      success: false,
      message:
        "Comissão inválida.",
    };
  }

  if (
    input.originType !==
      "sale" &&
    input.originType !==
      "contract"
  ) {
    return {
      success: false,
      message:
        "Origem da comissão inválida.",
    };
  }

  if (
    !Number.isFinite(
      input.amount
    ) ||
    input.amount <=
      0
  ) {
    return {
      success: false,
      message:
        "Informe um valor válido.",
    };
  }

  if (
    !input.dueDate
  ) {
    return {
      success: false,
      message:
        "Informe a data de pagamento.",
    };
  }

  /*
   * =====================================================
   * VENDA
   * =====================================================
   */

  if (
    input.originType ===
    "sale"
  ) {
    return paySaleCommission(
      supabase,
      access.estafetaCompany.id,
      input
    );
  }

  /*
   * =====================================================
   * CONTRATO
   * =====================================================
   */

  return payContractCommission(
    supabase,
    access.estafetaCompany.id,
    input
  );
}

/*
 * =====================================================
 * PAGAMENTO DE COMISSÃO DE VENDA
 * =====================================================
 */

async function paySaleCommission(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  estafetaCompanyId: string,
  input: PayCommissionInput
) {
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
        beneficiary_user_id,
        amount,
        amount_released,
        amount_paid,
        status,

        sale:edition_sales (
          id,
          company_id,
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
        "Comissão de venda não encontrada.",
    };
  }

  if (
    commission.status ===
    "cancelled"
  ) {
    return {
      success: false,
      message:
        "Uma comissão cancelada não pode gerar pagamento.",
    };
  }

  const sale =
    getFirst(
      commission.sale
    );

  if (
    !sale
  ) {
    return {
      success: false,
      message:
        "Venda vinculada à comissão não encontrada.",
    };
  }

  if (
    sale.company_id !==
    estafetaCompanyId
  ) {
    return {
      success: false,
      message:
        "Esta comissão não pertence ao O Estafeta.",
    };
  }

  const availability =
    await calculateSaleAvailability(
      supabase,
      commission.id,
      Number(
        commission.amount ??
          0
      ),
      Number(
        commission
          .amount_released ??
          0
      ),
      Number(
        commission
          .amount_paid ??
          0
      )
    );

  if (
    !availability.success
  ) {
    return availability;
  }

  if (
    input.amount >
    availability.available
  ) {
    return {
      success: false,
      message:
        `O valor informado é maior que o disponível para gerar (${formatCurrency(
          availability.available
        )}).`,
    };
  }

  const beneficiaryName =
    await getBeneficiaryName(
      supabase,
      commission
        .beneficiary_user_id
    );

  const edition =
    getFirst(
      sale.edition
    );

  const description =
    edition
      ? `Comissão - ${beneficiaryName} - ${edition.name}`
      : `Comissão - ${beneficiaryName}`;

  const financialEntryResult =
    await createCommissionFinancialEntry(
      supabase,
      {
        companyId:
          sale.company_id,

        description,

        dueDate:
          input.dueDate,

        amount:
          input.amount,

        notes:
          input.notes,

        originDescription:
          `Comissão de venda ${commission.id}.`,
      }
    );

  if (
    !financialEntryResult.success
  ) {
    return financialEntryResult;
  }

  const {
    financialEntryId,
  } =
    financialEntryResult;

  const {
    data:
      commissionPayment,
    error:
      paymentError,
  } =
    await supabase
      .from(
        "commission_payments"
      )
      .insert({
        commission_id:
          commission.id,

        financial_entry_id:
          financialEntryId,

        amount:
          input.amount,

        amount_applied:
          0,

        status:
          "generated",
      })
      .select(`
        id
      `)
      .single();

  if (
    paymentError ||
    !commissionPayment
  ) {
    await deleteFinancialEntry(
      supabase,
      financialEntryId
    );

    return {
      success: false,
      message:
        paymentError
          ?.message ??
        "Não foi possível vincular o pagamento à comissão de venda.",
    };
  }

  revalidateCommissionPaths();

  if (
    edition
  ) {
    revalidatePath(
      `/edicoes/${edition.id}`
    );

    revalidatePath(
      `/edicoes/${edition.id}/vendas/${sale.id}`
    );
  }

  return {
    success: true,

    originType:
      "sale" as const,

    financialEntryId,

    commissionPaymentId:
      commissionPayment.id,
  };
}

/*
 * =====================================================
 * PAGAMENTO DE COMISSÃO DE CONTRATO
 * =====================================================
 */

async function payContractCommission(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  estafetaCompanyId: string,
  input: PayCommissionInput
) {
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
        beneficiary_user_id,
        amount,
        amount_released,
        amount_paid,
        status,

        contract:contracts (
          id,
          company_id,
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
        "Comissão de contrato não encontrada.",
    };
  }

  if (
    commission.status ===
    "cancelled"
  ) {
    return {
      success: false,
      message:
        "Uma comissão cancelada não pode gerar pagamento.",
    };
  }

  const contract =
    getFirst(
      commission.contract
    );

  if (
    !contract
  ) {
    return {
      success: false,
      message:
        "Contrato vinculado à comissão não encontrado.",
    };
  }

  if (
    contract.company_id !==
    estafetaCompanyId
  ) {
    return {
      success: false,
      message:
        "Esta comissão não pertence ao O Estafeta.",
    };
  }

  const availability =
    await calculateContractAvailability(
      supabase,
      commission.id,
      Number(
        commission.amount ??
          0
      ),
      Number(
        commission
          .amount_released ??
          0
      ),
      Number(
        commission
          .amount_paid ??
          0
      )
    );

  if (
    !availability.success
  ) {
    return availability;
  }

  if (
    input.amount >
    availability.available
  ) {
    return {
      success: false,
      message:
        `O valor informado é maior que o disponível para gerar (${formatCurrency(
          availability.available
        )}).`,
    };
  }

  const beneficiaryName =
    await getBeneficiaryName(
      supabase,
      commission
        .beneficiary_user_id
    );

  const description =
    `Comissão - ${beneficiaryName} - ${contract.title}`;

  const financialEntryResult =
    await createCommissionFinancialEntry(
      supabase,
      {
        companyId:
          contract.company_id,

        description,

        dueDate:
          input.dueDate,

        amount:
          input.amount,

        notes:
          input.notes,

        originDescription:
          `Comissão do contrato ${commission.id}.`,
      }
    );

  if (
    !financialEntryResult.success
  ) {
    return financialEntryResult;
  }

  const {
    financialEntryId,
  } =
    financialEntryResult;

  const {
    data:
      commissionPayment,
    error:
      paymentError,
  } =
    await supabase
      .from(
        "contract_commission_payments"
      )
      .insert({
        commission_id:
          commission.id,

        financial_entry_id:
          financialEntryId,

        amount:
          input.amount,

        amount_applied:
          0,

        status:
          "generated",
      })
      .select(`
        id
      `)
      .single();

  if (
    paymentError ||
    !commissionPayment
  ) {
    await deleteFinancialEntry(
      supabase,
      financialEntryId
    );

    return {
      success: false,
      message:
        paymentError
          ?.message ??
        "Não foi possível vincular o pagamento à comissão do contrato.",
    };
  }

  revalidateCommissionPaths();

  revalidatePath(
    "/contratos"
  );

  revalidatePath(
    `/contratos/${contract.id}`
  );

  return {
    success: true,

    originType:
      "contract" as const,

    financialEntryId,

    commissionPaymentId:
      commissionPayment.id,
  };
}

/*
 * =====================================================
 * DISPONIBILIDADE - VENDA
 * =====================================================
 */

async function calculateSaleAvailability(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  commissionId: string,
  expectedAmount: number,
  releasedAmount: number,
  paidAmount: number
): Promise<
  | {
      success: true;
      available: number;
      committed: number;
    }
  | {
      success: false;
      message: string;
    }
> {
  const {
    data: payments,
    error,
  } =
    await supabase
      .from(
        "commission_payments"
      )
      .select(`
        amount,
        amount_applied,
        status
      `)
      .eq(
        "commission_id",
        commissionId
      )
      .neq(
        "status",
        "cancelled"
      );

  if (
    error
  ) {
    return {
      success: false,
      message:
        "Não foi possível verificar os pagamentos já gerados.",
    };
  }

  const committed =
    calculateCommitted(
      payments ??
      []
    );

  const expected =
    Math.max(
      0,
      expectedAmount
    );

  const released =
    Math.max(
      0,
      Math.min(
        releasedAmount,
        expected
      )
    );

  const paid =
    Math.max(
      0,
      Math.min(
        paidAmount,
        expected
      )
    );

  const available =
    Math.max(
      roundMoney(
        released -
          paid -
          committed
      ),
      0
    );

  if (
    available <=
    0
  ) {
    return {
      success: false,
      message:
        "Não existe comissão disponível para gerar pagamento.",
    };
  }

  return {
    success: true,
    available,
    committed,
  };
}

/*
 * =====================================================
 * DISPONIBILIDADE - CONTRATO
 * =====================================================
 */

async function calculateContractAvailability(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  commissionId: string,
  expectedAmount: number,
  releasedAmount: number,
  paidAmount: number
): Promise<
  | {
      success: true;
      available: number;
      committed: number;
    }
  | {
      success: false;
      message: string;
    }
> {
  const {
    data: payments,
    error,
  } =
    await supabase
      .from(
        "contract_commission_payments"
      )
      .select(`
        amount,
        amount_applied,
        status
      `)
      .eq(
        "commission_id",
        commissionId
      )
      .neq(
        "status",
        "cancelled"
      );

  if (
    error
  ) {
    return {
      success: false,
      message:
        "Não foi possível verificar os pagamentos já gerados para a comissão do contrato.",
    };
  }

  const committed =
    calculateCommitted(
      payments ??
      []
    );

  const expected =
    Math.max(
      0,
      expectedAmount
    );

  const released =
    Math.max(
      0,
      Math.min(
        releasedAmount,
        expected
      )
    );

  const paid =
    Math.max(
      0,
      Math.min(
        paidAmount,
        expected
      )
    );

  const available =
    Math.max(
      roundMoney(
        released -
          paid -
          committed
      ),
      0
    );

  if (
    available <=
    0
  ) {
    return {
      success: false,
      message:
        "Não existe comissão de contrato disponível para gerar pagamento.",
    };
  }

  return {
    success: true,
    available,
    committed,
  };
}

/*
 * =====================================================
 * CRIAR LANÇAMENTO FINANCEIRO
 * =====================================================
 */

async function createCommissionFinancialEntry(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  input: {
    companyId: string;
    description: string;
    dueDate: string;
    amount: number;
    notes?: string;
    originDescription: string;
  }
): Promise<
  | {
      success: true;
      financialEntryId: string;
    }
  | {
      success: false;
      message: string;
    }
> {
  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

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

        description:
          input.description,

        document_number:
          null,

        competence_date:
          input.dueDate,

        issue_date:
          today,

        due_date:
          input.dueDate,

        amount:
          input.amount,

        amount_paid:
          0,

        interest:
          0,

        fine:
          0,

        discount:
          0,

        status:
          input.dueDate <
          today
            ? "overdue"
            : "pending",

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
          input.notes
            ?.trim() ||
          input.originDescription,
      })
      .select(`
        id
      `)
      .single();

  if (
    financialError ||
    !financialEntry
  ) {
    return {
      success: false,
      message:
        financialError
          ?.message ??
        "Não foi possível gerar a conta a pagar da comissão.",
    };
  }

  return {
    success: true,
    financialEntryId:
      financialEntry.id,
  };
}

/*
 * =====================================================
 * BENEFICIÁRIO
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
    error,
  } =
    await supabase
      .from(
        "profiles"
      )
      .select(`
        id,
        full_name,
        email
      `)
      .eq(
        "id",
        userId
      )
      .maybeSingle();

  if (
    error
  ) {
    console.error(
      "Erro ao carregar beneficiário:",
      error
    );
  }

  return (
    profile?.full_name ??
    profile?.email ??
    "Beneficiário"
  );
}

/*
 * =====================================================
 * REMOVER FINANCEIRO ÓRFÃO
 * =====================================================
 */

async function deleteFinancialEntry(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  financialEntryId: string
) {
  const {
    error,
  } =
    await supabase
      .from(
        "financial_entries"
      )
      .delete()
      .eq(
        "id",
        financialEntryId
      );

  if (
    error
  ) {
    console.error(
      "Erro ao remover lançamento financeiro órfão:",
      error
    );
  }
}

/*
 * =====================================================
 * REVALIDAÇÃO
 * =====================================================
 */

function revalidateCommissionPaths() {
  revalidatePath(
    "/comissoes"
  );

  revalidatePath(
    "/financeiro"
  );

  revalidatePath(
    "/financeiro/pagar"
  );

  revalidatePath(
    "/financeiro/pagamentos"
  );
}

/*
 * =====================================================
 * VALOR COMPROMETIDO
 * =====================================================
 */

function calculateCommitted(
  payments: {
    amount:
      | number
      | string;

    amount_applied:
      | number
      | string;

    status: string;
  }[]
) {
  return roundMoney(
    payments.reduce(
      (
        total,
        payment
      ) => {
        if (
          payment.status ===
          "cancelled"
        ) {
          return total;
        }

        const amount =
          Number(
            payment.amount ??
              0
          );

        const applied =
          Number(
            payment
              .amount_applied ??
              0
          );

        return (
          total +
          Math.max(
            amount -
              applied,
            0
          )
        );
      },
      0
    )
  );
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