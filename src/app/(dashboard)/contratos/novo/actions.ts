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

const POTTENCIALIZA_COMPANY_ID =
  "9d08d74c-c5fe-48c9-b0c5-382cea273d99";

type BillingFrequency =
  | "one_time"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "custom";

type CreateContractInput = {
  clientId: string;

  companyId: string;

  productId?:
    | string
    | null;

  /*
   * NÃO recebemos mais
   * responsibleUserId.
   *
   * O responsável será sempre
   * o usuário autenticado.
   */

  title: string;

  startDate: string;

  endDate?:
    | string
    | null;

  value: number;

  billingFrequency:
    BillingFrequency;

  paymentMethodId: string;

  installments: number;

  firstDueDate: string;

  autoRenew: boolean;

  tvIds?: string[];

  notes?:
    | string
    | null;
};

/*
 * =====================================================
 * CRIAR CONTRATO
 * =====================================================
 */

export async function createContract(
  input: CreateContractInput
) {
  await requireModulePermission(
    "contracts",
    "create"
  );

  const supabase =
    await createClient();

  /*
   * =====================================================
   * USUÁRIO AUTENTICADO
   * =====================================================
   *
   * IMPORTANTE:
   *
   * O responsável pelo contrato
   * NÃO vem do frontend.
   *
   * Mesmo que alguém tente alterar
   * a requisição manualmente,
   * o servidor utilizará sempre
   * o usuário autenticado.
   */

  const {
    data: {
      user,
    },
    error:
      userError,
  } =
    await supabase.auth
      .getUser();

  if (
    userError ||
    !user
  ) {
    return {
      success: false,
      error:
        "Usuário não autenticado.",
    };
  }

  const responsibleUserId =
    user.id;

  /*
   * =====================================================
   * VALIDAÇÕES
   * =====================================================
   */

  if (
    !input.clientId
  ) {
    return {
      success: false,
      error:
        "Selecione um cliente.",
    };
  }

  if (
    !input.companyId
  ) {
    return {
      success: false,
      error:
        "Selecione uma empresa.",
    };
  }

  if (
    !input.title.trim()
  ) {
    return {
      success: false,
      error:
        "Informe o título do contrato.",
    };
  }

  if (
    !input.startDate
  ) {
    return {
      success: false,
      error:
        "Informe a data de início.",
    };
  }

  if (
    !input.firstDueDate
  ) {
    return {
      success: false,
      error:
        "Informe o primeiro vencimento.",
    };
  }

  if (
    !input.paymentMethodId
  ) {
    return {
      success: false,
      error:
        "Selecione a forma de pagamento.",
    };
  }

  if (
    !Number.isInteger(
      input.installments
    ) ||
    input.installments <
      1
  ) {
    return {
      success: false,
      error:
        "Informe uma quantidade válida de parcelas.",
    };
  }

  if (
    !Number.isFinite(
      input.value
    ) ||
    input.value <=
      0
  ) {
    return {
      success: false,
      error:
        "Informe um valor válido.",
    };
  }

  /*
   * =====================================================
   * EMPRESA
   * =====================================================
   */

  const {
    data: company,
    error: companyError,
  } =
    await supabase
      .from(
        "companies"
      )
      .select(`
        id,
        name,
        active
      `)
      .eq(
        "id",
        input.companyId
      )
      .maybeSingle();

  if (
    companyError ||
    !company ||
    !company.active
  ) {
    return {
      success: false,
      error:
        "Empresa inválida ou inativa.",
    };
  }

  /*
   * =====================================================
   * CLIENTE
   * =====================================================
   */

  const {
    data: client,
    error: clientError,
  } =
    await supabase
      .from(
        "clients"
      )
      .select(`
        id,
        name,
        active
      `)
      .eq(
        "id",
        input.clientId
      )
      .maybeSingle();

  if (
    clientError ||
    !client ||
    client.active ===
      false
  ) {
    return {
      success: false,
      error:
        "Cliente inválido ou inativo.",
    };
  }

  /*
   * =====================================================
   * RESPONSÁVEL / COMISSÃO
   * =====================================================
   *
   * O responsável é o usuário
   * autenticado.
   *
   * O percentual vem da
   * seller_settings da empresa.
   */

  const {
    data:
      responsibleSetting,
    error:
      responsibleSettingError,
  } =
    await supabase
      .from(
        "seller_settings"
      )
      .select(`
        user_id,
        company_id,
        active,
        commission_percentage
      `)
      .eq(
        "user_id",
        responsibleUserId
      )
      .eq(
        "company_id",
        input.companyId
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  /*
   * Para criar contrato com comissão,
   * o usuário precisa estar configurado
   * como vendedor/responsável naquela
   * empresa.
   */

  if (
    responsibleSettingError ||
    !responsibleSetting
  ) {
    return {
      success: false,
      error:
        "Seu usuário não está configurado para receber comissão nesta empresa.",
    };
  }

  const commissionPercentage =
    Number(
      responsibleSetting
        .commission_percentage ??
        0
    );

  const commissionAmount =
    roundMoney(
      input.value *
        (
          commissionPercentage /
          100
        )
    );

  /*
   * =====================================================
   * VALIDAR TVs
   * =====================================================
   */

  let validTvIds:
    string[] =
    [];

  if (
    input.companyId ===
    POTTENCIALIZA_COMPANY_ID
  ) {
    const requestedTvIds =
      [
        ...new Set(
          input.tvIds ??
            []
        ),
      ];

    if (
      requestedTvIds.length >
      0
    ) {
      const {
        data: validTvs,
        error: tvError,
      } =
        await supabase
          .from(
            "pottencializa_tvs"
          )
          .select(
            "id"
          )
          .eq(
            "company_id",
            POTTENCIALIZA_COMPANY_ID
          )
          .eq(
            "active",
            true
          )
          .in(
            "id",
            requestedTvIds
          );

      if (
        tvError
      ) {
        console.error(
          "Erro ao validar TVs:",
          tvError
        );

        return {
          success: false,
          error:
            "Não foi possível validar as TVs selecionadas.",
        };
      }

      validTvIds =
        (
          validTvs ??
          []
        ).map(
          (
            tv
          ) =>
            tv.id
        );

      if (
        validTvIds.length !==
        requestedTvIds.length
      ) {
        return {
          success: false,
          error:
            "Uma ou mais TVs selecionadas são inválidas ou estão inativas.",
        };
      }
    }
  }

  /*
   * =====================================================
   * FORMA DE PAGAMENTO
   * =====================================================
   */

  const {
    data:
      paymentMethod,
    error:
      paymentMethodError,
  } =
    await supabase
      .from(
        "payment_methods"
      )
      .select(`
        id,
        name,
        code,
        active
      `)
      .eq(
        "id",
        input.paymentMethodId
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  if (
    paymentMethodError ||
    !paymentMethod
  ) {
    return {
      success: false,
      error:
        "Forma de pagamento inválida ou inativa.",
    };
  }

  /*
   * =====================================================
   * CRIAR CONTRATO
   * =====================================================
   */

  const {
    data: contract,
    error: contractError,
  } =
    await supabase
      .from(
        "contracts"
      )
      .insert({
        client_id:
          input.clientId,

        company_id:
          input.companyId,

        product_id:
          input.productId ||
          null,

        /*
         * Sempre o usuário autenticado.
         */

        responsible_user_id:
          responsibleUserId,

        title:
          input.title.trim(),

        start_date:
          input.startDate,

        end_date:
          input.endDate ||
          null,

        value:
          input.value,

        billing_frequency:
          input.billingFrequency,

        status:
          "active",

        auto_renew:
          input.autoRenew,

        payment_method_id:
          input.paymentMethodId,

        installments:
          input.installments,

        first_due_date:
          input.firstDueDate,

        notes:
          input.notes
            ?.trim() ||
          null,
      })
      .select(`
        id,
        client_id,
        company_id,
        product_id,
        responsible_user_id,
        title,
        start_date,
        end_date,
        value,
        billing_frequency,
        status,
        payment_method_id,
        installments,
        first_due_date
      `)
      .single();

  if (
    contractError ||
    !contract
  ) {
    console.error(
      "Erro ao criar contrato:",
      contractError
    );

    return {
      success: false,

      error:
        contractError
          ?.message ??
        "Não foi possível criar o contrato.",
    };
  }

  /*
   * =====================================================
   * COMISSÕES DO CONTRATO
   * =====================================================
   *
   * Pode gerar:
   *
   * 1. comissão principal do usuário;
   * 2. overrides configurados sobre ele.
   */

  const contractCommissionRows: {
    contract_id: string;
    beneficiary_user_id: string;
    source_user_id: string;
    percentage: number;
    base_amount: number;
    amount: number;
    amount_released: number;
    amount_paid: number;
    status:
      | "pending"
      | "generated"
      | "paid"
      | "cancelled";
    paid_at: string | null;
  }[] = [];

  /*
   * =====================================================
   * COMISSÃO PRINCIPAL
   * =====================================================
   */

  if (
    commissionPercentage >
      0 &&
    commissionAmount >
      0
  ) {
    contractCommissionRows.push({
      contract_id:
        contract.id,

      beneficiary_user_id:
        responsibleUserId,

      source_user_id:
        responsibleUserId,

      percentage:
        commissionPercentage,

      base_amount:
        input.value,

      amount:
        commissionAmount,

      amount_released:
        0,

      amount_paid:
        0,

      status:
        "pending",

      paid_at:
        null,
    });
  }

  /*
   * =====================================================
   * REGRAS DE OVERRIDE
   * =====================================================
   */

  const {
    data: overrideRules,
    error:
      overrideRulesError,
  } =
    await supabase
      .from(
        "seller_override_rules"
      )
      .select(`
        id,
        beneficiary_user_id,
        source_user_id,
        percentage,
        active
      `)
      .eq(
        "company_id",
        input.companyId
      )
      .eq(
        "source_user_id",
        responsibleUserId
      )
      .eq(
        "active",
        true
      );

  if (
    overrideRulesError
  ) {
    console.error(
      "Erro ao buscar regras adicionais de comissão:",
      overrideRulesError
    );

    await rollbackContract(
      supabase,
      contract.id
    );

    return {
      success: false,

      error:
        `Não foi possível consultar as regras adicionais de comissão: ${overrideRulesError.message}`,
    };
  }

  /*
   * =====================================================
   * GERAR OVERRIDES
   * =====================================================
   */

  for (
    const rule of
      overrideRules ??
      []
  ) {
    const overridePercentage =
      Number(
        rule.percentage ??
          0
      );

    if (
      !Number.isFinite(
        overridePercentage
      ) ||
      overridePercentage <=
        0
    ) {
      continue;
    }

    /*
     * Não permite comissão adicional
     * para a própria origem.
     */

    if (
      rule.beneficiary_user_id ===
      responsibleUserId
    ) {
      continue;
    }

    const overrideAmount =
      roundMoney(
        input.value *
          (
            overridePercentage /
            100
          )
      );

    if (
      overrideAmount <=
      0
    ) {
      continue;
    }

    contractCommissionRows.push({
      contract_id:
        contract.id,

      beneficiary_user_id:
        rule.beneficiary_user_id,

      source_user_id:
        responsibleUserId,

      percentage:
        overridePercentage,

      base_amount:
        input.value,

      amount:
        overrideAmount,

      amount_released:
        0,

      amount_paid:
        0,

      status:
        "pending",

      paid_at:
        null,
    });
  }

  /*
   * =====================================================
   * GRAVAR TODAS AS COMISSÕES
   * =====================================================
   */

  if (
    contractCommissionRows.length >
    0
  ) {
    const {
      error:
        commissionError,
    } =
      await supabase
        .from(
          "contract_commissions"
        )
        .insert(
          contractCommissionRows
        );

    if (
      commissionError
    ) {
      console.error(
        "Erro ao gerar comissões do contrato:",
        commissionError
      );

      /*
       * Ao remover o contrato,
       * contract_commissions também
       * será removida por CASCADE.
       */

      await rollbackContract(
        supabase,
        contract.id
      );

      return {
        success: false,

        error:
          `Não foi possível gerar as comissões do contrato: ${commissionError.message}`,
      };
    }
  }

  /*
   * =====================================================
   * VINCULAR TVs
   * =====================================================
   */

  if (
    input.companyId ===
      POTTENCIALIZA_COMPANY_ID &&
    validTvIds.length >
      0
  ) {
    const {
      error:
        tvLinkError,
    } =
      await supabase
        .from(
          "contract_tvs"
        )
        .insert(
          validTvIds.map(
            (
              tvId
            ) => ({
              contract_id:
                contract.id,

              tv_id:
                tvId,
            })
          )
        );

    if (
      tvLinkError
    ) {
      console.error(
        "Erro ao vincular TVs:",
        tvLinkError
      );

      await rollbackContract(
        supabase,
        contract.id
      );

      return {
        success: false,

        error:
          `Não foi possível vincular as TVs ao contrato: ${tvLinkError.message}`,
      };
    }
  }

  /*
   * =====================================================
   * GERAR PARCELAS
   * =====================================================
   */

  const installmentValues =
    distributeAmount(
      input.value,
      input.installments
    );

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

  try {
    for (
      let index = 0;
      index <
      input.installments;
      index++
    ) {
      const installmentNumber =
        index + 1;

      const dueDate =
        addMonthsClamped(
          input.firstDueDate,
          index
        );

      const amount =
        installmentValues[
          index
        ];

      const financialStatus =
        dueDate <
        today
          ? "overdue"
          : "pending";

      /*
       * =====================================
       * FINANCEIRO
       * =====================================
       */

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
              "income",

            client_id:
              input.clientId,

            supplier_id:
              null,

            contract_id:
              contract.id,

            product_id:
              input.productId ||
              null,

            category_id:
              null,

            cost_center_id:
              null,

            financial_account_id:
              null,

            description:
              `${input.title.trim()} - Parcela ${installmentNumber}/${input.installments}`,

            document_number:
              null,

            competence_date:
              input.startDate,

            issue_date:
              today,

            due_date:
              dueDate,

            amount,

            amount_paid:
              0,

            interest:
              0,

            fine:
              0,

            discount:
              0,

            status:
              financialStatus,

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
              `Parcela ${installmentNumber}/${input.installments} do contrato ${contract.id}. Forma de pagamento: ${paymentMethod.name}.`,
          })
          .select(`
            id
          `)
          .single();

      if (
        financialError ||
        !financialEntry
      ) {
        throw new Error(
          financialError
            ?.message ??
            `Erro ao gerar a parcela ${installmentNumber}.`
        );
      }

      /*
       * =====================================
       * PARCELA DO CONTRATO
       * =====================================
       */

      const {
        error:
          installmentError,
      } =
        await supabase
          .from(
            "contract_installments"
          )
          .insert({
            contract_id:
              contract.id,

            installment_number:
              installmentNumber,

            due_date:
              dueDate,

            amount,

            financial_entry_id:
              financialEntry.id,
          });

      if (
        installmentError
      ) {
        throw new Error(
          installmentError.message
        );
      }
    }
  } catch (error) {
    console.error(
      "Erro ao gerar parcelas do contrato:",
      error
    );

    /*
     * Limpa lançamentos financeiros.
     */

    const {
      error:
        financialCleanupError,
    } =
      await supabase
        .from(
          "financial_entries"
        )
        .delete()
        .eq(
          "contract_id",
          contract.id
        );

    if (
      financialCleanupError
    ) {
      console.error(
        "Erro ao limpar financeiro:",
        financialCleanupError
      );
    }

    /*
     * Ao apagar o contrato:
     *
     * - parcelas são removidas;
     * - contract_commissions são removidas;
     * - contract_tvs são removidas;
     *
     * conforme as FKs configuradas.
     */

    await rollbackContract(
      supabase,
      contract.id
    );

    return {
      success: false,

      error:
        error instanceof
        Error
          ? `Não foi possível concluir o contrato: ${error.message}`
          : "Não foi possível gerar as parcelas do contrato.",
    };
  }

  /*
   * =====================================================
   * REVALIDAÇÃO
   * =====================================================
   */

  revalidatePath(
    "/contratos"
  );

  revalidatePath(
    `/clientes/${input.clientId}`
  );

  revalidatePath(
    "/financeiro"
  );

  revalidatePath(
    "/financeiro/receber"
  );

  revalidatePath(
    "/comissoes"
  );

  return {
    success: true,

    contractId:
      contract.id,
  };
}

