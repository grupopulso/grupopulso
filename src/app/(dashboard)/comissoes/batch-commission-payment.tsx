"use client";

import {
  createContext,
  FormEvent,
  useContext,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { HandCoins, Landmark, X } from "lucide-react";

import {
  getCommissionBatchFormData,
  payCommissionsBatch,
} from "./actions";

type SelectedCommission = {
  key: string;
  commissionId: string;
  originType: "sale" | "contract";
  beneficiaryName: string;
  reference: string;
  available: number;
};

type Selection = {
  selected: SelectedCommission[];
  toggle: (item: SelectedCommission) => void;
  setMany: (
    items: SelectedCommission[],
    checked: boolean
  ) => void;
  clear: () => void;
};

const SelectionContext =
  createContext<Selection | null>(null);

function useSelection() {
  const context = useContext(SelectionContext);

  if (!context) {
    throw new Error(
      "Componente de pagamento em lote fora do provider."
    );
  }

  return context;
}

export function CommissionSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<
    SelectedCommission[]
  >([]);

  const value: Selection = {
    selected,

    toggle: (item) =>
      setSelected((current) =>
        current.some((row) => row.key === item.key)
          ? current.filter((row) => row.key !== item.key)
          : [...current, item]
      ),

    setMany: (items, checked) =>
      setSelected((current) => {
        const keys = new Set(
          items.map((item) => item.key)
        );

        const rest = current.filter(
          (row) => !keys.has(row.key)
        );

        return checked ? [...rest, ...items] : rest;
      }),

    clear: () => setSelected([]),
  };

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

/*
 * Quadradinho de cada comissão com valor disponível.
 */
export function CommissionCheckbox({
  item,
}: {
  item: SelectedCommission;
}) {
  const { selected, toggle } = useSelection();

  const checked = selected.some(
    (row) => row.key === item.key
  );

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => toggle(item)}
      title="Marcar para pagar em lote"
      aria-label={`Selecionar comissão de ${item.beneficiaryName}`}
      className="h-4 w-4 cursor-pointer accent-[#15704f]"
    />
  );
}

/*
 * Quadradinho do cabeçalho: marca/desmarca todas as comissões
 * disponíveis da lista (respeita os filtros aplicados).
 */
export function SelectAllCommissions({
  items,
}: {
  items: SelectedCommission[];
}) {
  const { selected, setMany } = useSelection();

  if (items.length === 0) {
    return null;
  }

  const selectedKeys = new Set(
    selected.map((row) => row.key)
  );

  const allChecked = items.every((item) =>
    selectedKeys.has(item.key)
  );

  return (
    <input
      type="checkbox"
      checked={allChecked}
      onChange={() => setMany(items, !allChecked)}
      title="Marcar todas as disponíveis"
      aria-label="Marcar todas as comissões disponíveis"
      className="h-4 w-4 cursor-pointer accent-[#15704f]"
    />
  );
}

