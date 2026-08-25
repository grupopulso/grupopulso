import Link from "next/link";

import FinancialDocumentControls from "./financial-document-controls";

import {
  notFound,
  redirect,
} from "next/navigation";

import {
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileText,
  UserRound,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";

import RegisterTransactionForm from "@/app/components/register-transaction-form";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PaymentMethod = {
  id: string;
  name: string;
  code: string;
};

export default async function FinancialEntryPage({
  params,
}: PageProps) {
  await requireModulePermission(
    "financial",
    "view"
  );

  const { id } = await params;

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  

  /*
   * LANÇAMENTO FINANCEIRO
   */
  const { data: entry, error } = await supabase
    .from("financial_entries")
    .select(`
      id,
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
      invoice_issued,
invoice_number,
invoice_issued_at,

charge_sent,
charge_sent_at,
      recurring,
      recurrence_frequency,
      notes,

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
      ),

      cost_center:cost_centers (
        id,
        name
      ),

      financial_account:financial_accounts (
        id,
        name
      ),

      financial_transactions (
        id,
        amount,
        transaction_date,
        payment_method,
        notes,
        created_at
      )
    `)
    .eq("id", id)
    .single();

  if (error || !entry) {
    notFound();
  }

  /*
   * FORMAS DE PAGAMENTO
   *
   * Buscamos inclusive as inativas.
   * Isso é importante porque uma forma
   * pode ter sido utilizada no passado
   * e posteriormente desativada.
   */
  const {
    data: paymentMethods,
    error: paymentMethodsError,
  } = await supabase
    .from("financial_payment_methods")
    .select(`
      id,
      name,
      code
    `)
    .order("name");

  if (paymentMethodsError) {
    console.error(
      "Erro ao carregar formas de pagamento:",
      paymentMethodsError
    );
  }

  const paymentMethodMap = new Map(
    ((paymentMethods ?? []) as PaymentMethod[]).map(
      (method) => [
        method.code,
        method.name,
      ]
    )
  );

  const company = getFirst(entry.company);
  const client = getFirst(entry.client);
  const supplier = getFirst(entry.supplier);
  const category = getFirst(entry.category);
  const costCenter = getFirst(entry.cost_center);
  const account = getFirst(entry.financial_account);

  const totalValue =
    Number(entry.amount) +
    Number(entry.interest) +
    Number(entry.fine) -
    Number(entry.discount);

  const openAmount = Math.max(
    totalValue - Number(entry.amount_paid),
    0
  );

  const calculatedStatus = calculateStatus(
    entry.status,
    entry.due_date,
    Number(entry.amount_paid),
    totalValue
  );

  /*
   * Deixamos as movimentações mais recentes
   * primeiro no histórico.
   */
  const transactions = [
    ...(entry.financial_transactions ?? []),
  ].sort((a, b) => {
    const dateComparison =
      String(b.transaction_date).localeCompare(
        String(a.transaction_date)
      );

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return String(b.created_at).localeCompare(
      String(a.created_at)
    );
  });

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/financeiro"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao financeiro
        </Link>

        <div className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">
                {entry.description}
              </h1>

              <StatusBadge
                status={calculatedStatus}
              />
            </div>

            <p className="mt-2 text-sm text-slate-500">
              {entry.type === "income"
                ? "Conta a receber"
                : "Conta a pagar"}
            </p>
          </div>

          {calculatedStatus !== "paid" &&
            calculatedStatus !== "cancelled" && (
              <RegisterTransactionForm
                entryId={entry.id}
                type={entry.type}
                openAmount={openAmount}
              />
            )}
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={CircleDollarSign}
            label="Valor total"
            value={formatCurrency(totalValue)}
          />

          <SummaryCard
            icon={Banknote}
            label={
              entry.type === "income"
                ? "Recebido"
                : "Pago"
            }
            value={formatCurrency(
              Number(entry.amount_paid)
            )}
          />

          <SummaryCard
            icon={CalendarDays}
            label="Saldo em aberto"
            value={formatCurrency(openAmount)}
          />

          <SummaryCard
            icon={CalendarDays}
            label="Vencimento"
            value={formatDate(entry.due_date)}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">
                Informações do lançamento
              </h2>

              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <InfoItem
                  icon={Building2}
                  label="Empresa"
                  value={company?.name ?? "—"}
                />

                <InfoItem
                  icon={UserRound}
                  label={
                    entry.type === "income"
                      ? "Cliente"
                      : "Fornecedor"
                  }
                  value={
                    entry.type === "income"
                      ? client?.name ?? "—"
                      : supplier?.name ?? "—"
                  }
                />

                <InfoItem
                  icon={FileText}
                  label="Categoria"
                  value={category?.name ?? "—"}
                />

                <InfoItem
                  icon={FileText}
                  label="Centro de custo"
                  value={costCenter?.name ?? "—"}
                />

                <InfoItem
                  icon={Banknote}
                  label="Conta / Caixa"
                  value={account?.name ?? "—"}
                />

                <InfoItem
                  icon={FileText}
                  label="Nº documento"
                  value={entry.document_number || "—"}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">
                Composição do valor
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                <ValueBox
                  label="Principal"
                  value={Number(entry.amount)}
                />

                <ValueBox
                  label="Juros"
                  value={Number(entry.interest)}
                />

                <ValueBox
                  label="Multa"
                  value={Number(entry.fine)}
                />

                <ValueBox
                  label="Desconto"
                  value={Number(entry.discount)}
                />
              </div>
            </section>

            {entry.type === "income" && (
  <FinancialDocumentControls
    entryId={entry.id}
    invoiceIssued={
      entry.invoice_issued
    }
    invoiceNumber={
      entry.invoice_number
    }
    invoiceIssuedAt={
      entry.invoice_issued_at
    }
    chargeSent={
      entry.charge_sent
    }
    chargeSentAt={
      entry.charge_sent_at
    }
  />
)}

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Histórico de movimentações
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Recebimentos e pagamentos registrados neste lançamento.
                </p>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <TableHeader>
                          Data
                        </TableHeader>

                        <TableHeader>
                          Forma
                        </TableHeader>

                        <TableHeader>
                          Valor
                        </TableHeader>

                        <TableHeader>
                          Observações
                        </TableHeader>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {transactions.map(
                        (transaction) => {
                          const methodName =
                            transaction.payment_method
                              ? paymentMethodMap.get(
                                  transaction.payment_method
                                )
                              : null;

                          return (
                            <tr
                              key={transaction.id}
                              className="transition hover:bg-slate-50"
                            >
                              <td className="px-4 py-4 text-sm text-slate-600">
                                {formatDate(
                                  transaction.transaction_date
                                )}
                              </td>

                              <td className="px-4 py-4">
                                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                  {methodName ??
                                    transaction.payment_method ??
                                    "—"}
                                </span>
                              </td>

                              <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                                {formatCurrency(
                                  Number(
                                    transaction.amount
                                  )
                                )}
                              </td>

                              <td className="px-4 py-4 text-sm text-slate-500">
                                {transaction.notes ||
                                  "—"}
                              </td>
                            </tr>
                          );
                        }
                      )}

                      {!transactions.length && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-10 text-center text-sm text-slate-400"
                          >
                            Nenhuma movimentação registrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">
                Datas
              </h2>

              <DateItem
                label="Emissão"
                value={entry.issue_date}
              />

              <DateItem
                label="Competência"
                value={entry.competence_date}
              />

              <DateItem
                label="Vencimento"
                value={entry.due_date}
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">
                Recorrência
              </h2>

              <p className="mt-4 text-sm text-slate-600">
                {entry.recurring
                  ? `Recorrente — ${getRecurrenceLabel(
                      entry.recurrence_frequency
                    )}`
                  : "Lançamento não recorrente."}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">
                Observações
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {entry.notes ||
                  "Nenhuma observação cadastrada."}
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15704f]/10">
          <Icon className="h-5 w-5 text-[#15704f]" />
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>

      <div>
        <p className="text-xs font-medium uppercase text-slate-400">
          {label}
        </p>

        <p className="mt-1 text-sm font-medium text-slate-700">
          {value}
        </p>
      </div>
    </div>
  );
}

function ValueBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs uppercase text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-semibold text-slate-900">
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function DateItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="mt-5">
      <p className="text-xs font-medium uppercase text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-700">
        {value
          ? formatDate(value)
          : "—"}
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
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
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

  const labels: Record<string, string> = {
    pending: "A vencer",
    overdue: "Vencido",
    partial: "Parcial",
    paid: "Pago",
    cancelled: "Cancelado",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function calculateStatus(
  currentStatus: string,
  dueDate: string,
  paid: number,
  total: number
) {
  if (
    currentStatus ===
    "cancelled"
  ) {
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

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  if (dueDate < today) {
    return "overdue";
  }

  return "pending";
}

function getFirst<T>(
  value: T | T[] | null
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function getRecurrenceLabel(
  value: string | null
) {
  const labels: Record<
    string,
    string
  > = {
    monthly: "Mensal",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    annual: "Anual",
    custom: "Personalizada",
  };

  return value
    ? labels[value] ?? value
    : "—";
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