"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  Banknote,
  Landmark,
  X,
} from "lucide-react";

import {
  createClient,
} from "@/app/lib/supabase/client";

import {
  registerFinancialTransaction,
} from "@/app/(dashboard)/financeiro/[id]/actions";

type Props = {
  entryId: string;
  type: string;
  openAmount: number;
};

type PaymentMethod = {
  id: string;
  name: string;
  code: string;

  usage_type:
    | "income"
    | "expense"
    | "both";

  active: boolean;
};

type FinancialAccount = {
  id: string;
  company_id:
    | string
    | null;

  name: string;

  type: string;

  current_balance: number;

  active: boolean;
};

export default function RegisterTransactionForm({
  entryId,
  type,
  openAmount,
}: Props) {
  const router =
    useRouter();

  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    amount,
    setAmount,
  ] =
    useState(
      formatValue(
        openAmount
      )
    );

  const [
    date,
    setDate,
  ] =
    useState(
      today()
    );

  const [
    paymentMethods,
    setPaymentMethods,
  ] =
    useState<
      PaymentMethod[]
    >([]);

  const [
    financialAccounts,
    setFinancialAccounts,
  ] =
    useState<
      FinancialAccount[]
    >([]);

  const [
    method,
    setMethod,
  ] =
    useState("");

  const [
    financialAccountId,
    setFinancialAccountId,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    loadingData,
    setLoadingData,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  /*
   * =========================
   * FORMAS COMPATÍVEIS
   * =========================
   */

  const availableMethods =
    useMemo(() => {
      return paymentMethods.filter(
        (
          paymentMethod
        ) => {
          if (
            !paymentMethod.active
          ) {
            return false;
          }

          if (
            paymentMethod.usage_type ===
            "both"
          ) {
            return true;
          }

          if (
            type ===
            "income"
          ) {
            return (
              paymentMethod.usage_type ===
              "income"
            );
          }

          return (
            paymentMethod.usage_type ===
            "expense"
          );
        }
      );
    }, [
      paymentMethods,
      type,
    ]);

  /*
   * =========================
   * CARREGAR DADOS
   * =========================
   */

  useEffect(() => {
    async function loadData() {
      setLoadingData(
        true
      );

      /*
       * Primeiro descobrimos
       * qual é a empresa do
       * lançamento.
       */

      const {
        data: entry,
        error: entryError,
      } = await supabase
        .from(
          "financial_entries"
        )
        .select(`
          id,
          company_id
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
        console.error(
          "Erro ao carregar lançamento:",
          entryError
        );

        setError(
          "Não foi possível identificar a empresa do lançamento."
        );

        setLoadingData(
          false
        );

        return;
      }

      const [
        methodsResult,
        accountsResult,
      ] =
        await Promise.all([
          supabase
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
              "active",
              true
            )
            .order(
              "name"
            ),

          supabase
            .from(
              "financial_accounts"
            )
            .select(`
              id,
              company_id,
              name,
              type,
              current_balance,
              active
            `)
            .eq(
              "company_id",
              entry.company_id
            )
            .eq(
              "active",
              true
            )
            .order(
              "name"
            ),
        ]);

      if (
        methodsResult.error
      ) {
        console.error(
          "Erro ao carregar formas de pagamento:",
          methodsResult.error
        );

        setPaymentMethods(
          []
        );
      } else {
        setPaymentMethods(
          (
            methodsResult.data ??
            []
          ) as PaymentMethod[]
        );
      }

      if (
        accountsResult.error
      ) {
        console.error(
          "Erro ao carregar contas:",
          accountsResult.error
        );

        setFinancialAccounts(
          []
        );
      } else {
        const accounts =
          (
            accountsResult.data ??
            []
          ) as FinancialAccount[];

        setFinancialAccounts(
          accounts
        );

        /*
         * Se existe somente uma
         * conta para a empresa,
         * seleciona automaticamente.
         */

        if (
          accounts.length ===
          1
        ) {
          setFinancialAccountId(
            accounts[0].id
          );
        }
      }

      setLoadingData(
        false
      );
    }

    loadData();
  }, [
    supabase,
    entryId,
  ]);

  /*
   * =========================
   * FORMA AUTOMÁTICA
   * =========================
   */

  useEffect(() => {
    const firstMethod =
      availableMethods[0];

    if (
      !availableMethods.length
    ) {
      setMethod("");

      return;
    }

    const currentStillValid =
      availableMethods.some(
        (item) =>
          item.code ===
          method
      );

    if (
      !currentStillValid
    ) {
      setMethod(
        firstMethod.code
      );
    }
  }, [
    availableMethods,
    method,
  ]);

  /*
   * =========================
   * SUBMIT
   * =========================
   */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      loading
    ) {
      return;
    }

    const numericAmount =
      parseMoney(
        amount
      );

    if (
      numericAmount <= 0 ||
      numericAmount >
        openAmount
    ) {
      setError(
        "Informe um valor válido, limitado ao saldo em aberto."
      );

      return;
    }

    if (
      !financialAccountId
    ) {
      setError(
        type ===
        "income"
          ? "Selecione a conta que recebeu o valor."
          : "Selecione a conta utilizada para o pagamento."
      );

      return;
    }

    if (
      !method
    ) {
      setError(
        type ===
        "income"
          ? "Selecione a forma de recebimento."
          : "Selecione a forma de pagamento."
      );

      return;
    }

    const selectedMethod =
      availableMethods.find(
        (item) =>
          item.code ===
          method
      );

    if (
      !selectedMethod
    ) {
      setError(
        "A forma selecionada não está disponível."
      );

      return;
    }

    setLoading(
      true
    );

    setError("");

    try {
      const result =
        await registerFinancialTransaction(
          entryId,
          {
            amount:
              numericAmount,

            date,

            paymentMethod:
              selectedMethod.code,

            financialAccountId,

            notes:
              notes.trim() ||
              undefined,
          }
        );

      if (
        !result.success
      ) {
        setError(
          result.message ??
            "Não foi possível registrar a movimentação."
        );

        return;
      }

      setOpen(
        false
      );

      setNotes("");

      router.refresh();
    } catch (error) {
      console.error(
        "Erro ao registrar movimentação:",
        error
      );

      setError(
        "Não foi possível registrar a movimentação. Tente novamente."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  function openModal() {
    setAmount(
      formatValue(
        openAmount
      )
    );

    setDate(
      today()
    );

    setNotes("");

    setError("");

    setOpen(
      true
    );
  }

  function closeModal() {
    if (
      loading
    ) {
      return;
    }

    setError("");

    setOpen(
      false
    );
  }

  if (
    !open
  ) {
    return (
      <button
        type="button"
        onClick={
          openModal
        }
        className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition ${
          type ===
          "income"
            ? "bg-[#15704f] hover:bg-[#105c41]"
            : "bg-slate-900 hover:bg-slate-800"
        }`}
      >
        <Banknote className="h-4 w-4" />

        {type ===
        "income"
          ? "Registrar recebimento"
          : "Registrar pagamento"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={
          handleSubmit
        }
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
      >
        {/* CABEÇALHO */}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {type ===
              "income"
                ? "Registrar recebimento"
                : "Registrar pagamento"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Saldo em aberto:{" "}
              {formatCurrency(
                openAmount
              )}
            </p>
          </div>

          <button
            type="button"
            disabled={
              loading
            }
            onClick={
              closeModal
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-5">
          {/* CONTA */}

          <Field
            label={
              type ===
              "income"
                ? "Receber na conta"
                : "Pagar pela conta"
            }
          >
            <div className="relative">
              <Landmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <select
                value={
                  financialAccountId
                }
                onChange={(
                  event
                ) =>
                  setFinancialAccountId(
                    event.target
                      .value
                  )
                }
                required
                disabled={
                  loading ||
                  loadingData
                }
                className="input pl-10 disabled:bg-slate-50"
              >
                <option value="">
                  {loadingData
                    ? "Carregando..."
                    : "Selecione..."}
                </option>

                {financialAccounts.map(
                  (
                    account
                  ) => (
                    <option
                      key={
                        account.id
                      }
                      value={
                        account.id
                      }
                    >
                      {account.name} —{" "}
                      {formatCurrency(
                        Number(
                          account.current_balance
                        )
                      )}
                    </option>
                  )
                )}
              </select>
            </div>

            {!loadingData &&
              !financialAccounts.length && (
                <p className="mt-2 text-xs text-amber-600">
                  Nenhuma conta financeira ativa foi encontrada para esta empresa.
                </p>
              )}
          </Field>

          {/* VALOR */}

          <Field label="Valor">
            <input
              value={
                amount
              }
              onChange={(
                event
              ) =>
                setAmount(
                  event.target
                    .value
                )
              }
              required
              disabled={
                loading
              }
              inputMode="decimal"
              className="input disabled:bg-slate-50"
            />
          </Field>

          {/* DATA */}

          <Field label="Data">
            <input
              type="date"
              value={
                date
              }
              onChange={(
                event
              ) =>
                setDate(
                  event.target
                    .value
                )
              }
              required
              disabled={
                loading
              }
              className="input disabled:bg-slate-50"
            />
          </Field>

          {/* FORMA */}

          <Field
            label={
              type ===
              "income"
                ? "Forma de recebimento"
                : "Forma de pagamento"
            }
          >
            <select
              value={
                method
              }
              onChange={(
                event
              ) =>
                setMethod(
                  event.target
                    .value
                )
              }
              required
              disabled={
                loading ||
                loadingData ||
                !availableMethods.length
              }
              className="input disabled:bg-slate-50 disabled:text-slate-400"
            >
              {!availableMethods.length && (
                <option value="">
                  Nenhuma forma disponível
                </option>
              )}

              {availableMethods.map(
                (
                  paymentMethod
                ) => (
                  <option
                    key={
                      paymentMethod.id
                    }
                    value={
                      paymentMethod.code
                    }
                  >
                    {
                      paymentMethod.name
                    }
                  </option>
                )
              )}
            </select>
          </Field>

          {/* OBSERVAÇÕES */}

          <Field label="Observações">
            <textarea
              rows={4}
              value={
                notes
              }
              onChange={(
                event
              ) =>
                setNotes(
                  event.target
                    .value
                )
              }
              disabled={
                loading
              }
              placeholder="Observações sobre esta movimentação..."
              className="input min-h-[100px] disabled:bg-slate-50"
            />
          </Field>
        </div>

        {/* BOTÕES */}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={
              loading
            }
            onClick={
              closeModal
            }
            className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={
              loading ||
              loadingData ||
              !availableMethods.length ||
              !financialAccounts.length
            }
            className={`h-11 rounded-xl px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              type ===
              "income"
                ? "bg-[#15704f] hover:bg-[#105c41]"
                : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {loading
              ? "Registrando..."
              : type ===
                  "income"
                ? "Confirmar recebimento"
                : "Confirmar pagamento"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children:
    React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}

function parseMoney(
  value: string
) {
  if (
    !value.trim()
  ) {
    return 0;
  }

  const parsed =
    Number(
      value
        .replace(
          /\./g,
          ""
        )
        .replace(
          ",",
          "."
        )
    );

  return Number.isNaN(
    parsed
  )
    ? 0
    : parsed;
}

function formatValue(
  value: number
) {
  return Number(
    value
  ).toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
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