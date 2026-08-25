import Link from "next/link";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  Plus,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

type Company = {
  id: string;
  name: string;
  color: string | null;
};

type Client = {
  id: string;
  name: string;
};

type Supplier = {
  id: string;
  name: string;
};

export default async function FinanceiroPage() {
 const access =
  await requireModulePermission(
    "financial",
    "view"
  );

  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const today = new Date();

  const todayString =
    formatDateForDatabase(today);

  const monthStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  );

  const monthEnd = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  );

  const monthStartString =
    formatDateForDatabase(monthStart);

  const monthEndString =
    formatDateForDatabase(monthEnd);

  // =========================================
  // CONSULTA COM FILTRO GLOBAL DE EMPRESA
  // =========================================

  let query = supabase
    .from("financial_entries")
    .select(`
      id,
      company_id,
      type,
      description,
      document_number,
      issue_date,
      competence_date,
      due_date,
      amount,
      amount_paid,
      interest,
      fine,
      discount,
      status,
      recurring,
      recurrence_frequency,

      company:companies (
        id,
        name,
        color
      ),

      client:clients (
        id,
        name
      ),

      supplier:suppliers (
        id,
        name
      ),

      category:financial_categories (
        id,
        name
      )
    `);

  if (selectedCompanyId) {
  query = query.eq(
    "company_id",
    selectedCompanyId
  );
} else if (
  access.profile.role !== "admin"
) {
  /*
   * Para usuários não-admin,
   * "Todas as empresas" significa
   * todas as empresas permitidas.
   */
  if (
    access.companyIds.length > 0
  ) {
    query = query.in(
      "company_id",
      access.companyIds
    );
  } else {
    /*
     * Usuário sem nenhuma empresa:
     * força uma consulta sem resultados.
     */
    query = query.eq(
      "company_id",
      "00000000-0000-0000-0000-000000000000"
    );
  }
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
      "Erro ao carregar financeiro:",
      error
    );
  }

  // =========================================
  // NORMALIZAÇÃO DOS STATUS
  // =========================================

  const entries =
    entriesData?.map((entry) => {
      const total =
        calculateTotal(entry);

      let calculatedStatus =
        entry.status;

      if (
        entry.status !== "cancelled"
      ) {
        if (
          Number(entry.amount_paid) >=
            total &&
          total > 0
        ) {
          calculatedStatus =
            "paid";
        } else if (
          Number(entry.amount_paid) >
          0
        ) {
          calculatedStatus =
            "partial";
        } else if (
          entry.due_date <
          todayString
        ) {
          calculatedStatus =
            "overdue";
        } else {
          calculatedStatus =
            "pending";
        }
      }

      return {
        ...entry,
        calculatedStatus,
      };
    }) ?? [];

  // =========================================
  // MOVIMENTAÇÃO DO MÊS
  // =========================================

  const monthEntries =
    entries.filter(
      (entry) =>
        entry.due_date >=
          monthStartString &&
        entry.due_date <=
          monthEndString &&
        entry.calculatedStatus !==
          "cancelled"
    );

  const monthIncome =
    monthEntries
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

  const monthExpenses =
    monthEntries
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

  const monthResult =
    monthIncome -
    monthExpenses;

  // =========================================
  // RECEBIDO / PAGO
  // =========================================

  const received =
    entries
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
    entries
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

  // =========================================
  // CONTAS A RECEBER
  // =========================================

  const accountsReceivable =
    entries
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

  // =========================================
  // CONTAS A PAGAR
  // =========================================

  const accountsPayable =
    entries
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

  // =========================================
  // VENCIDOS
  // =========================================

  const overdueReceivable =
    entries
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
    entries
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

  // =========================================
  // RESULTADO REALIZADO
  // =========================================

  const cashResult =
    received - paid;

  // =========================================
  // PRÓXIMOS VENCIMENTOS
  // =========================================

  const upcomingEntries =
    entries
      .filter(
        (entry) =>
          [
            "pending",
            "partial",
          ].includes(
            entry.calculatedStatus
          ) &&
          entry.due_date >=
            todayString
      )
      .slice(0, 6);

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-[1500px]">
        {/* CABEÇALHO */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Financeiro
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Visão financeira da empresa selecionada."
                : "Visão consolidada das receitas, despesas e fluxo financeiro do Grupo Pulso."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/financeiro/novo?tipo=expense"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <TrendingDown className="h-4 w-4" />
              Nova despesa
            </Link>

            <Link
              href="/financeiro/novo?tipo=income"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
            >
              <Plus className="h-4 w-4" />
              Nova receita
            </Link>
          </div>
        </div>

        {/* RESULTADO PRINCIPAL */}

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={TrendingUp}
            label="Receitas do mês"
            value={formatCurrency(
              monthIncome
            )}
            description="Previsão de receitas no período"
            tone="green"
          />

          <MetricCard
            icon={TrendingDown}
            label="Despesas do mês"
            value={formatCurrency(
              monthExpenses
            )}
            description="Previsão de despesas no período"
            tone="red"
          />

          <MetricCard
            icon={CircleDollarSign}
            label="Resultado do mês"
            value={formatCurrency(
              monthResult
            )}
            description={
              monthResult >= 0
                ? "Resultado positivo"
                : "Resultado negativo"
            }
            tone={
              monthResult >= 0
                ? "green"
                : "red"
            }
          />

          <MetricCard
            icon={WalletCards}
            label="Resultado realizado"
            value={formatCurrency(
              cashResult
            )}
            description="Recebido menos pagamentos"
            tone="blue"
          />
        </div>

        {/* CONTAS */}

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={ArrowDownLeft}
            label="Contas a receber"
            value={formatCurrency(
              accountsReceivable
            )}
            description="Valores ainda não recebidos"
            tone="green"
          />

          <MetricCard
            icon={ArrowUpRight}
            label="Contas a pagar"
            value={formatCurrency(
              accountsPayable
            )}
            description="Compromissos ainda não pagos"
            tone="orange"
          />

          <MetricCard
            icon={Banknote}
            label="Recebido"
            value={formatCurrency(
              received
            )}
            description="Total efetivamente recebido"
            tone="blue"
          />

          <MetricCard
            icon={Banknote}
            label="Pago"
            value={formatCurrency(
              paid
            )}
            description="Total efetivamente pago"
            tone="slate"
          />
        </div>

        {/* ALERTAS */}

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">
                  Receitas vencidas
                </p>

                <p className="mt-2 text-2xl font-semibold text-red-800">
                  {formatCurrency(
                    overdueReceivable
                  )}
                </p>
              </div>

              <CalendarClock className="h-6 w-6 text-red-500" />
            </div>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">
                  Despesas vencidas
                </p>

                <p className="mt-2 text-2xl font-semibold text-orange-800">
                  {formatCurrency(
                    overduePayable
                  )}
                </p>
              </div>

              <CalendarClock className="h-6 w-6 text-orange-500" />
            </div>
          </div>
        </div>

        {/* ATALHOS */}

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <FinanceShortcut
            href="/financeiro/receber"
            label="Contas a receber"
          />

          <FinanceShortcut
            href="/financeiro/pagar"
            label="Contas a pagar"
          />

          <FinanceShortcut
            href="/financeiro/recebimentos"
            label="Recebimentos"
          />

          <FinanceShortcut
            href="/financeiro/pagamentos"
            label="Pagamentos"
          />

          <FinanceShortcut
            href="/financeiro/fluxo"
            label="Fluxo de caixa"
          />

          <FinanceShortcut
            href="/financeiro/configuracoes"
            label="Cadastros financeiros"
          />
        </div>

        {/* CONTEÚDO */}

        <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* MOVIMENTAÇÕES */}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white xl:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Movimentações financeiras
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Receitas e despesas registradas.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>
                      Descrição
                    </TableHeader>

                    <TableHeader>
                      Empresa
                    </TableHeader>

                    <TableHeader>
                      Pessoa
                    </TableHeader>

                    <TableHeader>
                      Vencimento
                    </TableHeader>

                    <TableHeader>
                      Valor
                    </TableHeader>

                    <TableHeader>
                      Situação
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {entries
                    .slice(0, 12)
                    .map((entry) => {
                      const company =
                        getFirst<Company>(
                          entry.company
                        );

                      const client =
                        getFirst<Client>(
                          entry.client
                        );

                      const supplier =
                        getFirst<Supplier>(
                          entry.supplier
                        );

                      return (
                        <tr
                          key={entry.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <Link
                              href={`/financeiro/${entry.id}`}
                              className="flex items-start gap-3"
                            >
                              <TransactionIcon
                                type={
                                  entry.type
                                }
                              />

                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {
                                    entry.description
                                  }
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  {entry.type ===
                                  "income"
                                    ? "Receita"
                                    : "Despesa"}
                                </p>
                              </div>
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
                            {entry.type ===
                            "income"
                              ? client?.name ??
                                "—"
                              : supplier?.name ??
                                "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatDate(
                              entry.due_date
                            )}
                          </td>

                          <td
                            className={`px-5 py-4 text-sm font-semibold ${
                              entry.type ===
                              "income"
                                ? "text-emerald-700"
                                : "text-red-700"
                            }`}
                          >
                            {entry.type ===
                              "income"
                              ? "+"
                              : "-"}{" "}
                            {formatCurrency(
                              calculateTotal(
                                entry
                              )
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <FinancialStatusBadge
                              status={
                                entry.calculatedStatus
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}

                  {!entries.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-sm text-slate-400"
                      >
                        {selectedCompanyId
                          ? "Nenhuma movimentação financeira para a empresa selecionada."
                          : "Nenhuma movimentação financeira cadastrada."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* PRÓXIMOS VENCIMENTOS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              Próximos vencimentos
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Entradas e saídas previstas.
            </p>

            <div className="mt-5 divide-y divide-slate-100">
              {upcomingEntries.map(
                (entry) => (
                  <div
                    key={entry.id}
                    className="py-4 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              entry.type ===
                              "income"
                                ? "bg-emerald-500"
                                : "bg-red-500"
                            }`}
                          />

                          <p className="text-sm font-medium text-slate-800">
                            {
                              entry.description
                            }
                          </p>
                        </div>

                        <p className="mt-1 pl-[18px] text-xs text-slate-400">
                          {formatDate(
                            entry.due_date
                          )}
                        </p>
                      </div>

                      <p
                        className={`whitespace-nowrap text-sm font-semibold ${
                          entry.type ===
                          "income"
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        {entry.type ===
                        "income"
                          ? "+"
                          : "-"}{" "}
                        {formatCurrency(
                          calculateOpenAmount(
                            entry
                          )
                        )}
                      </p>
                    </div>
                  </div>
                )
              )}

              {!upcomingEntries.length && (
                <p className="py-8 text-center text-sm text-slate-400">
                  Nenhum vencimento próximo.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  description: string;
  tone:
    | "green"
    | "red"
    | "orange"
    | "blue"
    | "slate";
}) {
  const tones = {
    green: {
      icon:
        "bg-emerald-50 text-emerald-600",
    },

    red: {
      icon:
        "bg-red-50 text-red-600",
    },

    orange: {
      icon:
        "bg-orange-50 text-orange-600",
    },

    blue: {
      icon:
        "bg-blue-50 text-blue-600",
    },

    slate: {
      icon:
        "bg-slate-100 text-slate-600",
    },
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone].icon}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function FinanceShortcut({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[76px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-center text-sm font-medium text-slate-600 transition hover:border-[#15704f]/40 hover:bg-[#15704f]/5 hover:text-[#15704f]"
    >
      {label}
    </Link>
  );
}

function TransactionIcon({
  type,
}: {
  type: string;
}) {
  if (type === "income") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
        <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
      <ArrowUpRight className="h-4 w-4 text-red-600" />
    </div>
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

function FinancialStatusBadge({
  status,
}: {
  status: string;
}) {
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
      "bg-slate-100 text-slate-500",
  };

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

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
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
  entry: {
    amount: number | string;
    interest: number | string;
    fine: number | string;
    discount: number | string;
  }
) {
  return (
    Number(entry.amount) +
    Number(entry.interest) +
    Number(entry.fine) -
    Number(entry.discount)
  );
}

function calculateOpenAmount(
  entry: {
    amount: number | string;
    amount_paid: number | string;
    interest: number | string;
    fine: number | string;
    discount: number | string;
  }
) {
  return Math.max(
    calculateTotal(entry) -
      Number(
        entry.amount_paid
      ),
    0
  );
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

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}