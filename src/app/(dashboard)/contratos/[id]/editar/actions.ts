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

type UpdateContractInput = {
  contractId: string;

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

  firstDueDate: string;

  installmentValues?: number[];

  installmentDues?: string[];

  scheduleTouched?: boolean;

  autoRenew: boolean;

  tvIds?: string[];

  notes?:
    | string
    | null;
};

function parseDateOnly(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

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
    String(year)
      .padStart(4, "0"),

    String(month)
      .padStart(2, "0"),

    String(day)
      .padStart(2, "0"),
  ].join("-");
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
    parseDateOnly(date);

  const monthIndex =
    month -
    1 +
    monthsToAdd;

  const targetYear =
    year +
    Math.floor(
      monthIndex /
        12
    );

  const normalizedMonth =
    ((monthIndex %
      12) +
      12) %
    12;

  const targetMonth =
    normalizedMonth +
    1;

  const maxDay =
    getDaysInMonth(
      targetYear,
      targetMonth
    );

  return formatDateOnly(
    targetYear,
    targetMonth,
    Math.min(
      day,
      maxDay
    )
  );
}

function distributeAmount(
  total: number,
  installments: number
) {
  const cents =
    Math.round(
      total * 100
    );

  const base =
    Math.floor(
      cents /
        installments
    );

  const remainder =
    cents %
    installments;

  return Array.from(
    {
      length:
        installments,
    },
    (_, index) =>
      (
        base +
        (index <
        remainder
          ? 1
          : 0)
      ) / 100
  );
}

