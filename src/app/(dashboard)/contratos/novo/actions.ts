"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  addMonthsClamped,
  isValidDateOnly,
} from "@/app/lib/date-utils";

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

  installmentValues?: number[];

  /*
   * Datas de vencimento de cada parcela ("YYYY-MM-DD").
   * Quando ausente, cai no cálculo mensal a partir de
   * firstDueDate (compatibilidade).
   */
  installmentDues?: string[];

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
  input:
    CreateContractInput
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
   * VALIDAÇÕES BÁSICAS
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

  /*
   * Escopo de empresa: o company_id vem do formulário, então
   * confirma que o usuário realmente tem vínculo com essa
   * empresa antes de criar o contrato (admin sempre passa).
   */
  await requireCompanyAccess(
    input.companyId
  );

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
   * VALIDAR PARCELAS
   * =====================================================
   */

  let validatedInstallmentValues:
    number[];

  if (
    input.installmentValues &&
    input.installmentValues.length >
      0
  ) {
    if (
      input.installmentValues.length !==
      input.installments
    ) {
      return {
        success: false,

        error:
          "A quantidade de valores não corresponde à quantidade de parcelas.",
      };
    }

    validatedInstallmentValues =
      input.installmentValues.map(
        (
          amount
        ) =>
          roundMoney(
            Number(
              amount
            )
          )
      );

    const invalidInstallment =
      validatedInstallmentValues.some(
        (
          amount
        ) =>
          !Number.isFinite(
            amount
          ) ||
          amount <=
            0
      );

    if (
      invalidInstallment
    ) {
      return {
        success: false,

        error:
          "Todas as parcelas precisam possuir um valor maior que zero.",
      };
    }

    const installmentsTotal =
      roundMoney(
        validatedInstallmentValues.reduce(
          (
            total,
            amount
          ) =>
            total +
            amount,
          0
        )
      );

    if (
      Math.abs(
        installmentsTotal -
          roundMoney(
            input.value
          )
      ) >=
      0.01
    ) {
      return {
        success: false,

        error:
          "A soma das parcelas precisa ser igual ao valor do contrato.",
      };
    }
  } else {
    /*
     * Compatibilidade com chamadas
     * que ainda não enviem os valores
     * individuais das parcelas.
     */

    validatedInstallmentValues =
      distributeAmount(
        input.value,
        input.installments
      );
  }

  /*
   * =====================================================
   * VALIDAR DATAS DAS PARCELAS
   * =====================================================
   */

  let validatedInstallmentDues:
    string[];

  if (
    input.installmentDues &&
    input.installmentDues.length > 0
  ) {
    if (
      input.installmentDues.length !==
      input.installments
    ) {
      return {
        success: false,

        error:
          "A quantidade de datas não corresponde à quantidade de parcelas.",
      };
    }

    const invalidDue =
      input.installmentDues.some(
        (due) => !isValidDateOnly(due)
      );

    if (invalidDue) {
      return {
        success: false,

        error:
          "Há uma data de parcela inválida.",
      };
    }

    validatedInstallmentDues =
      input.installmentDues.slice();
  } else {
    validatedInstallmentDues =
      Array.from(
        {
          length: input.installments,
        },
        (_, index) =>
          addMonthsClamped(
            input.firstDueDate,
            index
          )
      );
  }

  /*
   * =====================================================
   * EMPRESA
   * =====================================================
   */

  const {
    data:
      company,
    error:
      companyError,
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
    data:
      client,
    error:
      clientError,
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
   * CONFIGURAÇÃO PADRÃO DE COMISSÃO
   * =====================================================
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

  const sellerDefaultPercentage =
    Number(
      responsibleSetting
        .commission_percentage ??
        0
    );

  if (
    !Number.isFinite(
      sellerDefaultPercentage
    ) ||
    sellerDefaultPercentage <
      0 ||
    sellerDefaultPercentage >
      100
  ) {
    return {
      success: false,

      error:
        "O percentual padrão de comissão do usuário é inválido.",
    };
  }

  /*
   * =====================================================
   * PRODUTO / COMISSÃO
   * =====================================================
   *
   * REGRA:
   *
   * Sem produto
   * → comissão padrão do vendedor.
   *
   * Produto com NULL
   * → comissão padrão do vendedor.
   *
   * Produto com 0
   * → não gera comissão principal.
   *
   * Produto com percentual
   * → usa percentual do produto.
   */

  let validatedProductId:
    string | null =
    null;

  let productName:
    string | null =
    null;

  let commissionPercentage =
    sellerDefaultPercentage;

  if (
    input.productId
  ) {
    const {
      data:
        product,
      error:
        productError,
    } =
      await supabase
        .from(
          "products"
        )
        .select(`
          id,
          company_id,
          name,
          commission_percentage,
          active
        `)
        .eq(
          "id",
          input.productId
        )
        .eq(
          "company_id",
          input.companyId
        )
        .maybeSingle();

    if (
      productError ||
      !product ||
      !product.active
    ) {
      return {
        success: false,

        error:
          "Produto ou serviço inválido.",
      };
    }

    validatedProductId =
      product.id;

    productName =
      product.name;

    if (
      product
        .commission_percentage !==
      null
    ) {
      commissionPercentage =
        Number(
          product
            .commission_percentage
        );
    }
  }

  if (
    !Number.isFinite(
      commissionPercentage
    ) ||
    commissionPercentage <
      0 ||
    commissionPercentage >
      100
  ) {
    return {
      success: false,

      error:
        "Percentual de comissão inválido.",
    };
  }

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
        data:
          validTvs,
        error:
          tvError,
      } =
        await supabase
          .from(
            "pottencializa_tvs"
          )
          .select(`
            id
          `)
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
        "Forma de pagamento inválida.",
    };
  }

  /*
   * =====================================================
   * CRIAR CONTRATO
   * =====================================================
   *
   * IMPORTANTE:
   *
   * O contrato NÃO recebe nenhuma
   * informação sobre edição.
   *
   * O vínculo com jornal/caderno/
   * posição será feito posteriormente,
   * dentro da edição.
   */

  const {
    data:
      contract,
    error:
      contractError,
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
          validatedProductId,

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
        id
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
   * COMISSÕES
   * =====================================================
   */

  const commissionRows: {
    contract_id:
      string;

    beneficiary_user_id:
      string;

    source_user_id:
      string;

    percentage:
      number;

    base_amount:
      number;

    amount:
      number;

    amount_released:
      number;

    amount_paid:
      number;

    status:
      string;

    paid_at:
      string | null;
  }[] =
    [];

  /*
   * COMISSÃO PRINCIPAL
   */

  if (
    commissionPercentage >
      0 &&
    commissionAmount >
      0
  ) {
    commissionRows.push({
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
   * OVERRIDES
   * =====================================================
   */

  const {
    data:
      overrideRules,
    error:
      overrideRulesError,
  } =
    await supabase
      .from(
        "seller_override_rules"
      )
      .select(`
        beneficiary_user_id,
        percentage
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
      "Erro ao carregar overrides:",
      overrideRulesError
    );

    await rollbackContract(
      supabase,
      contract.id
    );

    return {
      success: false,

      error:
        "Não foi possível consultar as regras adicionais de comissão.",
    };
  }

  for (
    const rule of
      overrideRules ??
      []
  ) {
    const percentage =
      Number(
        rule.percentage ??
          0
      );

    if (
      !Number.isFinite(
        percentage
      ) ||
      percentage <=
        0 ||
      rule
        .beneficiary_user_id ===
        responsibleUserId
    ) {
      continue;
    }

    const amount =
      roundMoney(
        input.value *
          (
            percentage /
            100
          )
      );

    if (
      amount <=
      0
    ) {
      continue;
    }

    commissionRows.push({
      contract_id:
        contract.id,

      beneficiary_user_id:
        rule
          .beneficiary_user_id,

      source_user_id:
        responsibleUserId,

      percentage,

      base_amount:
        input.value,

      amount,

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
   * GRAVAR COMISSÕES
   * =====================================================
   */

  if (
    commissionRows.length >
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
          commissionRows
        );

    if (
      commissionError
    ) {
      console.error(
        "Erro ao gerar comissões:",
        commissionError
      );

      await rollbackContract(
        supabase,
        contract.id
      );

      return {
        success: false,

        error:
          commissionError.message,
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
          tvLinkError.message,
      };
    }
  }

  /*
   * =====================================================
   * FINANCEIRO / PARCELAS
   * =====================================================
   */

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

  try {
    for (
      let index =
        0;
      index <
      input.installments;
      index++
    ) {
      const installmentNumber =
        index +
        1;

      const dueDate =
        validatedInstallmentDues[
          index
        ];

      const amount =
        validatedInstallmentValues[
          index
        ];

      const financialStatus =
        dueDate <
        today
          ? "overdue"
          : "pending";

      /*
       * FINANCEIRO
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
              validatedProductId,

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
              [
                `Parcela ${installmentNumber}/${input.installments} do contrato ${contract.id}.`,

                `Forma de pagamento: ${paymentMethod.name}.`,

                productName
                  ? `Produto/serviço: ${productName}.`
                  : null,
              ]
                .filter(
                  Boolean
                )
                .join(
                  " "
                ),
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
       * PARCELA DO CONTRATO
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
  } catch (
    error
  ) {
    console.error(
      "Erro ao gerar parcelas:",
      error
    );

    /*
     * Limpa financeiro criado
     * antes do rollback.
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
    `/contratos/${contract.id}`
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
  contractId:
    string
) {
  /*
   * TVs
   */

  const {
    error:
      tvError,
  } =
    await supabase
      .from(
        "contract_tvs"
      )
      .delete()
      .eq(
        "contract_id",
        contractId
      );

  if (
    tvError
  ) {
    console.error(
      "Erro ao limpar TVs no rollback:",
      tvError
    );
  }

  /*
   * COMISSÕES
   */

  const {
    error:
      commissionError,
  } =
    await supabase
      .from(
        "contract_commissions"
      )
      .delete()
      .eq(
        "contract_id",
        contractId
      );

  if (
    commissionError
  ) {
    console.error(
      "Erro ao limpar comissões no rollback:",
      commissionError
    );
  }

  /*
   * PARCELAS
   */

  const {
    error:
      installmentError,
  } =
    await supabase
      .from(
        "contract_installments"
      )
      .delete()
      .eq(
        "contract_id",
        contractId
      );

  if (
    installmentError
  ) {
    console.error(
      "Erro ao limpar parcelas no rollback:",
      installmentError
    );
  }

  /*
   * CONTRATO
   */

  const {
    error:
      contractError,
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
    contractError
  ) {
    console.error(
      "Erro ao remover contrato no rollback:",
      contractError
    );
  }
}

/*
 * =====================================================
 * DISTRIBUIR VALOR DAS PARCELAS
 * =====================================================
 */

function distributeAmount(
  total:
    number,
  installments:
    number
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
 * ARREDONDAMENTO
 * =====================================================
 */

function roundMoney(
  value:
    number
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