import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  canAccessModule,
  requireModulePermission,
} from "@/app/lib/permissions";

const PAGE_SIZE = 20;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type PageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function RecebimentosPage({
  searchParams,
}: PageProps) {
  const access =
    await requireModulePermission(
      "receipts",
      "view"
    );

  const {
    page: pageParam,
    q: qParam,
    from: fromParam,
    to: toParam,
  } = await searchParams;

  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const search =
    (qParam ?? "").trim();

  const dateFrom =
    fromParam &&
    DATE_ONLY_PATTERN.test(fromParam)
      ? fromParam
      : "";

  const dateTo =
    toParam &&
    DATE_ONLY_PATTERN.test(toParam)
      ? toParam
      : "";

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

          client:clients (
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
      "Erro ao carregar recebimentos:",
      error
    );
  }

  const allReceipts =
    transactions?.filter((transaction) => {
      const entry = getFirst(
        transaction.financial_entry
      );

      if (!entry) {
        return false;
      }

      if (entry.type !== "income") {
        return false;
      }

      if (selectedCompanyId) {
        if (
          entry.company_id !== selectedCompanyId
        ) {
          return false;
        }
      } else if (
        access.profile.role !== "admin" &&
        !access.companyIds.includes(
          entry.company_id
        )
      ) {
        return false;
      }

      return true;
    }) ?? [];

  const totalReceived = allReceipts.reduce(
    (total, transaction) =>
      total + Number(transaction.amount),
    0
  );

  /*
   * Filtro por texto (cliente ou descrição) e período — em memória,
   * no servidor, mesmo padrão do resto de /financeiro.
   */

  const normalizedSearch =
    search.toLocaleLowerCase("pt-BR");

  const filteredReceipts =
    allReceipts.filter((transaction) => {
      const entry = getFirst(
        transaction.financial_entry
      );

      const client = getFirst(
        entry?.client
      );

      const matchesSearch =
        !normalizedSearch ||
        (entry?.description ?? "")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch) ||
        (client?.name ?? "")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch);

      const matchesDate =
        (!dateFrom ||
          transaction.transaction_date >=
            dateFrom) &&
        (!dateTo ||
          transaction.transaction_date <=
            dateTo);

      return matchesSearch && matchesDate;
    });

  const totalReceipts =
    filteredReceipts.length;

  const totalPages = Math.max(
    1,
    Math.ceil(totalReceipts / PAGE_SIZE)
  );

  const requestedPage =
    Number(pageParam ?? "1");

  const currentPage = Math.min(
    Math.max(
      Number.isFinite(requestedPage) &&
        requestedPage > 0
        ? requestedPage
        : 1,
      1
    ),
    totalPages
  );

  const pageStart =
    (currentPage - 1) * PAGE_SIZE;

  const receipts =
    filteredReceipts.slice(
      pageStart,
      pageStart + PAGE_SIZE
    );

  const buildPageHref = (
    targetPage: number
  ) => {
    const params = new URLSearchParams();

    if (search) {
      params.set("q", search);
    }

    if (dateFrom) {
      params.set("from", dateFrom);
    }

    if (dateTo) {
      params.set("to", dateTo);
    }

    if (targetPage > 1) {
      params.set(
        "page",
        String(targetPage)
      );
    }

    const queryString =
      params.toString();

    return queryString
      ? `/financeiro/recebimentos?${queryString}`
      : "/financeiro/recebimentos";
  };

  const canSeeGeneralFinancial =
    canAccessModule(
      access,
      "financial",
      "view"
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        {canSeeGeneralFinancial && (
          <Link
            href="/financeiro"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao financeiro
          </Link>
        )}

        <div className="mt-5">
          <h1 className="text-2xl font-semibold text-slate-900">
            Recebimentos
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {selectedCompanyId
              ? "Histórico de valores recebidos pela empresa selecionada."
              : "Histórico de valores recebidos pelas empresas do Grupo Pulso."}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
          <SummaryCard
            label="Total recebido"
            value={formatCurrency(totalReceived)}
          />

          <SummaryCard
            label="Recebimentos registrados"
            value={String(allReceipts.length)}
          />
        </div>

        <form
          method="get"
          className="mt-7 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
        >
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Buscar por cliente ou descrição..."
            className="h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-[#15704f]"
          />

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">
              De
              <input
                type="date"
                name="from"
                defaultValue={dateFrom}
                className="mt-1 block h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
              />
            </label>

            <label className="text-xs font-medium text-slate-500">
              Até
              <input
                type="date"
                name="to"
                defaultValue={dateTo}
                className="mt-1 block h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
              />
            </label>
          </div>

          <button
            type="submit"
            className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Filtrar
          </button>

          {(search || dateFrom || dateTo) && (
            <Link
              href="/financeiro/recebimentos"
              className="text-sm font-medium text-slate-500 hover:text-slate-900 sm:px-2"
            >
              Limpar filtros
            </Link>
          )}
        </form>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-900">
              Histórico de recebimentos
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {totalReceipts}{" "}
              {totalReceipts === 1
                ? "recebimento encontrado"
                : "recebimentos encontrados"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <Header>Data</Header>
                  <Header>Cliente</Header>
                  <Header>Descrição</Header>
                  <Header>Empresa</Header>
                  <Header>Forma</Header>
                  <Header>Valor</Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {receipts.map((transaction) => {
                  const entry = getFirst(
                    transaction.financial_entry
                  );

                  const client = getFirst(
                    entry?.client
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

                      <td className="px-5 py-4">
                        {client ? (
                          <Link
                            href={`/clientes/${client.id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-[#15704f]"
                          >
                            {client.name}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-400">
                            —
                          </span>
                        )}
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

                      <td className="px-5 py-4 text-sm font-semibold text-emerald-700">
                        +{" "}
                        {formatCurrency(
                          Number(transaction.amount)
                        )}
                      </td>
                    </tr>
                  );
                })}

                {!receipts.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-14 text-center"
                    >
                      <p className="text-sm font-medium text-slate-500">
                        {totalReceipts === 0 &&
                        (search || dateFrom || dateTo)
                          ? "Nenhum recebimento encontrado para esse filtro."
                          : "Nenhum recebimento encontrado."}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {selectedCompanyId
                          ? "Não há recebimentos registrados para a empresa selecionada."
                          : "Os recebimentos registrados aparecerão aqui."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {totalReceipts === 0
                ? "Nenhum recebimento"
                : `Mostrando ${pageStart + 1}–${Math.min(
                    pageStart + PAGE_SIZE,
                    totalReceipts
                  )} de ${totalReceipts} recebimento${
                    totalReceipts === 1 ? "" : "s"
                  }`}
            </span>

            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link
                  href={buildPageHref(
                    currentPage - 1
                  )}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:border-[#15704f]/40 hover:text-[#15704f]"
                >
                  Anterior
                </Link>
              ) : (
                <span className="rounded-lg border border-slate-100 px-3 py-1.5 font-medium text-slate-300">
                  Anterior
                </span>
              )}

              <span className="px-2">
                Página {currentPage} de{" "}
                {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Link
                  href={buildPageHref(
                    currentPage + 1
                  )}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:border-[#15704f]/40 hover:text-[#15704f]"
                >
                  Próxima
                </Link>
              ) : (
                <span className="rounded-lg border border-slate-100 px-3 py-1.5 font-medium text-slate-300">
                  Próxima
                </span>
              )}
            </div>
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
