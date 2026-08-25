import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  WalletCards,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";

type SearchParams = Promise<{
  start?: string;
  end?: string;
  view?: string;
}>;

type PageProps = {
  searchParams: SearchParams;
};

type Company = {
  id: string;
  name: string;
  color: string | null;
};

type Account = {
  id: string;
  name: string;
  initial_balance: number | string;
  company_id: string | null;
};

type Entry = {
  id: string;
  company_id: string;
  type: "income" | "expense";
  description: string;
  due_date: string;
  amount: number | string;
  amount_paid: number | string;
  interest: number | string;
  fine: number | string;
  discount: number | string;
  status: string;
  company: Company | Company[] | null;
};

type Transaction = {
  id: string;
  amount: number | string;
  transaction_date: string;
  payment_method: string | null;

  financial_entry:
    | {
        id: string;
        company_id: string;
        type: "income" | "expense";
        description: string;

        company:
          | Company
          | Company[]
          | null;
      }
    | {
        id: string;
        company_id: string;
        type: "income" | "expense";
        description: string;

        company:
          | Company
          | Company[]
          | null;
      }[]
    | null;
};

export default async function FluxoCaixaPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const today =
    new Date();

  const defaultStart =
    formatDateForDatabase(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

  const defaultEnd =
    formatDateForDatabase(
      new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      )
    );

  const startDate =
    params.start ??
    defaultStart;

  const endDate =
    params.end ??
    defaultEnd;

  const view =
    params.view === "forecast"
      ? "forecast"
      : "realized";

  const [
    accountsResult,
    transactionsResult,
    entriesResult,
  ] = await Promise.all([
    supabase
      .from(
        "financial_accounts"
      )
      .select(`
        id,
        name,
        initial_balance,
        company_id
      `)
      .eq(
        "active",
        true
      ),

    supabase
      .from(
        "financial_transactions"
      )
      .select(`
        id,
        amount,
        transaction_date,
        payment_method,

        financial_entry:financial_entries (
          id,
          company_id,
          type,
          description,

          company:companies (
            id,
            name,
            color
          )
        )
      `)
      .gte(
        "transaction_date",
        startDate
      )
      .lte(
        "transaction_date",
        endDate
      )
      .order(
        "transaction_date",
        {
          ascending: true,
        }
      ),

    supabase
      .from(
        "financial_entries"
      )
      .select(`
        id,
        company_id,
        type,
        description,
        due_date,
        amount,
        amount_paid,
        interest,
        fine,
        discount,
        status,

        company:companies (
          id,
          name,
          color
        )
      `)
      .gte(
        "due_date",
        startDate
      )
      .lte(
        "due_date",
        endDate
      )
      .neq(
        "status",
        "cancelled"
      )
      .order(
        "due_date",
        {
          ascending: true,
        }
      ),
  ]);

  if (
    accountsResult.error
  ) {
    console.error(
      "Erro ao carregar contas financeiras:",
      accountsResult.error
    );
  }

  if (
    transactionsResult.error
  ) {
    console.error(
      "Erro ao carregar transações:",
      transactionsResult.error
    );
  }

  if (
    entriesResult.error
  ) {
    console.error(
      "Erro ao carregar lançamentos:",
      entriesResult.error
    );
  }

  const accounts =
    (accountsResult.data ??
      []) as Account[];

  const transactions =
    (transactionsResult.data ??
      []) as Transaction[];

  const entries =
    (entriesResult.data ??
      []) as Entry[];

  /*
   * As contas sem company_id são
   * consideradas compartilhadas
   * pelo Grupo Pulso.
   *
   * Quando uma empresa específica
   * estiver selecionada, mostramos:
   *
   * - contas dessa empresa;
   * - contas compartilhadas.
   */

  const filteredAccounts =
    accounts.filter(
      (account) =>
        !selectedCompanyId ||
        !account.company_id ||
        account.company_id ===
          selectedCompanyId
    );

  /*
   * Financial Transactions não
   * possui company_id diretamente.
   *
   * A empresa vem do lançamento
   * financeiro relacionado.
   */

  const filteredTransactions =
    transactions.filter(
      (transaction) => {
        const entry =
          getFirst(
            transaction.financial_entry
          );

        if (!entry) {
          return false;
        }

        if (
          selectedCompanyId &&
          entry.company_id !==
            selectedCompanyId
        ) {
          return false;
        }

        return true;
      }
    );

  const filteredEntries =
    entries.filter(
      (entry) =>
        !selectedCompanyId ||
        entry.company_id ===
          selectedCompanyId
    );

  // ============================
  // SALDO INICIAL
  // ============================

  const initialBalance =
    filteredAccounts.reduce(
      (
        total,
        account
      ) =>
        total +
        Number(
          account.initial_balance
        ),
      0
    );

  // ============================
  // ENTRADAS REALIZADAS
  // ============================

  const realizedIncome =
    filteredTransactions
      .filter(
        (
          transaction
        ) => {
          const entry =
            getFirst(
              transaction.financial_entry
            );

          return (
            entry?.type ===
            "income"
          );
        }
      )
      .reduce(
        (
          total,
          transaction
        ) =>
          total +
          Number(
            transaction.amount
          ),
        0
      );

  // ============================
  // SAÍDAS REALIZADAS
  // ============================

  const realizedExpense =
    filteredTransactions
      .filter(
        (
          transaction
        ) => {
          const entry =
            getFirst(
              transaction.financial_entry
            );

          return (
            entry?.type ===
            "expense"
          );
        }
      )
      .reduce(
        (
          total,
          transaction
        ) =>
          total +
          Number(
            transaction.amount
          ),
        0
      );

  const realizedResult =
    realizedIncome -
    realizedExpense;

  // ============================
  // PREVISÃO DE RECEBIMENTOS
  // ============================

  const projectedIncome =
    filteredEntries
      .filter(
        (entry) =>
          entry.type ===
          "income"
      )
      .reduce(
        (
          total,
          entry
        ) =>
          total +
          calculateOpenAmount(
            entry
          ),
        0
      );

  // ============================
  // PREVISÃO DE PAGAMENTOS
  // ============================

  const projectedExpense =
    filteredEntries
      .filter(
        (entry) =>
          entry.type ===
          "expense"
      )
      .reduce(
        (
          total,
          entry
        ) =>
          total +
          calculateOpenAmount(
            entry
          ),
        0
      );

  const projectedResult =
    projectedIncome -
    projectedExpense;

  // ============================
  // SALDOS
  // ============================

  const currentBalance =
    initialBalance +
    realizedResult;

  const projectedBalance =
    currentBalance +
    projectedResult;

  // ============================
  // LINHAS DA TABELA
  // ============================

  const movementRows =
    view === "realized"
      ? createRealizedRows(
          filteredTransactions
        )
      : createForecastRows(
          filteredEntries
        );

  let runningBalance =
    view === "realized"
      ? initialBalance
      : currentBalance;

  const rowsWithBalance =
    movementRows.map(
      (row) => {
        runningBalance +=
          row.type ===
          "income"
            ? row.amount
            : -row.amount;

        return {
          ...row,
          balance:
            runningBalance,
        };
      }
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-[1500px]">
        <Link
          href="/financeiro"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao financeiro
        </Link>

        {/* CABEÇALHO */}

        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Fluxo de Caixa
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Entradas, saídas, saldo e projeções da empresa selecionada."
                : "Entradas, saídas, saldo e projeções consolidadas do Grupo Pulso."}
            </p>
          </div>

          {/* FILTRO DE PERÍODO */}

          <form
            method="GET"
            className="flex flex-wrap items-end gap-3"
          >
            <FilterField label="De">
              <input
                name="start"
                type="date"
                defaultValue={
                  startDate
                }
                className="input"
              />
            </FilterField>

            <FilterField label="Até">
              <input
                name="end"
                type="date"
                defaultValue={
                  endDate
                }
                className="input"
              />
            </FilterField>

            <input
              type="hidden"
              name="view"
              value={view}
            />

            <button
              type="submit"
              className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Filtrar
            </button>
          </form>
        </div>

        {/* CARDS PRINCIPAIS */}

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={WalletCards}
            label="Saldo inicial"
            value={formatCurrency(
              initialBalance
            )}
          />

          <MetricCard
            icon={ArrowDownLeft}
            label="Entradas realizadas"
            value={formatCurrency(
              realizedIncome
            )}
            positive
          />

          <MetricCard
            icon={ArrowUpRight}
            label="Saídas realizadas"
            value={formatCurrency(
              realizedExpense
            )}
            negative
          />

          <MetricCard
            icon={WalletCards}
            label="Saldo atual"
            value={formatCurrency(
              currentBalance
            )}
          />

          <MetricCard
            icon={CalendarDays}
            label="Saldo projetado"
            value={formatCurrency(
              projectedBalance
            )}
          />
        </div>

        {/* PREVISÕES */}

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <ProjectionCard
            label="A receber no período"
            value={
              projectedIncome
            }
            type="income"
          />

          <ProjectionCard
            label="A pagar no período"
            value={
              projectedExpense
            }
            type="expense"
          />

          <ProjectionCard
            label="Resultado previsto"
            value={
              projectedResult
            }
            type={
              projectedResult >=
              0
                ? "income"
                : "expense"
            }
          />
        </div>

        {/* REALIZADO / PREVISTO */}

        <div className="mt-7 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          <ViewButton
            href={createViewUrl({
              start:
                startDate,
              end: endDate,
              view:
                "realized",
            })}
            active={
              view ===
              "realized"
            }
          >
            Realizado
          </ViewButton>

          <ViewButton
            href={createViewUrl({
              start:
                startDate,
              end: endDate,
              view:
                "forecast",
            })}
            active={
              view ===
              "forecast"
            }
          >
            Previsto
          </ViewButton>
        </div>

        {/* TABELA */}

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-900">
              {view ===
              "realized"
                ? "Movimentações realizadas"
                : "Previsão de movimentações"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {formatDate(
                startDate
              )}{" "}
              até{" "}
              {formatDate(
                endDate
              )}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Data
                  </TableHeader>

                  <TableHeader>
                    Descrição
                  </TableHeader>

                  <TableHeader>
                    Empresa
                  </TableHeader>

                  <TableHeader>
                    Tipo
                  </TableHeader>

                  <TableHeader>
                    Entrada
                  </TableHeader>

                  <TableHeader>
                    Saída
                  </TableHeader>

                  <TableHeader>
                    Saldo
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rowsWithBalance.map(
                  (row) => (
                    <tr
                      key={row.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(
                          row.date
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {row.href ? (
                          <Link
                            href={
                              row.href
                            }
                            className="text-sm font-medium text-slate-900 hover:text-[#15704f]"
                          >
                            {
                              row.description
                            }
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-slate-900">
                            {
                              row.description
                            }
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                row
                                  .company
                                  ?.color ??
                                "#94a3b8",
                            }}
                          />

                          <span className="text-sm text-slate-600">
                            {row
                              .company
                              ?.name ??
                              "—"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <TypeBadge
                          type={
                            row.type
                          }
                        />
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-emerald-700">
                        {row.type ===
                        "income"
                          ? formatCurrency(
                              row.amount
                            )
                          : "—"}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-red-700">
                        {row.type ===
                        "expense"
                          ? formatCurrency(
                              row.amount
                            )
                          : "—"}
                      </td>

                      <td
                        className={`px-5 py-4 text-sm font-semibold ${
                          row.balance >=
                          0
                            ? "text-slate-900"
                            : "text-red-700"
                        }`}
                      >
                        {formatCurrency(
                          row.balance
                        )}
                      </td>
                    </tr>
                  )
                )}

                {!rowsWithBalance.length && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-14 text-center"
                    >
                      <p className="text-sm font-medium text-slate-500">
                        Nenhuma movimentação encontrada.
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Não existem movimentações para o período e empresa selecionados.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* CONTAS E CAIXAS */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Contas e caixas
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Contas financeiras consideradas na visualização atual.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {filteredAccounts.map(
              (account) => (
                <div
                  key={
                    account.id
                  }
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <p className="text-sm font-medium text-slate-700">
                    {account.name}
                  </p>

                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {formatCurrency(
                      Number(
                        account.initial_balance
                      )
                    )}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Saldo inicial
                  </p>
                </div>
              )
            )}

            {!filteredAccounts.length && (
              <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                <p className="text-sm text-slate-400">
                  Nenhuma conta financeira cadastrada.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

type MovementRow = {
  id: string;
  date: string;
  description: string;
  type:
    | "income"
    | "expense";
  amount: number;
  company:
    | Company
    | null;
  href:
    | string
    | null;
};

function createRealizedRows(
  transactions: Transaction[]
): MovementRow[] {
  return transactions
    .map(
      (
        transaction
      ): MovementRow | null => {
        const entry =
          getFirst(
            transaction.financial_entry
          );

        if (!entry) {
          return null;
        }

        return {
          id:
            transaction.id,

          date:
            transaction.transaction_date,

          description:
            entry.description,

          type:
            entry.type,

          amount:
            Number(
              transaction.amount
            ),

          company:
            getFirst(
              entry.company
            ),

          href:
            `/financeiro/${entry.id}`,
        };
      }
    )
    .filter(
      (
        row
      ): row is MovementRow =>
        row !== null
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(
          b.date
        )
    );
}

function createForecastRows(
  entries: Entry[]
): MovementRow[] {
  return entries
    .filter(
      (entry) =>
        [
          "pending",
          "partial",
          "overdue",
        ].includes(
          calculateStatus(
            entry
          )
        )
    )
    .map(
      (entry) => ({
        id:
          entry.id,

        date:
          entry.due_date,

        description:
          entry.description,

        type:
          entry.type,

        amount:
          calculateOpenAmount(
            entry
          ),

        company:
          getFirst(
            entry.company
          ),

        href:
          `/financeiro/${entry.id}`,
      })
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(
          b.date
        )
    );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  positive,
  negative,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-semibold tracking-tight ${
              positive
                ? "text-emerald-700"
                : negative
                  ? "text-red-700"
                  : "text-slate-900"
            }`}
          >
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
      </div>
    </div>
  );
}

function ProjectionCard({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type:
    | "income"
    | "expense";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        type === "income"
          ? "border-emerald-100 bg-emerald-50"
          : "border-red-100 bg-red-50"
      }`}
    >
      <p
        className={`text-sm ${
          type === "income"
            ? "text-emerald-700"
            : "text-red-700"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold ${
          type === "income"
            ? "text-emerald-800"
            : "text-red-800"
        }`}
      >
        {formatCurrency(
          value
        )}
      </p>
    </div>
  );
}

function ViewButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-[#15704f] text-white"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  );
}

function TypeBadge({
  type,
}: {
  type:
    | "income"
    | "expense";
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        type === "income"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {type === "income"
        ? "Receita"
        : "Despesa"}
    </span>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-medium text-slate-500">
        {label}
      </span>

      {children}
    </label>
  );
}

function calculateTotal(
  entry: Entry
) {
  return (
    Number(entry.amount) +
    Number(entry.interest) +
    Number(entry.fine) -
    Number(entry.discount)
  );
}

function calculateOpenAmount(
  entry: Entry
) {
  return Math.max(
    calculateTotal(entry) -
      Number(
        entry.amount_paid
      ),
    0
  );
}

function calculateStatus(
  entry: Entry
) {
  if (
    entry.status ===
    "cancelled"
  ) {
    return "cancelled";
  }

  const total =
    calculateTotal(entry);

  if (
    Number(
      entry.amount_paid
    ) >= total &&
    total > 0
  ) {
    return "paid";
  }

  if (
    Number(
      entry.amount_paid
    ) > 0
  ) {
    return "partial";
  }

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  if (
    entry.due_date <
    today
  ) {
    return "overdue";
  }

  return "pending";
}

function getFirst<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(
    value
  )
    ? value[0] ?? null
    : value;
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(value);
}

function formatDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "pt-BR"
  ).format(
    new Date(
      `${date}T12:00:00`
    )
  );
}

function formatDateForDatabase(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
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

function createViewUrl({
  start,
  end,
  view,
}: {
  start: string;
  end: string;
  view: string;
}) {
  const query =
    new URLSearchParams({
      start,
      end,
      view,
    });

  return `/financeiro/fluxo?${query.toString()}`;
}