export function CommissionBatchBar() {
  const router = useRouter();

  const { selected, clear } = useSelection();

  const [open, setOpen] = useState(false);

  const [success, setSuccess] = useState("");

  if (selected.length === 0) {
    return success ? (
      <div className="flex items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-sm text-emerald-800">
        <span>{success}</span>

        <button
          type="button"
          onClick={() => setSuccess("")}
          className="text-emerald-700 hover:text-emerald-900"
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ) : null;
  }

  const total = selected.reduce(
    (sum, item) => sum + item.available,
    0
  );

  return (
    <>
      <div className="sticky top-0 z-20 flex flex-col gap-3 border-b border-emerald-200 bg-emerald-50 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          <strong className="text-slate-900">
            {selected.length}{" "}
            {selected.length === 1
              ? "comissão selecionada"
              : "comissões selecionadas"}
          </strong>{" "}
          · {formatCurrency(total)}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={clear}
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            Limpar seleção
          </button>

          <button
            type="button"
            onClick={() => {
              setSuccess("");
              setOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <HandCoins className="h-4 w-4" />
            Pagar selecionadas
          </button>
        </div>
      </div>

      {open && (
        <BatchDialog
          items={selected}
          total={total}
          onClose={() => setOpen(false)}
          onDone={(message) => {
            setOpen(false);
            clear();
            setSuccess(message);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

type PaymentMethod = {
  id: string;
  name: string;
  code: string;
  usage_type: "income" | "expense" | "both";
  active: boolean;
};

type FinancialAccount = {
  id: string;
  name: string;
  current_balance: number;
};

function BatchDialog({
  items,
  total,
  onClose,
  onDone,
}: {
  items: SelectedCommission[];
  total: number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [methods, setMethods] = useState<
    PaymentMethod[]
  >([]);

  const [accounts, setAccounts] = useState<
    FinancialAccount[]
  >([]);

  const [settleNow, setSettleNow] = useState(true);

  const [method, setMethod] = useState("");

  const [accountId, setAccountId] = useState("");

  const [date, setDate] = useState(today());

  const [notes, setNotes] = useState("");

  const [loadingData, setLoadingData] =
    useState(true);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result =
          await getCommissionBatchFormData();

        if (cancelled) {
          return;
        }

        const loadedMethods = (
          result.paymentMethods as PaymentMethod[]
        ).filter(
          (item) =>
            item.active &&
            (item.usage_type === "both" ||
              item.usage_type === "expense")
        );

        const loadedAccounts =
          result.financialAccounts as FinancialAccount[];

        setMethods(loadedMethods);
        setAccounts(loadedAccounts);

        if (loadedMethods.length > 0) {
          setMethod(loadedMethods[0].code);
        }

        /*
         * Conta padrão: a do Sicredi (igual à baixa em lote das
         * contas a pagar); se só houver uma, usa ela.
         */
        const sicredi = loadedAccounts.find((item) =>
          item.name
            .toLocaleLowerCase("pt-BR")
            .includes("sicredi")
        );

        if (sicredi) {
          setAccountId(sicredi.id);
        } else if (loadedAccounts.length === 1) {
          setAccountId(loadedAccounts[0].id);
        }
      } catch (err) {
        console.error(
          "Erro ao carregar contas/formas:",
          err
        );

        if (!cancelled) {
          setError(
            "Não foi possível carregar as contas e formas de pagamento."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (!date) {
      setError("Informe a data.");

      return;
    }

    if (settleNow && !accountId) {
      setError("Selecione a conta usada no pagamento.");

      return;
    }

    if (settleNow && !method) {
      setError("Selecione a forma de pagamento.");

      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await payCommissionsBatch(
        items.map((item) => ({
          commissionId: item.commissionId,
          originType: item.originType,
          amount: item.available,
        })),
        {
          dueDate: date,
          notes: notes.trim() || undefined,
          settle: settleNow
            ? {
                date,
                paymentMethod: method,
                financialAccountId: accountId,
              }
            : undefined,
        }
      );

      if (!result.success) {
        setError(result.message);

        return;
      }

      onDone(
        result.settled > 0
          ? `${result.settled} ${
              result.settled === 1
                ? "comissão paga"
                : "comissões pagas"
            } (${formatCurrency(total)}).`
          : `${result.generated} ${
              result.generated === 1
                ? "pagamento gerado"
                : "pagamentos gerados"
            } em Contas a pagar (${formatCurrency(total)}).`
      );
    } catch (err) {
      console.error(
        "Erro no pagamento em lote de comissões:",
        err
      );

      setError(
        "Não foi possível concluir. Atualize a página e confira o que já foi gerado."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Pagar {items.length}{" "}
              {items.length === 1
                ? "comissão"
                : "comissões"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Total {formatCurrency(total)}
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <ul className="mt-5 max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-800">
                  {item.beneficiaryName}
                </span>

                <span className="block truncate text-xs text-slate-500">
                  {item.reference}
                </span>
              </span>

              <span className="shrink-0 font-medium text-slate-900">
                {formatCurrency(item.available)}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-2 text-xs text-slate-500">
          Cada comissão é paga pelo valor disponível.
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
          <input
            type="checkbox"
            checked={settleNow}
            onChange={(event) =>
              setSettleNow(event.target.checked)
            }
            disabled={loading}
            className="mt-0.5 h-4 w-4 accent-[#15704f]"
          />

          <span>
            <span className="block text-sm font-semibold text-slate-800">
              Já dar baixa (pagamento feito)
            </span>

            <span className="mt-0.5 block text-xs text-slate-500">
              Desmarcado, só gera as contas a pagar para
              baixar depois no Financeiro.
            </span>
          </span>
        </label>

        <div className="mt-5 space-y-5">
          <Field
            label={
              settleNow
                ? "Data do pagamento"
                : "Vencimento"
            }
          >
            <input
              type="date"
              value={date}
              onChange={(event) =>
                setDate(event.target.value)
              }
              required
              disabled={loading}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f] disabled:bg-slate-50"
            />
          </Field>

          {settleNow && (
            <>
              <Field label="Pagar pela conta">
                <div className="relative">
                  <Landmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <select
                    value={accountId}
                    onChange={(event) =>
                      setAccountId(event.target.value)
                    }
                    disabled={loading || loadingData}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f] disabled:bg-slate-50"
                  >
                    <option value="">
                      {loadingData
                        ? "Carregando..."
                        : "Selecione..."}
                    </option>

                    {accounts.map((account) => (
                      <option
                        key={account.id}
                        value={account.id}
                      >
                        {account.name} —{" "}
                        {formatCurrency(
                          Number(account.current_balance)
                        )}
                      </option>
                    ))}
                  </select>
                </div>

                {!loadingData &&
                  accounts.length === 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      Nenhuma conta financeira ativa foi
                      encontrada para o O Estafeta.
                    </p>
                  )}
              </Field>

              <Field label="Forma de pagamento">
                <select
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value)
                  }
                  disabled={
                    loading ||
                    loadingData ||
                    methods.length === 0
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f] disabled:bg-slate-50"
                >
                  {methods.length === 0 && (
                    <option value="">
                      {loadingData
                        ? "Carregando..."
                        : "Nenhuma forma disponível"}
                    </option>
                  )}

                  {methods.map((item) => (
                    <option key={item.id} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          <Field label="Observações">
            <textarea
              rows={3}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              disabled={loading}
              placeholder="Opcional — vale para todas as selecionadas"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f] disabled:bg-slate-50"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={
              loading ||
              (settleNow &&
                (loadingData ||
                  methods.length === 0 ||
                  accounts.length === 0))
            }
            className="h-11 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Processando..."
              : settleNow
                ? `Pagar ${formatCurrency(total)}`
                : `Gerar ${formatCurrency(total)}`}
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
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function today() {
  const date = new Date();

  const month = String(date.getMonth() + 1).padStart(
    2,
    "0"
  );

  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}