export async function updateContract(
  input: UpdateContractInput
) {
  await requireModulePermission(
    "contracts",
    "edit"
  );

  const supabase =
    await createClient();

  /*
   * =========================
   * VALIDAÇÕES
   * =========================
   */

  if (
    !input.contractId ||
    !input.clientId ||
    !input.companyId
  ) {
    return {
      success: false,
      error:
        "Dados obrigatórios não informados.",
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
    !input.startDate ||
    !input.firstDueDate
  ) {
    return {
      success: false,
      error:
        "Informe as datas obrigatórias.",
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
    !Number.isFinite(
      input.value
    ) ||
    input.value <= 0
  ) {
    return {
      success: false,
      error:
        "Informe um valor válido.",
    };
  }

  if (
    !Number.isInteger(
      input.installments
    ) ||
    input.installments < 1
  ) {
    return {
      success: false,
      error:
        "Quantidade de parcelas inválida.",
    };
  }

  /*
   * =========================
   * CONTRATO ATUAL
   * =========================
   */

  const {
    data: currentContract,
    error: currentError,
  } =
    await supabase
      .from(
        "contracts"
      )
      .select(`
        id,
        client_id,
        company_id,
        product_id,
        value,
        installments,
        first_due_date
      `)
      .eq(
        "id",
        input.contractId
      )
      .maybeSingle();

  if (
    currentError ||
    !currentContract
  ) {
    return {
      success: false,
      error:
        "Contrato não encontrado.",
    };
  }

  /*
   * Escopo de empresa: o usuário precisa ter acesso à empresa
   * atual do contrato (impede editar contrato de outra empresa
   * trocando o id) e, se estiver movendo o contrato para outra
   * empresa, também à empresa de destino.
   */
  await requireCompanyAccess(
    currentContract.company_id
  );

  if (
    input.companyId !==
    currentContract.company_id
  ) {
    await requireCompanyAccess(
      input.companyId
    );
  }

  /*
   * =========================
   * VALIDAR TVs
   * =========================
   */

  let validTvIds:
    string[] = [];

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

      if (tvError) {
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
          (tv) =>
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
   * =========================
   * MOVIMENTAÇÃO FINANCEIRA
   * =========================
   */

  const {
    data: financialEntries,
    error: financialError,
  } =
    await supabase
      .from(
        "financial_entries"
      )
      .select(`
        id,
        amount_paid
      `)
      .eq(
        "contract_id",
        input.contractId
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

  const hasPayments =
    (
      financialEntries ??
      []
    ).some(
      (entry) =>
        Number(
          entry.amount_paid
        ) > 0
    );

  /*
   * =========================
   * ALTERAÇÃO FINANCEIRA
   * =========================
   */

  const financialChanged =
    Number(
      currentContract.value
    ) !==
      Number(
        input.value
      ) ||
    Number(
      currentContract.installments ??
        1
    ) !==
      input.installments ||
    (
      currentContract.first_due_date ??
      ""
    ) !==
      input.firstDueDate ||
    input.scheduleTouched === true;

  /*
   * =========================
   * VALIDAR CARNÊ RECEBIDO
   * =========================
   */

  const useCustomSchedule =
    Array.isArray(
      input.installmentDues
    ) &&
    input.installmentDues.length ===
      input.installments &&
    Array.isArray(
      input.installmentValues
    ) &&
    input.installmentValues.length ===
      input.installments;

  if (useCustomSchedule) {
    const invalidDue =
      input.installmentDues!.some(
        (due) => !isValidDateOnly(due)
      );

    const invalidAmount =
      input.installmentValues!.some(
        (amount) =>
          !Number.isFinite(amount) ||
          amount <= 0
      );

    const sum =
      input.installmentValues!.reduce(
        (total, amount) =>
          total + amount,
        0
      );

    if (
      invalidDue ||
      invalidAmount ||
      Math.abs(
        sum - Number(input.value)
      ) >= 0.01
    ) {
      return {
        success: false,
        error:
          "As parcelas informadas estão inconsistentes (datas, valores ou soma).",
      };
    }
  }

  if (
    hasPayments &&
    financialChanged
  ) {
    return {
      success: false,
      error:
        "Este contrato já possui pagamentos registrados. Valor, parcelas e primeiro vencimento não podem ser alterados sem antes ajustar o financeiro.",
    };
  }

  /*
   * =========================
   * ATUALIZAR CONTRATO
   * =========================
   */

  const {
    error: updateError,
  } =
    await supabase
      .from(
        "contracts"
      )
      .update({
        client_id:
          input.clientId,

        company_id:
          input.companyId,

        product_id:
          input.productId ||
          null,

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

        payment_method_id:
          input.paymentMethodId,

        installments:
          input.installments,

        first_due_date:
          input.firstDueDate,

        auto_renew:
          input.autoRenew,

        notes:
          input.notes
            ?.trim() ||
          null,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        input.contractId
      );

  if (
    updateError
  ) {
    return {
      success: false,
      error:
        updateError.message,
    };
  }

  /*
   * =========================
   * SINCRONIZAR TVs
   * =========================
   *
   * Estratégia:
   *
   * 1. Remove todos os vínculos
   *    atuais do contrato.
   *
   * 2. Se continuar sendo
   *    Pottencializa, cria
   *    novamente os vínculos
   *    selecionados.
   *
   * Isso também resolve quando
   * o contrato deixa de ser
   * Pottencializa.
   */

  const {
    error:
      deleteTvLinksError,
  } =
    await supabase
      .from(
        "contract_tvs"
      )
      .delete()
      .eq(
        "contract_id",
        input.contractId
      );

  if (
    deleteTvLinksError
  ) {
    console.error(
      "Erro ao remover vínculos antigos de TVs:",
      deleteTvLinksError
    );

    return {
      success: false,
      error:
        `O contrato foi atualizado, mas não foi possível atualizar as TVs: ${deleteTvLinksError.message}`,
    };
  }

  if (
    input.companyId ===
      POTTENCIALIZA_COMPANY_ID &&
    validTvIds.length > 0
  ) {
    const {
      error:
        insertTvLinksError,
    } =
      await supabase
        .from(
          "contract_tvs"
        )
        .insert(
          validTvIds.map(
            (tvId) => ({
              contract_id:
                input.contractId,

              tv_id:
                tvId,
            })
          )
        );

    if (
      insertTvLinksError
    ) {
      console.error(
        "Erro ao vincular TVs:",
        insertTvLinksError
      );

      return {
        success: false,
        error:
          `O contrato foi atualizado, mas houve erro ao salvar as TVs: ${insertTvLinksError.message}`,
      };
    }
  }

  /*
   * =========================
   * RECRIAR FINANCEIRO
   * =========================
   *
   * Somente quando as condições
   * financeiras mudaram e ainda
   * não existe pagamento.
   */

  if (
    financialChanged &&
    !hasPayments
  ) {
    /*
     * Primeiro removemos as
     * parcelas auxiliares.
     */

    const {
      error:
        installmentDeleteError,
    } =
      await supabase
        .from(
          "contract_installments"
        )
        .delete()
        .eq(
          "contract_id",
          input.contractId
        );

    if (
      installmentDeleteError
    ) {
      return {
        success: false,
        error:
          installmentDeleteError.message,
      };
    }

    /*
     * Depois removemos as contas
     * a receber antigas.
     */

    const {
      error:
        financialDeleteError,
    } =
      await supabase
        .from(
          "financial_entries"
        )
        .delete()
        .eq(
          "contract_id",
          input.contractId
        );

    if (
      financialDeleteError
    ) {
      return {
        success: false,
        error:
          financialDeleteError.message,
      };
    }

    const amounts =
      useCustomSchedule
        ? input.installmentValues!
        : distributeAmount(
            input.value,
            input.installments
          );

    const dueDates =
      useCustomSchedule
        ? input.installmentDues!
        : Array.from(
            {
              length:
                input.installments,
            },
            (_, index) =>
              addMonthsClamped(
                input.firstDueDate,
                index
              )
          );

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    for (
      let index = 0;
      index <
      input.installments;
      index++
    ) {
      const installmentNumber =
        index + 1;

      const dueDate =
        dueDates[index];

      const amount =
        amounts[
          index
        ];

      const status =
        dueDate < today
          ? "overdue"
          : "pending";

      const {
        data:
          financialEntry,
        error:
          insertFinancialError,
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
              input.contractId,

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

            status,

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
              `Parcela ${installmentNumber}/${input.installments} do contrato ${input.contractId}.`,
          })
          .select(
            "id"
          )
          .single();

      if (
        insertFinancialError ||
        !financialEntry
      ) {
        return {
          success: false,
          error:
            insertFinancialError
              ?.message ??
            "Erro ao recriar financeiro.",
        };
      }

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
              input.contractId,

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
        return {
          success: false,
          error:
            installmentError.message,
        };
      }
    }
  }

  /*
   * =========================
   * REVALIDAR
   * =========================
   */

  revalidatePath(
    `/contratos/${input.contractId}`
  );

  revalidatePath(
    `/contratos/${input.contractId}/editar`
  );

  revalidatePath(
    `/clientes/${input.clientId}`
  );

  revalidatePath(
    "/contratos"
  );

  revalidatePath(
    "/financeiro"
  );

  revalidatePath(
    "/financeiro/receber"
  );

  return {
    success: true,
  };
}