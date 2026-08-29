import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";
import {
  calculateEntryOpenAmount,
  calculateEntryTotal,
  FINANCIAL_ENTRY_STATUS_LABELS,
  FINANCIAL_ENTRY_STATUS_STYLES,
  getFinancialEntryStatus,
} from "@/app/lib/financial-entry-status";

const PAGE_SIZE = 20;

type StatusFilter =
  | "all"
  | "open"
  | ReturnType<typeof getFinancialEntryStatus>;

const STATUS_FILTER_OPTIONS: {
  value: StatusFilter;
  label: string;
}[] = [
  { value: "all", label: "Todos os status" },
  { value: "open", label: "Em aberto" },
  { value: "pending", label: FINANCIAL_ENTRY_STATUS_LABELS.pending },
  { value: "overdue", label: FINANCIAL_ENTRY_STATUS_LABELS.overdue },
  { value: "partial", label: FINANCIAL_ENTRY_STATUS_LABELS.partial },
  { value: "paid", label: FINANCIAL_ENTRY_STATUS_LABELS.paid },
  { value: "cancelled", label: FINANCIAL_ENTRY_STATUS_LABELS.cancelled },
];

const OPEN_STATUSES = [
  "pending",
  "partial",
  "overdue",
];

type PageProps = {
  searchParams: Promise<{
    page?: string;
    status?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function ContasReceberPage({
  searchParams,
}: PageProps) {
  const access =
    await requireModulePermission(
      "accounts_receivable",
      "view"
    );

  const {
    page: pageParam,
    status: statusParam,
    q: qParam,
    from: fromParam,
    to: toParam,
  } = await searchParams;

  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const statusFilter: StatusFilter =
    STATUS_FILTER_OPTIONS.some(
      (option) => option.value === statusParam
    )
      ? (statusParam as StatusFilter)
      : "all";

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

      client:clients (
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
    .eq("type", "income");

  if (selectedCompanyId) {
    query = query.eq(
      "company_id",
      selectedCompanyId
    );
  } else if (
    access.profile.role !== "admin"
  ) {
    if (
      access.companyIds.length > 0
    ) {
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

  const { data: entriesData, error } =
    await query.order("due_date", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Erro ao carregar contas a receber:",
      error
    );
  }

  const normalized =
    entriesData?.map((entry) => ({
      ...entry,
      calculatedStatus:
        getFinancialEntryStatus(entry),
    })) ?? [];

  const openTotal = normalized
    .filter((entry) =>
      ["pending", "partial", "overdue"].includes(
        entry.calculatedStatus
      )
    )
    .reduce(
      (total, entry) =>
        total + calculateEntryOpenAmount(entry),
      0
    );

  const upcomingTotal = normalized
    .filter(
      (entry) =>
        entry.calculatedStatus === "pending"
    )
    .reduce(
      (total, entry) =>
        total + calculateEntryOpenAmount(entry),
      0
    );

  const overdueTotal = normalized
    .filter(
      (entry) =>
        entry.calculatedStatus === "overdue"
    )
    .reduce(
      (total, entry) =>
        total + calculateEntryOpenAmount(entry),
      0
    );

  const receivedTotal = normalized.reduce(
    (total, entry) =>
      total + Number(entry.amount_paid),
    0
  );

  /*
   * Filtro por texto (cliente ou descrição) e por status — feito em
   * memória, no servidor, pelo mesmo motivo do /contratos: o status
   * exibido é calculado na hora (getFinancialEntryStatus), não é uma
   * coluna confiável pra filtrar direto no banco.
   */

  const normalizedSearch =
    search.toLocaleLowerCase("pt-BR");

  const filteredEntries =
    normalized.filter((entry) => {
      const client = getFirst(entry.client);

      const matchesSearch =
        !normalizedSearch ||
        entry.description
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch) ||
        (client?.name ?? "")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "open"
          ? OPEN_STATUSES.includes(
              entry.calculatedStatus
            )
          : entry.calculatedStatus ===
            statusFilter);

      const matchesDate =
        (!dateFrom ||
          entry.due_date >= dateFrom) &&
        (!dateTo ||
          entry.due_date <= dateTo);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDate
      );
    });

  const totalEntries =
    filteredEntries.length;

  const totalPages = Math.max(
    1,
    Math.ceil(totalEntries / PAGE_SIZE)
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

  const pagedEntries =
    filteredEntries.slice(
      pageStart,
      pageStart + PAGE_SIZE
    );

  const buildStatusHref = (
    targetStatus: StatusFilter
  ) => {
    const params = new URLSearchParams();

    if (targetStatus !== "all") {
      params.set("status", targetStatus);
    }

    if (search) {
      params.set("q", search);
    }

    if (dateFrom) {
      params.set("from", dateFrom);
    }

    if (dateTo) {
      params.set("to", dateTo);
    }

    const queryString = params.toString();

    return queryString
      ? `/financeiro/receber?${queryString}`
      : "/financeiro/receber";
  };

  const buildPageHref = (
    targetPage: number
  ) => {
    const params = new URLSearchParams();

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

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
      ? `/financeiro/receber?${queryString}`
      : "/financeiro/receber";
  };

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/financeiro"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao financeiro
        </Link>

        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Contas a Receber
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Receitas e valores a receber da empresa selecionada."
                : "Acompanhe todas as receitas pendentes das empresas do Grupo Pulso."}
            </p>
          </div>

          <Link
            href="/financeiro/novo?tipo=income"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <Plus className="h-4 w-4" />
            Nova receita
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Em aberto"
            value={formatCurrency(openTotal)}
            href={buildStatusHref("open")}
            active={statusFilter === "open"}
          />

          <SummaryCard
            label="A vencer"
            value={formatCurrency(upcomingTotal)}
            href={buildStatusHref("pending")}
            active={statusFilter === "pending"}
          />

          <SummaryCard
            label="Vencido"
            value={formatCurrency(overdueTotal)}
            tone="red"
            href={buildStatusHref("overdue")}
            active={statusFilter === "overdue"}
          />

          <SummaryCard
            label="Recebido"
            value={formatCurrency(receivedTotal)}
            tone="green"
            href={buildStatusHref("paid")}
            active={statusFilter === "paid"}
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

          <select
            name="status"
            defaultValue={statusFilter}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-[#15704f]"
          >
            {STATUS_FILTER_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>

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

          {(search ||
            statusFilter !== "all" ||
            dateFrom ||
            dateTo) && (
            <Link
              href="/financeiro/receber"
              className="text-sm font-medium text-slate-500 hover:text-slate-900 sm:px-2"
            >
              Limpar filtros
            </Link>
          )}
        </form>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Receitas
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {totalEntries}{" "}
                  {totalEntries === 1
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
                  <TableHeader>Cliente</TableHeader>
                  <TableHeader>Descrição</TableHeader>
                  <TableHeader>Empresa</TableHeader>
                  <TableHeader>Categoria</TableHeader>
                  <TableHeader>Vencimento</TableHeader>
                  <TableHeader>Valor</TableHeader>
                  <TableHeader>Saldo</TableHeader>
                  <TableHeader>Status</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {pagedEntries.map((entry) => {
                  const client = getFirst(entry.client);
                  const company = getFirst(entry.company);
                  const category = getFirst(entry.category);

                  return (
                    <tr
                      key={entry.id}
                      className="transition hover:bg-slate-50"
                    >
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
                                company?.color ?? "#94a3b8",
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
                            calculateEntryTotal(entry)
                          )}
                        </p>

                        {Number(entry.amount_paid) > 0 && (
                          <p className="mt-1 text-xs text-slate-400">
                            Recebido:{" "}
                            {formatCurrency(
                              Number(entry.amount_paid)
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
                            calculateEntryOpenAmount(entry)
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={entry.calculatedStatus}
                        />
                      </td>
                    </tr>
                  );
                })}

                {!pagedEntries.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-14 text-center"
                    >
                      <p className="text-sm font-medium text-slate-500">
                        {totalEntries === 0 &&
                        (search ||
                          statusFilter !== "all" ||
                          dateFrom ||
                          dateTo)
                          ? "Nenhum lançamento encontrado para esse filtro."
                          : "Nenhuma conta a receber encontrada."}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {selectedCompanyId
                          ? "Não há receitas cadastradas para a empresa selecionada."
                          : "Cadastre uma receita para começar o controle financeiro."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {totalEntries === 0
                ? "Nenhum lançamento"
                : `Mostrando ${pageStart + 1}–${Math.min(
                    pageStart + PAGE_SIZE,
                    totalEntries
                  )} de ${totalEntries} lançamento${
                    totalEntries === 1 ? "" : "s"
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
  tone = "default",
  href,
  active = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "red" | "green";
  href?: string;
  active?: boolean;
}) {
  const valueClass =
    tone === "red"
      ? "text-red-700"
      : tone === "green"
        ? "text-emerald-700"
        : "text-slate-900";

  const base =
    "block rounded-2xl border bg-white p-5 transition";

  const inner = (
    <>
      <p className="flex items-center justify-between text-sm text-slate-500">
        {label}

        {active && (
          <span className="text-xs font-semibold text-[#15704f]">
            filtrado
          </span>
        )}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold ${valueClass}`}
      >
        {value}
      </p>
    </>
  );

  if (!href) {
    return (
      <div className={`${base} border-slate-200`}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} ${
        active
          ? "border-[#15704f] ring-1 ring-[#15704f]/20"
          : "border-slate-200 hover:border-[#15704f]/40 hover:shadow-sm"
      }`}
    >
      {inner}
    </Link>
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

function StatusBadge({
  status,
}: {
  status: ReturnType<typeof getFinancialEntryStatus>;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${FINANCIAL_ENTRY_STATUS_STYLES[status]}`}
    >
      {FINANCIAL_ENTRY_STATUS_LABELS[status]}
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
    new Date(
      `${date}T12:00:00`
    )
  );
}