/*
 * =====================================================
 * ROLLBACK
 * =====================================================
 */

async function rollbackContract(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  contractId: string
) {
  const {
    error,
  } =
    await supabase
      .from(
        "contracts"
      )
      .delete()
      .eq(
        "id",
        contractId
      );

  if (
    error
  ) {
    console.error(
      "Erro ao remover contrato no rollback:",
      error
    );
  }
}

/*
 * =====================================================
 * DATAS
 * =====================================================
 */

function parseDateOnly(
  value: string
) {
  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(
        Number
      );

  return {
    year,
    month,
    day,
  };
}

function formatDateOnly(
  year: number,
  month: number,
  day: number
) {
  return [
    String(
      year
    ).padStart(
      4,
      "0"
    ),

    String(
      month
    ).padStart(
      2,
      "0"
    ),

    String(
      day
    ).padStart(
      2,
      "0"
    ),
  ].join(
    "-"
  );
}

function getDaysInMonth(
  year: number,
  month: number
) {
  return new Date(
    year,
    month,
    0
  ).getDate();
}

function addMonthsClamped(
  date: string,
  monthsToAdd: number
) {
  const {
    year,
    month,
    day,
  } =
    parseDateOnly(
      date
    );

  const baseMonthIndex =
    month -
    1;

  const targetMonthIndex =
    baseMonthIndex +
    monthsToAdd;

  const targetYear =
    year +
    Math.floor(
      targetMonthIndex /
        12
    );

  const normalizedMonthIndex =
    (
      (
        targetMonthIndex %
        12
      ) +
      12
    ) %
    12;

  const targetMonth =
    normalizedMonthIndex +
    1;

  const lastDay =
    getDaysInMonth(
      targetYear,
      targetMonth
    );

  const targetDay =
    Math.min(
      day,
      lastDay
    );

  return formatDateOnly(
    targetYear,
    targetMonth,
    targetDay
  );
}

/*
 * =====================================================
 * DISTRIBUIR PARCELAS
 * =====================================================
 */

function distributeAmount(
  total: number,
  installments: number
) {
  const totalInCents =
    Math.round(
      total *
        100
    );

  const base =
    Math.floor(
      totalInCents /
        installments
    );

  const remainder =
    totalInCents %
    installments;

  return Array.from(
    {
      length:
        installments,
    },
    (
      _,
      index
    ) => {
      const cents =
        base +
        (
          index <
          remainder
            ? 1
            : 0
        );

      return (
        cents /
        100
      );
    }
  );
}

/*
 * =====================================================
 * DINHEIRO
 * =====================================================
 */

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