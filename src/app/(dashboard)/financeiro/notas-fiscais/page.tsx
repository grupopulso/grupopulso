import Link from "next/link";
import { ArrowLeft, FileCheck2 } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  canAccessModule,
  requireModulePermission,
} from "@/app/lib/permissions";
import {
  FINANCIAL_ENTRY_STATUS_LABELS,
  FINANCIAL_ENTRY_STATUS_STYLES,
  getFinancialEntryStatus,
} from "@/app/lib/financial-entry-status";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type PageProps = {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function NotasFiscaisPage({
  searchParams,
}: PageProps) {
  /*
   * Módulo próprio ("Notas Fiscais" em Configurações →
   * Usuários) — não depende de "Contas a Receber". Precisa
   * ser habilitado explicitamente por usuário.
   */
  const access =
    await requireModulePermission(
      "invoices",
      "view"
    );

  const {
    q: qParam,
    from: fromParam,
    to: toParam,
  } = await searchParams;

  const search = (qParam ?? "").trim();

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

  const supabase =
    await createClient();

  /*
   * Leitura via service role: RLS de financial_entries só
   * libera quem tem o módulo geral "financial" — quem só tem
   * "Notas Fiscais" recebia 0 linhas mesmo já tendo passado
   * pela checagem de permissão certa acima.
   */
  const adminDb = createAdminClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  let query = adminDb
    .from("financial_entries")
    .select(`
      id,
      description,
      invoice_number,
      invoice_issued_at,
      due_date,
      amount,
      amount_paid,
      interest,
      fine,
      discount,
      status,
      charge_sent,
      charge_sent_at,

      client:clients (
        id,
        name
      ),

      company:companies (
        id,
        name,
        color
      )
    `)
    .eq("type", "income")
    .eq("invoice_issued", true);

  if (selectedCompanyId) {
    query = query.eq(
      "company_id",
      selectedCompanyId
    );
  } else if (
    access.profile.role !== "admin"
  ) {
    if (access.companyIds.length > 0) {
      query = query.in(
        "company_id",
        access.companyIds
      );
    } else {
      query = query.eq(
        "company_id",
        "00000000-0000-0000-0000-000000000000"
      );
    }
  }

  if (dateFrom) {
    query = query.gte(
      "invoice_issued_at",
      dateFrom
    );
  }

  if (dateTo) {
    query = query.lte(
      "invoice_issued_at",
      dateTo
    );
  }

  const {
    data: entriesData,
    error,
  } = await query.order(
    "invoice_issued_at",
    { ascending: false }
  );

  if (error) {
    console.error(
      "Erro ao carregar notas fiscais:",
      error
    );
  }

  const normalizedSearch = search
    .toLocaleLowerCase("pt-BR");

  const entries = (
    entriesData ?? []
  ).filter((entry) => {
    if (!normalizedSearch) {
      return true;
    }

    const client = getFirst(
      entry.client
    );

    return (
      (entry.invoice_number ?? "")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch) ||
      entry.description
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch) ||
      (client?.name ?? "")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch)
    );
  });

  const totalAmount = entries.reduce(
    (total, entry) =>
      total + Number(entry.amount ?? 0),
    0
  );

  const buildHref = (
    params: Record<string, string>
  ) => {
    const query = new URLSearchParams();

    if (params.q ?? search) {
      query.set(
        "q",
        params.q ?? search
      );
    }

    if (params.from ?? dateFrom) {
      query.set(
        "from",
        params.from ?? dateFrom
      );
    }

    if (params.to ?? dateTo) {
      query.set(
        "to",
        params.to ?? dateTo
      );
    }

    const qs = query.toString();

    return qs
      ? `/financeiro/notas-fiscais?${qs}`
      : "/financeiro/notas-fiscais";
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

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
            <FileCheck2 className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Notas fiscais
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Notas fiscais emitidas da empresa selecionada."
                : "Notas fiscais emitidas em contas a receber."}
            </p>
          </div>
        </div>

        {/* FILTROS */}

        <form
          method="get"
          className="mt-7 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end sm:gap-4"
        >
          <label className="flex-1 text-xs font-medium text-slate-500">
            Cliente, descrição ou nº da NF
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Buscar..."
              className="mt-1 block h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
            />
          </label>

          <div className="flex gap-3">
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
              href="/financeiro/notas-fiscais"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              Limpar filtros
            </Link>
          )}
        </form>

        {/* RESUMO */}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard
            label="Notas fiscais emitidas"
            value={String(entries.length)}
          />

          <SummaryCard
            label="Valor total"
            value={formatCurrency(
              totalAmount
            )}
          />
        </div>

        {/* TABELA */}

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>Nº da NF</TableHeader>
                  <TableHeader>Data de emissão</TableHeader>
                  <TableHeader>Cliente</TableHeader>
                  <TableHeader>Empresa</TableHeader>
                  <TableHeader>Valor</TableHeader>
                  <TableHeader>Cobrança</TableHeader>
                  <TableHeader>Status</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const client = getFirst(
                    entry.client
                  );

                  const company = getFirst(
                    entry.company
                  );

                  const status =
                    getFinancialEntryStatus(
                      entry
                    );

                  return (
                    <tr
                      key={entry.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/financeiro/${entry.id}`}
                          className="text-sm font-semibold text-slate-900 hover:text-[#15704f]"
                        >
                          {entry.invoice_number ??
                            "—"}
                        </Link>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(
                          entry.invoice_issued_at
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {client ? (
                          <Link
                            href={`/clientes/${client.id}`}
                            className="text-sm text-slate-700 hover:text-[#15704f]"
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

                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          Number(
                            entry.amount ?? 0
                          )
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {entry.charge_sent ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Enviada
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            Não enviada
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${FINANCIAL_ENTRY_STATUS_STYLES[status]}`}
                        >
                          {FINANCIAL_ENTRY_STATUS_LABELS[status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!entries.length && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-slate-400"
                    >
                      Nenhuma nota fiscal encontrada.
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

function getFirst<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? (value[0] ?? null)
    : value;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(
    `${value.slice(0, 10)}T12:00:00`
  );

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-BR"
  ).format(parsed);
}
