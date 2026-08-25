import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function ContasPagarPage() {
  await requireModulePermission(
  "accounts_payable",
  "view"
);
  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  let query = supabase
    .from("financial_entries")
    .select(`
      id,
      company_id,
      description,
      due_date,
      amount,
      amount_paid,
      interest,
      fine,
      discount,
      status,

      supplier:suppliers (
        id,
        name
      ),

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
    .eq("type", "expense");

  if (selectedCompanyId) {
    query = query.eq(
      "company_id",
      selectedCompanyId
    );
  }

  const { data: entries, error } =
    await query.order("due_date", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Erro ao carregar contas a pagar:",
      error
    );
  }

  const normalized =
    entries?.map((entry) => ({
      ...entry,

      calculatedStatus: calculateStatus(
        entry.status,
        entry.due_date,
        Number(entry.amount_paid),
        calculateTotal(entry)
      ),
    })) ?? [];

  const openTotal = normalized
    .filter((entry) =>
      ["pending", "partial", "overdue"].includes(
        entry.calculatedStatus
      )
    )
    .reduce(
      (total, entry) =>
        total + calculateOpenAmount(entry),
      0
    );

  const upcomingTotal = normalized
    .filter(
      (entry) =>
        entry.calculatedStatus === "pending"
    )
    .reduce(
      (total, entry) =>
        total + calculateOpenAmount(entry),
      0
    );

  const overdueTotal = normalized
    .filter(
      (entry) =>
        entry.calculatedStatus === "overdue"
    )
    .reduce(
      (total, entry) =>
        total + calculateOpenAmount(entry),
      0
    );

  const paidTotal = normalized.reduce(
    (total, entry) =>
      total + Number(entry.amount_paid),
    0
  );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Contas a Pagar
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Despesas e compromissos da empresa selecionada."
                : "Controle as despesas e compromissos de todas as empresas do Grupo Pulso."}
            </p>
          </div>

          <Link
            href="/financeiro/novo?tipo=expense"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Nova despesa
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Em aberto"
            value={formatCurrency(openTotal)}
          />

          <SummaryCard
            label="A vencer"
            value={formatCurrency(upcomingTotal)}
          />

          <SummaryCard
            label="Vencido"
            value={formatCurrency(overdueTotal)}
            tone="red"
          />

          <SummaryCard
            label="Pago"
            value={formatCurrency(paidTotal)}
            tone="green"
          />
        </div>

        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Despesas
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {normalized.length}{" "}
                  {normalized.length === 1
                    ? "lançamento encontrado"
                    : "lançamentos encontrados"}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Fornecedor
                  </TableHeader>

                  <TableHeader>
                    Descrição
                  </TableHeader>

                  <TableHeader>
                    Empresa
                  </TableHeader>

                  <TableHeader>
                    Categoria
                  </TableHeader>

                  <TableHeader>
                    Vencimento
                  </TableHeader>

                  <TableHeader>
                    Valor
                  </TableHeader>

                  <TableHeader>
                    Saldo
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {normalized.map((entry) => {
                  const supplier = getFirst(
                    entry.supplier
                  );

                  const company = getFirst(
                    entry.company
                  );

                  const category = getFirst(
                    entry.category
                  );

                  return (
                    <tr
                      key={entry.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {supplier?.name ?? "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          href={`/financeiro/${entry.id}`}
                          className="text-sm font-medium text-slate-700 transition hover:text-[#15704f]"
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
                            {company?.name ?? "—"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {category?.name ?? "—"}
                      </td>

                      <td className="px-5 py-4">
                        <p
                          className={`text-sm ${
                            entry.calculatedStatus ===
                            "overdue"
                              ? "font-medium text-red-600"
                              : "text-slate-600"
                          }`}
                        >
                          {formatDate(entry.due_date)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            calculateTotal(entry)
                          )}
                        </p>

                        {Number(entry.amount_paid) > 0 && (
                          <p className="mt-1 text-xs text-slate-400">
                            Pago:{" "}
                            {formatCurrency(
                              Number(
                                entry.amount_paid
                              )
                            )}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <p
                          className={`text-sm font-semibold ${
                            entry.calculatedStatus ===
                            "overdue"
                              ? "text-red-700"
                              : "text-slate-900"
                          }`}
                        >
                          {formatCurrency(
                            calculateOpenAmount(
                              entry
                            )
                          )}
                        </p>
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
                })}

                {!normalized.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-14 text-center"
                    >
                      <p className="text-sm font-medium text-slate-500">
                        Nenhuma conta a pagar encontrada.
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {selectedCompanyId
                          ? "Não há despesas cadastradas para a empresa selecionada."
                          : "Cadastre uma despesa para começar o controle financeiro."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "red" | "green";
}) {
  const valueClass =
    tone === "red"
      ? "text-red-700"
      : tone === "green"
        ? "text-emerald-700"
        : "text-slate-900";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold ${valueClass}`}
      >
        {value}
      </p>
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

function calculateTotal(entry: {
  amount: number | string;
  interest: number | string;
  fine: number | string;
  discount: number | string;
}) {
  return (
    Number(entry.amount) +
    Number(entry.interest) +
    Number(entry.fine) -
    Number(entry.discount)
  );
}

function calculateOpenAmount(entry: {
  amount: number | string;
  amount_paid: number | string;
  interest: number | string;
  fine: number | string;
  discount: number | string;
}) {
  return Math.max(
    calculateTotal(entry) -
      Number(entry.amount_paid),
    0
  );
}

function calculateStatus(
  currentStatus: string,
  dueDate: string,
  paid: number,
  total: number
) {
  if (currentStatus === "cancelled") {
    return "cancelled";
  }

  if (
    paid >= total &&
    total > 0
  ) {
    return "paid";
  }

  if (paid > 0) {
    return "partial";
  }

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  if (dueDate < today) {
    return "overdue";
  }

  return "pending";
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