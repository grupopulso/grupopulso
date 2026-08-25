import Link from "next/link";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function PagamentosPage() {
    await requireModulePermission(
  "payments",
  "view"
);
  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const { data: transactions, error } =
    await supabase
      .from("financial_transactions")
      .select(`
        id,
        amount,
        transaction_date,
        payment_method,
        notes,

        financial_entry:financial_entries (
          id,
          company_id,
          type,
          description,

          supplier:suppliers (
            id,
            name
          ),

          company:companies (
            id,
            name,
            color
          )
        )
      `)
      .order("transaction_date", {
        ascending: false,
      });

  if (error) {
    console.error(
      "Erro ao carregar pagamentos:",
      error
    );
  }

  const payments =
    transactions?.filter((transaction) => {
      const entry = getFirst(
        transaction.financial_entry
      );

      if (!entry) {
        return false;
      }

      if (entry.type !== "expense") {
        return false;
      }

      if (
        selectedCompanyId &&
        entry.company_id !== selectedCompanyId
      ) {
        return false;
      }

      return true;
    }) ?? [];

  const totalPaid = payments.reduce(
    (total, transaction) =>
      total + Number(transaction.amount),
    0
  );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Pagamentos
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {selectedCompanyId
              ? "Histórico de despesas pagas pela empresa selecionada."
              : "Histórico de despesas efetivamente pagas pelas empresas do Grupo Pulso."}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
          <SummaryCard
            label="Total pago"
            value={formatCurrency(totalPaid)}
          />

          <SummaryCard
            label="Pagamentos registrados"
            value={String(payments.length)}
          />
        </div>

        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-900">
              Histórico de pagamentos
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Valores efetivamente pagos.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <Header>Data</Header>
                  <Header>Fornecedor</Header>
                  <Header>Descrição</Header>
                  <Header>Empresa</Header>
                  <Header>Forma</Header>
                  <Header>Valor</Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {payments.map((transaction) => {
                  const entry = getFirst(
                    transaction.financial_entry
                  );

                  const supplier = getFirst(
                    entry?.supplier
                  );

                  const company = getFirst(
                    entry?.company
                  );

                  return (
                    <tr
                      key={transaction.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(
                          transaction.transaction_date
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {supplier?.name ?? "—"}
                      </td>

                      <td className="px-5 py-4">
                        {entry ? (
                          <Link
                            href={`/financeiro/${entry.id}`}
                            className="text-sm font-medium text-slate-700 hover:text-[#15704f]"
                          >
                            {entry.description}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-400">
                            —
                          </span>
                        )}
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
                        {getPaymentMethodLabel(
                          transaction.payment_method
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-red-700">
                        -{" "}
                        {formatCurrency(
                          Number(transaction.amount)
                        )}
                      </td>
                    </tr>
                  );
                })}

                {!payments.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-14 text-center"
                    >
                      <p className="text-sm font-medium text-slate-500">
                        Nenhum pagamento encontrado.
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {selectedCompanyId
                          ? "Não há pagamentos registrados para a empresa selecionada."
                          : "Os pagamentos registrados aparecerão aqui."}
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
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </p>
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

function getPaymentMethodLabel(
  value: string | null
) {
  const labels: Record<string, string> = {
    cash: "Dinheiro",
    pix: "PIX",
    bank_transfer: "Transferência",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    boleto: "Boleto",
    check: "Cheque",
    other: "Outro",
  };

  return value
    ? labels[value] ?? value
    : "—";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(value);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(
    "pt-BR"
  ).format(
    new Date(`${date}T12:00:00`)
  );
}