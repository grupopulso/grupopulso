import Link from "next/link";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  FileCheck2,
  FileText,
  FileX2,
  RefreshCcw,
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

type Product = {
  id: string;
  name: string;
};

type Contract = {
  id: string;
  company_id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  value: number | string | null;
  billing_frequency: string | null;
  status: string;
  auto_renew: boolean;

  company:
    | Company
    | Company[]
    | null;

  client:
    | Client
    | Client[]
    | null;

  product:
    | Product
    | Product[]
    | null;
};

export default async function RelatorioContratosPage() {
    await requireModulePermission(
  "reports",
  "view"
);
  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  let query = supabase
    .from("contracts")
    .select(`
      id,
      company_id,
      title,
      start_date,
      end_date,
      value,
      billing_frequency,
      status,
      auto_renew,

      company:companies (
        id,
        name,
        color
      ),

      client:clients (
        id,
        name
      ),

      product:products (
        id,
        name
      )
    `);

  if (selectedCompanyId) {
    query = query.eq(
      "company_id",
      selectedCompanyId
    );
  }

  const {
    data: contractsData,
    error,
  } = await query.order(
    "end_date",
    {
      ascending: true,
      nullsFirst: false,
    }
  );

  if (error) {
    console.error(
      "Erro ao carregar relatório de contratos:",
      error
    );
  }

  const contracts =
    (contractsData ?? []) as Contract[];

  const active =
    contracts.filter(
      (contract) =>
        contract.status === "active"
    );

  const expiring =
    contracts.filter(
      (contract) =>
        contract.status === "expiring"
    );

  const expired =
    contracts.filter(
      (contract) =>
        contract.status === "expired"
    );

  const cancelled =
    contracts.filter(
      (contract) =>
        contract.status === "cancelled"
    );

  const recurring =
    contracts.filter(
      (contract) =>
        contract.billing_frequency &&
        contract.billing_frequency !== "one_time" &&
        contract.status !== "cancelled"
    );

  const autoRenew =
    active.filter(
      (contract) =>
        contract.auto_renew
    );

  const monthlyRecurringRevenue =
    recurring.reduce(
      (total, contract) =>
        total +
        getMonthlyEquivalent(
          Number(
            contract.value ?? 0
          ),
          contract.billing_frequency
        ),
      0
    );

  const annualRecurringRevenue =
    monthlyRecurringRevenue * 12;

  const upcomingContracts =
    contracts
      .filter(
        (contract) =>
          contract.end_date &&
          [
            "active",
            "expiring",
          ].includes(
            contract.status
          )
      )
      .slice(0, 10);

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

        <div className="mt-5">
          <h1 className="text-2xl font-semibold text-slate-900">
            Relatório de Contratos
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {selectedCompanyId
              ? "Indicadores dos contratos da empresa selecionada."
              : "Visão consolidada dos contratos e assinaturas do Grupo Pulso."}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={FileText}
            label="Total"
            value={String(
              contracts.length
            )}
          />

          <MetricCard
            icon={FileCheck2}
            label="Ativos"
            value={String(
              active.length
            )}
            tone="green"
          />

          <MetricCard
            icon={CalendarClock}
            label="A vencer"
            value={String(
              expiring.length
            )}
            tone="orange"
          />

          <MetricCard
            icon={AlertTriangle}
            label="Vencidos"
            value={String(
              expired.length
            )}
            tone="red"
          />

          <MetricCard
            icon={FileX2}
            label="Cancelados"
            value={String(
              cancelled.length
            )}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <ValueCard
            label="Receita recorrente mensal"
            value={formatCurrency(
              monthlyRecurringRevenue
            )}
            description="Equivalente mensal dos contratos recorrentes ativos."
          />

          <ValueCard
            label="Receita recorrente anual"
            value={formatCurrency(
              annualRecurringRevenue
            )}
            description="Projeção anual baseada na recorrência atual."
          />

          <ValueCard
            label="Renovação automática"
            value={String(
              autoRenew.length
            )}
            description="Contratos ativos configurados para renovação automática."
          />
        </div>

        <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white xl:col-span-2">
            <div className="border-b border-slate-100 p-5">
              <h2 className="font-semibold text-slate-900">
                Contratos
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Relação completa dos contratos na visualização atual.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <Header>
                      Cliente
                    </Header>

                    <Header>
                      Contrato
                    </Header>

                    <Header>
                      Empresa
                    </Header>

                    <Header>
                      Produto
                    </Header>

                    <Header>
                      Valor
                    </Header>

                    <Header>
                      Vencimento
                    </Header>

                    <Header>
                      Status
                    </Header>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {contracts.map(
                    (contract) => {
                      const company =
                        getFirst<Company>(
                          contract.company
                        );

                      const client =
                        getFirst<Client>(
                          contract.client
                        );

                      const product =
                        getFirst<Product>(
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
                              <span className="text-sm text-slate-400">
                                —
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <Link
                              href={`/contratos/${contract.id}`}
                              className="text-sm font-medium text-slate-700 hover:text-[#15704f]"
                            >
                              {contract.title}
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
                            {product?.name ??
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                Number(
                                  contract.value ??
                                    0
                                )
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {getBillingLabel(
                                contract.billing_frequency
                              )}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {contract.end_date
                              ? formatDate(
                                  contract.end_date
                                )
                              : "Sem término"}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              status={
                                contract.status
                              }
                            />
                          </td>
                        </tr>
                      );
                    }
                  )}

                  {!contracts.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-14 text-center text-sm text-slate-400"
                      >
                        Nenhum contrato encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15704f]/10">
                <RefreshCcw className="h-5 w-5 text-[#15704f]" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Próximos vencimentos
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Contratos ativos e a vencer
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {upcomingContracts.map(
                (contract) => {
                  const client =
                    getFirst<Client>(
                      contract.client
                    );

                  return (
                    <Link
                      key={contract.id}
                      href={`/contratos/${contract.id}`}
                      className="block rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-[#15704f]/20 hover:bg-[#15704f]/5"
                    >
                      <p className="text-sm font-semibold text-slate-800">
                        {client?.name ??
                          contract.title}
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {contract.title}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-400">
                          {contract.end_date
                            ? formatDate(
                                contract.end_date
                              )
                            : "Sem término"}
                        </span>

                        <StatusBadge
                          status={
                            contract.status
                          }
                        />
                      </div>
                    </Link>
                  );
                }
              )}

              {!upcomingContracts.length && (
                <div className="rounded-xl bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm text-slate-400">
                    Nenhum vencimento próximo.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function getMonthlyEquivalent(
  value: number,
  frequency: string | null
) {
  switch (frequency) {
    case "monthly":
      return value;

    case "quarterly":
      return value / 3;

    case "semiannual":
      return value / 6;

    case "annual":
      return value / 12;

    default:
      return 0;
  }
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?:
    | "default"
    | "green"
    | "orange"
    | "red";
}) {
  const tones = {
    default:
      "bg-slate-100 text-slate-500",

    green:
      "bg-emerald-50 text-emerald-600",

    orange:
      "bg-amber-50 text-amber-600",

    red:
      "bg-red-50 text-red-600",
  };

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

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ValueCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-400">
        {description}
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    active:
      "bg-emerald-50 text-emerald-700",

    expiring:
      "bg-amber-50 text-amber-700",

    expired:
      "bg-red-50 text-red-700",

    cancelled:
      "bg-slate-100 text-slate-600",
  };

  const labels: Record<string, string> = {
    active: "Ativo",
    expiring: "A vencer",
    expired: "Vencido",
    cancelled: "Cancelado",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function getBillingLabel(
  frequency: string | null
) {
  const labels: Record<string, string> = {
    one_time: "Pagamento único",
    monthly: "Mensal",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    annual: "Anual",
    custom: "Personalizado",
  };

  return frequency
    ? labels[frequency] ?? frequency
    : "—";
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