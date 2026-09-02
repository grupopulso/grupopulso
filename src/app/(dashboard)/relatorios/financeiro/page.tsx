import Link from "next/link";

import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CircleDollarSign,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";



type SearchParams = Promise<{
  start?: string;
  end?: string;
}>;

type PageProps = {
  searchParams: SearchParams;
};

type Company = {
  id: string;
  name: string;
  color: string | null;
};

type Category = {
  id: string;
  name: string;
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

  company:
    | Company
    | Company[]
    | null;

  category:
    | Category
    | Category[]
    | null;
};

export default async function RelatorioFinanceiroPage({
  searchParams,
}: PageProps) {
    await requireModulePermission(
  "reports",
  "view"
);
  const params = await searchParams;

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const today = new Date();

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

  let query = supabase
    .from("financial_entries")
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
      ),

      category:financial_categories (
        id,
        name
      )
    `)
    .gte(
      "due_date",
      startDate
    )
    .lte(
      "due_date",
      endDate
    );

  if (selectedCompanyId) {
    query = query.eq(
      "company_id",
      selectedCompanyId
    );
  }

  const {
    data: entriesData,
    error,
  } = await query.order(
    "due_date",
    {
      ascending: true,
    }
  );

  if (error) {
    console.error(
      "Erro ao carregar relatório financeiro:",
      error
    );
  }

  const todayString =
    formatDateForDatabase(
      today
    );

  const entries =
    (
      entriesData ?? []
    ).map((entry) => ({
      ...entry,

      calculatedStatus:
        calculateStatus(
          entry,
          todayString
        ),
    })) as (
      Entry & {
        calculatedStatus: string;
      }
    )[];

  const validEntries =
    entries.filter(
      (entry) =>
        entry.calculatedStatus !==
        "cancelled"
    );

  const income =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
          "income"
      )
      .reduce(
        (total, entry) =>
          total +
          calculateTotal(
            entry
          ),
        0
      );

  const expense =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
          "expense"
      )
      .reduce(
        (total, entry) =>
          total +
          calculateTotal(
            entry
          ),
        0
      );

  const result =
    income - expense;

  const received =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
          "income"
      )
      .reduce(
        (total, entry) =>
          total +
          Number(
            entry.amount_paid
          ),
        0
      );

  const paid =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
          "expense"
      )
      .reduce(
        (total, entry) =>
          total +
          Number(
            entry.amount_paid
          ),
        0
      );

  const openReceivable =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
            "income" &&
          [
            "pending",
            "partial",
            "overdue",
          ].includes(
            entry.calculatedStatus
          )
      )
      .reduce(
        (total, entry) =>
          total +
          calculateOpenAmount(
            entry
          ),
        0
      );

  const openPayable =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
            "expense" &&
          [
            "pending",
            "partial",
            "overdue",
          ].includes(
            entry.calculatedStatus
          )
      )
      .reduce(
        (total, entry) =>
          total +
          calculateOpenAmount(
            entry
          ),
        0
      );

  const overdueReceivable =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
            "income" &&
          entry.calculatedStatus ===
            "overdue"
      )
      .reduce(
        (total, entry) =>
          total +
          calculateOpenAmount(
            entry
          ),
        0
      );

  const overduePayable =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
            "expense" &&
          entry.calculatedStatus ===
            "overdue"
      )
      .reduce(
        (total, entry) =>
          total +
          calculateOpenAmount(
            entry
          ),
        0
      );

  const categoryStats =
    createCategoryStats(
      validEntries
    );

  /*
   * =====================================================
   * RECEITAS x DESPESAS POR MÊS (dentro do período filtrado)
   * =====================================================
   */

  const monthlyBuckets =
    createMonthlyBuckets(
      validEntries
    );

  const monthlyMaxScale =
    Math.max(
      ...monthlyBuckets.map(
        (bucket) =>
          Math.max(
            bucket.income,
            bucket.expense
          )
      ),
      1
    ) * 1.15;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-[1500px]">
        <Link
          href="/relatorios"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para relatórios
        </Link>

        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Relatório Financeiro
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Análise financeira da empresa selecionada."
                : "Análise financeira consolidada do Grupo Pulso."}
            </p>
          </div>

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

            <button
              type="submit"
              className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Filtrar
            </button>
          </form>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={TrendingUp}
            label="Receitas"
            value={formatCurrency(
              income
            )}
            tone="green"
          />

          <MetricCard
            icon={TrendingDown}
            label="Despesas"
            value={formatCurrency(
              expense
            )}
            tone="red"
          />

          <MetricCard
            icon={CircleDollarSign}
            label="Resultado"
            value={formatCurrency(
              result
            )}
            tone={
              result >= 0
                ? "green"
                : "red"
            }
          />

          <MetricCard
            icon={CircleDollarSign}
            label="Resultado realizado"
            value={formatCurrency(
              received - paid
            )}
            tone={
              received - paid >= 0
                ? "green"
                : "red"
            }
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={ArrowDownLeft}
            label="A receber"
            value={formatCurrency(
              openReceivable
            )}
            tone="green"
          />

          <MetricCard
            icon={ArrowUpRight}
            label="A pagar"
            value={formatCurrency(
              openPayable
            )}
            tone="orange"
          />

          <MetricCard
            icon={ArrowDownLeft}
            label="Recebido"
            value={formatCurrency(
              received
            )}
            tone="blue"
          />

          <MetricCard
            icon={ArrowUpRight}
            label="Pago"
            value={formatCurrency(
              paid
            )}
            tone="slate"
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-700">
              Receitas vencidas
            </p>

            <p className="mt-2 text-2xl font-semibold text-red-800">
              {formatCurrency(
                overdueReceivable
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
            <p className="text-sm font-medium text-orange-700">
              Despesas vencidas
            </p>

            <p className="mt-2 text-2xl font-semibold text-orange-800">
              {formatCurrency(
                overduePayable
              )}
            </p>
          </div>
        </div>

        {/* GRÁFICO: RECEITAS x DESPESAS POR MÊS */}

        {monthlyBuckets.length > 1 && (
          <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Receitas x Despesas por mês
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Lançamentos do período filtrado, agrupados por mês de vencimento.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <LegendItem
                  swatchClass="bg-emerald-500"
                  label="Receitas"
                />

                <LegendItem
                  swatchClass="bg-red-400"
                  label="Despesas"
                />
              </div>
            </div>

            <div className="mt-8 flex items-end gap-2 overflow-x-auto pb-2 sm:gap-4">
              {monthlyBuckets.map(
                (bucket) => {
                  const incomeHeight =
                    monthlyMaxScale >
                    0
                      ? (bucket.income /
                          monthlyMaxScale) *
                        100
                      : 0;

                  const expenseHeight =
                    monthlyMaxScale >
                    0
                      ? (bucket.expense /
                          monthlyMaxScale) *
                        100
                      : 0;

                  const bucketResult =
                    roundMoney(
                      bucket.income -
                        bucket.expense
                    );

                  return (
                    <div
                      key={
                        bucket.key
                      }
                      className="flex min-w-[52px] flex-1 flex-col items-center gap-2"
                    >
                      <div className="group relative flex h-48 items-end gap-1">
                        {/* TOOLTIP */}

                        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                          <p className="font-semibold">
                            {
                              bucket.label
                            }
                          </p>

                          <p className="mt-1 text-slate-300">
                            Receitas:{" "}
                            <span className="font-medium text-white">
                              {formatCurrency(
                                bucket.income
                              )}
                            </span>
                          </p>

                          <p className="text-slate-300">
                            Despesas:{" "}
                            <span className="font-medium text-white">
                              {formatCurrency(
                                bucket.expense
                              )}
                            </span>
                          </p>

                          <p
                            className={`mt-1 font-semibold ${
                              bucketResult >=
                              0
                                ? "text-emerald-300"
                                : "text-red-300"
                            }`}
                          >
                            Resultado:{" "}
                            {formatCurrency(
                              bucketResult
                            )}
                          </p>

                          <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-slate-900" />
                        </div>

                        <div
                          className="w-3.5 rounded-t bg-emerald-500"
                          style={{
                            height: `${incomeHeight}%`,
                          }}
                        />

                        <div
                          className="w-3.5 rounded-t bg-red-400"
                          style={{
                            height: `${expenseHeight}%`,
                          }}
                        />
                      </div>

                      <span className="text-xs font-medium text-slate-600">
                        {
                          bucket.label
                        }
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white xl:col-span-2">
            <div className="border-b border-slate-100 p-5">
              <h2 className="font-semibold text-slate-900">
                Lançamentos do período
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
                    <Header>
                      Vencimento
                    </Header>

                    <Header>
                      Descrição
                    </Header>

                    <Header>
                      Empresa
                    </Header>

                    <Header>
                      Categoria
                    </Header>

                    <Header>
                      Tipo
                    </Header>

                    <Header>
                      Valor
                    </Header>

                    <Header>
                      Status
                    </Header>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {entries.map(
                    (entry) => {
                      const company =
                        getFirst<Company>(
                          entry.company
                        );

                      const category =
                        getFirst<Category>(
                          entry.category
                        );

                      return (
                        <tr
                          key={entry.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatDate(
                              entry.due_date
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <Link
                              href={`/financeiro/${entry.id}`}
                              className="text-sm font-medium text-slate-900 hover:text-[#15704f]"
                            >
                              {entry.description}
                            </Link>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    company?.color ??
                                    "#94a3b8",
                                }}
                              />

                              <span className="text-sm text-slate-600">
                                {company?.name ??
                                  "—"}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {category?.name ??
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            <TypeBadge
                              type={
                                entry.type
                              }
                            />
                          </td>

                          <td
                            className={`px-5 py-4 text-sm font-semibold ${
                              entry.type ===
                              "income"
                                ? "text-emerald-700"
                                : "text-red-700"
                            }`}
                          >
                            {formatCurrency(
                              calculateTotal(
                                entry
                              )
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              status={
                                entry.calculatedStatus
                              }
                            />
                          </td>
                        </tr>
                      );
                    }
                  )}

                  {!entries.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-sm text-slate-400"
                      >
                        Nenhum lançamento no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              Por categoria
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Distribuição dos valores no período.
            </p>

            <div className="mt-5 space-y-3">
              {categoryStats.map(
                (item) => (
                  <div
                    key={`${item.type}-${item.name}`}
                    className="rounded-xl bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {item.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {item.type ===
                          "income"
                            ? "Receita"
                            : "Despesa"}
                        </p>
                      </div>

                      <p
                        className={`text-sm font-semibold ${
                          item.type ===
                          "income"
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        {formatCurrency(
                          item.total
                        )}
                      </p>
                    </div>
                  </div>
                )
              )}

              {!categoryStats.length && (
                <p className="py-8 text-center text-sm text-slate-400">
                  Nenhuma categoria com movimentação.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function createCategoryStats(
  entries: (
    Entry & {
      calculatedStatus: string;
    }
  )[]
) {
  const map = new Map<
    string,
    {
      name: string;
      type:
        | "income"
        | "expense";
      total: number;
    }
  >();

  for (const entry of entries) {
    const category =
      getFirst<Category>(
        entry.category
      );

    const name =
      category?.name ??
      "Sem categoria";

    const key =
      `${entry.type}-${name}`;

    const current =
      map.get(key);

    if (current) {
      current.total +=
        calculateTotal(
          entry
        );
    } else {
      map.set(key, {
        name,
        type: entry.type,
        total:
          calculateTotal(
            entry
          ),
      });
    }
  }

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      b.total - a.total
  );
}

const MONTH_LABELS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function createMonthlyBuckets(
  entries: (
    Entry & {
      calculatedStatus: string;
    }
  )[]
) {
  const map = new Map<
    string,
    {
      key: string;
      label: string;
      income: number;
      expense: number;
    }
  >();

  for (const entry of entries) {
    const key = (
      entry.due_date ?? ""
    ).slice(0, 7);

    const monthIndex =
      Number(
        (entry.due_date ?? "").slice(
          5,
          7
        )
      ) - 1;

    if (
      !key ||
      monthIndex < 0 ||
      monthIndex > 11
    ) {
      continue;
    }

    const yearLabel = (
      entry.due_date ?? ""
    ).slice(0, 4);

    const label = `${MONTH_LABELS_SHORT[monthIndex]}/${yearLabel.slice(2)}`;

    const current =
      map.get(key) ??
      {
        key,
        label,
        income: 0,
        expense: 0,
      };

    if (entry.type === "income") {
      current.income += calculateTotal(
        entry
      );
    } else {
      current.expense += calculateTotal(
        entry
      );
    }

    map.set(key, current);
  }

  return Array.from(map.values())
    .sort((a, b) =>
      a.key.localeCompare(b.key)
    )
    .map((bucket) => ({
      ...bucket,
      income: roundMoney(
        bucket.income
      ),
      expense: roundMoney(
        bucket.expense
      ),
    }));
}

function roundMoney(value: number) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
}

function LegendItem({
  swatchClass,
  label,
}: {
  swatchClass: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`h-2.5 w-2.5 rounded-full ${swatchClass}`}
      />
      {label}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone:
    | "green"
    | "red"
    | "orange"
    | "blue"
    | "slate";
}) {
  const tones = {
    green:
      "bg-emerald-50 text-emerald-600",
    red:
      "bg-red-50 text-red-600",
    orange:
      "bg-orange-50 text-orange-600",
    blue:
      "bg-blue-50 text-blue-600",
    slate:
      "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Header({
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const labels: Record<
    string,
    string
  > = {
    pending: "A vencer",
    overdue: "Vencido",
    partial: "Parcial",
    paid: "Pago",
    cancelled: "Cancelado",
  };

  const styles: Record<
    string,
    string
  > = {
    pending:
      "bg-amber-50 text-amber-700",
    overdue:
      "bg-red-50 text-red-700",
    partial:
      "bg-blue-50 text-blue-700",
    paid:
      "bg-emerald-50 text-emerald-700",
    cancelled:
      "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        styles.pending
      }`}
    >
      {labels[status] ??
        status}
    </span>
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
  entry: Entry,
  today: string
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

  return Array.isArray(value)
    ? value[0] ??
        null
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