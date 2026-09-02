import Link from "next/link";
import { FilePlus2 } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_STYLES,
  getContractStatus,
} from "@/app/lib/contract-status";

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

export default async function ContratosPage({
  searchParams,
}: PageProps) {
  const access =
    await requireModulePermission(
      "contracts",
      "view"
    );

  const {
    page: pageParam,
    status: statusParam,
    q: qParam,
  } = await searchParams;

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const statusFilter: ContractStatusFilter =
    STATUS_FILTER_OPTIONS.some(
      (option) => option.value === statusParam
    )
      ? (statusParam as ContractStatusFilter)
      : "all";

  const search =
    (qParam ?? "").trim();

  let query = supabase
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

      company:companies (
        id,
        name,
        color
      ),

      product:products (
        id,
        name,
        type
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

  const { data: contractsData, error } =
    await query.order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Erro ao buscar contratos:",
      error
    );
  }

  /*
   * Assinaturas do jornal (O Estafeta) têm tela própria em
   * /assinaturas, com o mesmo critério usado lá: produto do tipo
   * "subscription" OU contrato com número de assinatura legado.
   * Elas não devem aparecer duplicadas aqui em /contratos — esta
   * lista fica só com anúncios, vendas avulsas, contratos da
   * Agência Atthus e da Pottencializa.
   */
  const isSubscriptionContract = (
    contract: {
      legacy_subscription_number:
        | string
        | null;
      product:
        | { type: string | null }
        | { type: string | null }[]
        | null;
    }
  ) => {
    const product = getFirst(
      contract.product
    );

    return (
      product?.type === "subscription" ||
      Boolean(
        contract.legacy_subscription_number
      )
    );
  };

  const allContracts = (
    contractsData ?? []
  ).filter(
    (contract) =>
      !isSubscriptionContract(contract)
  );

  /*
   * Filtro por texto (cliente ou título do contrato) e por status
   * calculado — feitos aqui, em vez de na query, porque o status
   * exibido não é o valor cru gravado no banco (veja
   * @/app/lib/contract-status).
   */

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
      ? `/contratos?${queryString}`
      : "/contratos";
  };

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Contratos
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Gerencie os contratos da empresa selecionada."
                : "Gerencie contratos e serviços recorrentes do Grupo Pulso."}
            </p>
          </div>

          <Link
            href="/contratos/novo"
            className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <FilePlus2 className="h-4 w-4" />
            Novo contrato
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
            placeholder="Buscar por cliente ou contrato..."
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
              href="/contratos"
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
                    Cliente
                  </TableHeader>

                  <TableHeader>
                    Produto / Serviço
                  </TableHeader>

                  <TableHeader>
                    Empresa
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
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {contracts.map((contract) => {
                  const client = getFirst(
                    contract.client
                  );

                  const company = getFirst(
                    contract.company
                  );

                  const product = getFirst(
                    contract.product
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
                        {product?.name ?? "—"}
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

                          <span className="text-sm text-slate-700">
                            {company?.name ?? "—"}
                          </span>
                        </div>
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
                          status={getContractStatus(
                            contract
                          )}
                        />
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
                        ? "Nenhum contrato encontrado para esse filtro."
                        : selectedCompanyId
                          ? "Nenhum contrato cadastrado para a empresa selecionada."
                          : "Nenhum contrato cadastrado."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {totalContracts === 0
                ? "Nenhum contrato"
                : `Mostrando ${pageStart + 1}–${Math.min(
                    pageStart + PAGE_SIZE,
                    totalContracts
                  )} de ${totalContracts} contrato${
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
