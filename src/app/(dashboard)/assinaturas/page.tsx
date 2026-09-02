import Link from "next/link";
import { FilePlus2 } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_STYLES,
  getContractStatus,
} from "@/app/lib/contract-status";

import RenewContractButton from "../contratos/[id]/renew-contract-button";

const PAGE_SIZE = 20;

type ContractStatusFilter =
  | "all"
  | ReturnType<typeof getContractStatus>;

const STATUS_FILTER_OPTIONS: {
  value: ContractStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "Todos os status" },
  { value: "active", label: CONTRACT_STATUS_LABELS.active },
  { value: "expiring", label: CONTRACT_STATUS_LABELS.expiring },
  { value: "expired", label: CONTRACT_STATUS_LABELS.expired },
  { value: "cancelled", label: CONTRACT_STATUS_LABELS.cancelled },
];

type PageProps = {
  searchParams: Promise<{
    page?: string;
    status?: string;
    q?: string;
  }>;
};

export default async function AssinaturasPage({
  searchParams,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const {
    page: pageParam,
    status: statusParam,
    q: qParam,
  } = await searchParams;

  const supabase =
    await createClient();

  const statusFilter: ContractStatusFilter =
    STATUS_FILTER_OPTIONS.some(
      (option) => option.value === statusParam
    )
      ? (statusParam as ContractStatusFilter)
      : "all";

  const search =
    (qParam ?? "").trim();

  /*
   * Escopo fixo no O Estafeta — assinaturas não
   * seguem o seletor global de empresa, igual às
   * demais telas exclusivas do jornal (ex.: /edicoes).
   */

  const { data: contractsData, error } =
    await supabase
      .from("contracts")
      .select(`
        id,
        title,
        start_date,
        end_date,
        value,
        billing_frequency,
        status,
        auto_renew,
        legacy_subscription_number,

        client:clients (
          id,
          name
        ),

        product:products (
          id,
          name,
          type
        )
      `)
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    console.error(
      "Erro ao buscar assinaturas:",
      error
    );
  }

  /*
   * Filtro de "é assinatura": nem todo contrato do
   * O Estafeta é assinatura de jornal (também há
   * publicidade). As assinaturas importadas do
   * legado não têm produto vinculado (product_id
   * null), então o filtro não pode depender só do
   * tipo do produto — usa também o código legado.
   */

  const allContracts = (
    contractsData ?? []
  ).filter((contract) => {
    const product = getFirst(
      contract.product
    );

    return (
      product?.type ===
        "subscription" ||
      Boolean(
        contract.legacy_subscription_number
      )
    );
  });

  const normalizedSearch =
    search.toLocaleLowerCase("pt-BR");

  const filteredContracts =
    allContracts.filter((contract) => {
      const client = getFirst(
        contract.client
      );

      const matchesSearch =
        !normalizedSearch ||
        contract.title
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch) ||
        (client?.name ?? "")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch) ||
        (contract.legacy_subscription_number ?? "")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        getContractStatus(contract) ===
          statusFilter;

      return matchesSearch && matchesStatus;
    });

  const totalContracts =
    filteredContracts.length;

  const totalPages = Math.max(
    1,
    Math.ceil(totalContracts / PAGE_SIZE)
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

  const contracts =
    filteredContracts.slice(
      pageStart,
      pageStart + PAGE_SIZE
    );

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

    if (targetPage > 1) {
      params.set(
        "page",
        String(targetPage)
      );
    }

    const queryString =
      params.toString();

    return queryString
      ? `/assinaturas?${queryString}`
      : "/assinaturas";
  };

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Assinaturas — O Estafeta
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Assinantes do jornal, vencimentos e renovações.
            </p>
          </div>

          <Link
            href="/contratos/novo"
            className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <FilePlus2 className="h-4 w-4" />
            Nova assinatura
          </Link>
        </div>

        <form
          method="get"
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
        >
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Buscar por assinante ou código..."
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

          <button
            type="submit"
            className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Filtrar
          </button>

          {(search || statusFilter !== "all") && (
            <Link
              href="/assinaturas"
              className="text-sm font-medium text-slate-500 hover:text-slate-900 sm:px-2"
            >
              Limpar filtros
            </Link>
          )}
        </form>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Assinante
                  </TableHeader>

                  <TableHeader>
                    Código
                  </TableHeader>

                  <TableHeader>
                    Vigência
                  </TableHeader>

                  <TableHeader>
                    Valor
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Ações
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {contracts.map((contract) => {
                  const client = getFirst(
                    contract.client
                  );

                  const status =
                    getContractStatus(
                      contract
                    );

                  return (
                    <tr
                      key={contract.id}
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
                          <span className="text-sm font-semibold text-slate-400">
                            —
                          </span>
                        )}

                        <Link
                          href={`/contratos/${contract.id}`}
                          className="mt-1 block text-xs font-medium text-[#15704f] hover:underline"
                        >
                          {contract.title}
                        </Link>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {contract.legacy_subscription_number ??
                          "—"}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-700">
                          {formatDate(
                            contract.start_date
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          até{" "}
                          {contract.end_date
                            ? formatDate(
                                contract.end_date
                              )
                            : "sem término"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            Number(
                              contract.value
                            )
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {getBillingLabel(
                            contract.billing_frequency
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={status}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {status !==
                            "cancelled" && (
                            <RenewContractButton
                              contractId={
                                contract.id
                              }
                              contractTitle={
                                contract.title
                              }
                              compact
                            />
                          )}

                          <Link
                            href={`/contratos/${contract.id}/recibo-assinatura`}
                            target="_blank"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Recibo
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!contracts.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-slate-400"
                    >
                      {totalContracts === 0 &&
                      (search || statusFilter !== "all")
                        ? "Nenhuma assinatura encontrada para esse filtro."
                        : "Nenhuma assinatura cadastrada."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {totalContracts === 0
                ? "Nenhuma assinatura"
                : `Mostrando ${pageStart + 1}–${Math.min(
                    pageStart + PAGE_SIZE,
                    totalContracts
                  )} de ${totalContracts} assinatura${
                    totalContracts === 1 ? "" : "s"
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
  status: ReturnType<typeof getContractStatus>;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONTRACT_STATUS_STYLES[status]}`}
    >
      {CONTRACT_STATUS_LABELS[status]}
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

function formatDate(
  date: string | null
) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(
    `${date}T12:00:00`
  );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-BR"
  ).format(parsed);
}

function formatCurrency(
  value: number | null
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(value ?? 0);
}

function getBillingLabel(
  frequency: string | null
) {
  const labels: Record<string, string> = {
    one_time:
      "Pagamento único",
    monthly:
      "Mensal",
    quarterly:
      "Trimestral",
    semiannual:
      "Semestral",
    annual:
      "Anual",
    custom:
      "Personalizado",
  };

  return frequency
    ? labels[frequency] ??
        frequency
    : "—";
}
