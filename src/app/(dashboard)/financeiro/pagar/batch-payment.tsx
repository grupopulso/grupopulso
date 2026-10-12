"use client";

import {
  createContext,
  FormEvent,
  useContext,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { Banknote, Landmark, X } from "lucide-react";

import {
  getBatchPaymentFormData,
  registerBatchTransactions,
} from "../[id]/actions";

type SelectedEntry = {
  id: string;
  companyId: string;
  companyName: string;
  description: string;
  openAmount: number;
};

type Selection = {
  selected: SelectedEntry[];
  toggle: (entry: SelectedEntry) => void;
  clear: () => void;
};

const SelectionContext =
  createContext<Selection | null>(null);

function useSelection() {
  const context = useContext(SelectionContext);

  if (!context) {
    throw new Error(
      "Componente de baixa em lote fora do provider."
    );
  }

  return context;
}

export function BatchSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<
    SelectedEntry[]
  >([]);

  const value: Selection = {
    selected,

    toggle: (entry) =>
      setSelected((current) =>
        current.some((item) => item.id === entry.id)
          ? current.filter(
              (item) => item.id !== entry.id
            )
          : [...current, entry]
      ),

    clear: () => setSelected([]),
  };

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

/*
 * Quadradinho de cada linha. Depois do primeiro marcado, só
 * dá pra marcar despesas da MESMA empresa (a conta de onde sai o
 * dinheiro é por empresa).
 */
export function RowCheckbox({
  entry,
}: {
  entry: SelectedEntry;
}) {
  const { selected, toggle } = useSelection();

  const checked = selected.some(
    (item) => item.id === entry.id
  );

  const otherCompany =
    selected.length > 0 &&
    selected[0].companyId !== entry.companyId;

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={otherCompany}
      onChange={() => toggle(entry)}
      title={
        otherCompany
          ? `Só dá para marcar várias da mesma empresa (${selected[0].companyName}).`
          : "Marcar para dar baixa em lote"
      }
      aria-label={`Selecionar ${entry.description}`}
      className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
    />
  );
}

export function BatchBar() {
  const router = useRouter();

  const { selected, clear } = useSelection();

  const [open, setOpen] = useState(false);

  if (selected.length === 0) {
    return null;
  }

  const total = selected.reduce(
    (sum, item) => sum + item.openAmount,
    0
  );

  return (
    <>
      <div className="sticky top-0 z-20 flex flex-col gap-3 border-b border-emerald-200 bg-emerald-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          <strong className="text-slate-900">
            {selected.length}{" "}
            {selected.length === 1
              ? "despesa selecionada"
              : "despesas selecionadas"}
          </strong>{" "}
          de {selected[0].companyName} ·{" "}
          {formatCurrency(total)}
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
            onClick={() => setOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Banknote className="h-4 w-4" />
            Dar baixa nas selecionadas
          </button>
        </div>
      </div>

      {open && (
        <BatchDialog
          entries={selected}
          total={total}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            clear();
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
  entries,
  total,
  onClose,
  onDone,
}: {
  entries: SelectedEntry[];
  total: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [methods, setMethods] = useState<
    PaymentMethod[]
  >([]);

  const [accounts, setAccounts] = useState<
    FinancialAccount[]
  >([]);

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
      const result = await getBatchPaymentFormData(
        entries.map((item) => item.id)
      );

      if (cancelled) {
        return;
      }

      if (!result.success) {
        setError(result.error);
        setLoadingData(false);

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
       * Conta padrão: a do Sicredi, quando a empresa tem. Se
       * não tiver (ou houver só uma), usa a única conta; senão
       * deixa a pessoa escolher.
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

      setLoadingData(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [entries]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (!accountId) {
      setError("Selecione a conta usada no pagamento.");

      return;
    }

    if (!method) {
      setError("Selecione a forma de pagamento.");

      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await registerBatchTransactions(
        entries.map((item) => item.id),
        {
          date,
          paymentMethod: method,
          financialAccountId: accountId,
          notes: notes.trim() || undefined,
        }
      );

      if (!result.success) {
        setError(result.message);

        return;
      }

      onDone();
    } catch (err) {
      console.error("Erro na baixa em lote:", err);

      setError(
        "Não foi possível dar a baixa. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Dar baixa em {entries.length}{" "}
              {entries.length === 1
                ? "despesa"
                : "despesas"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {entries[0].companyName} · total{" "}
              {formatCurrency(total)}
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
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

        <ul className="mt-5 max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm">
          {entries.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="truncate text-slate-700">
                {item.description}
              </span>

              <span className="shrink-0 font-medium text-slate-900">
                {formatCurrency(item.openAmount)}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-2 text-xs text-slate-500">
          Cada despesa é quitada pelo saldo em aberto.
        </p>

        <div className="mt-5 space-y-5">
          <Field label="Pagar pela conta">
            <div className="relative">
              <Landmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <select
                value={accountId}
                onChange={(event) =>
                  setAccountId(event.target.value)
                }
                required
                disabled={loading || loadingData}
                className="input pl-10 disabled:bg-slate-50"
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

            {!loadingData && accounts.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Nenhuma conta financeira ativa foi
                encontrada para esta empresa.
              </p>
            )}
          </Field>

          <Field label="Data">
            <input
              type="date"
              value={date}
              onChange={(event) =>
                setDate(event.target.value)
              }
              required
              disabled={loading}
              className="input disabled:bg-slate-50"
            />
          </Field>

          <Field label="Forma de pagamento">
            <select
              value={method}
              onChange={(event) =>
                setMethod(event.target.value)
              }
              required
              disabled={
                loading ||
                loadingData ||
                methods.length === 0
              }
              className="input disabled:bg-slate-50"
            >
              {methods.length === 0 && (
                <option value="">
                  Nenhuma forma disponível
                </option>
              )}

              {methods.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Observações">
            <textarea
              rows={3}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              disabled={loading}
              placeholder="Vale para todas as despesas selecionadas..."
              className="input min-h-[80px] disabled:bg-slate-50"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-3">
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
              loadingData ||
              methods.length === 0 ||
              accounts.length === 0
            }
            className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Registrando..."
              : `Confirmar ${formatCurrency(total)}`}
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
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
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
