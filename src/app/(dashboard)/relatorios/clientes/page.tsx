import Link from "next/link";

import {
  AlertTriangle,
  ArrowLeft,
  FileWarning,
  MapPinOff,
  UserCheck,
  UserRoundX,
  Users,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";
type ClientRelation = {
  company_id: string;
  status: string;
};

type Address = {
  id: string;
};

type Contract = {
  id: string;
  company_id: string;
  status: string;
};

type Client = {
  id: string;
  name: string;
  cpf_cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  type: string;

  client_companies:
    | ClientRelation[]
    | null;

  client_addresses:
    | Address[]
    | null;

  contracts:
    | Contract[]
    | null;
};

export default async function RelatorioClientesPage() {
    await requireModulePermission(
  "reports",
  "view"
);
  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const {
    data: clientsData,
    error,
  } = await supabase
    .from("clients")
    .select(`
      id,
      name,
      cpf_cnpj,
      phone,
      whatsapp,
      email,
      type,

      client_companies (
        company_id,
        status
      ),

      client_addresses (
        id
      ),

      contracts (
        id,
        company_id,
        status
      )
    `)
    .order("name");

  if (error) {
    console.error(
      "Erro ao carregar relatório de clientes:",
      error
    );
  }

  const clients =
    (
      clientsData ??
      []
    ).filter(
      (client) => {
        if (!selectedCompanyId) {
          return true;
        }

        return client.client_companies?.some(
          (relation) =>
            relation.company_id ===
            selectedCompanyId
        );
      }
    ) as Client[];

  const active =
    clients.filter(
      (client) =>
        hasStatus(
          client,
          selectedCompanyId,
          "active"
        )
    );

  const expiring =
    clients.filter(
      (client) =>
        hasStatus(
          client,
          selectedCompanyId,
          "expiring"
        )
    );

  const expired =
    clients.filter(
      (client) =>
        hasStatus(
          client,
          selectedCompanyId,
          "expired"
        )
    );

  const cancelled =
    clients.filter(
      (client) =>
        hasStatus(
          client,
          selectedCompanyId,
          "cancelled"
        )
    );

  const withoutAddress =
    clients.filter(
      (client) =>
        !client.client_addresses
          ?.length
    );

  const withoutActiveContract =
    clients.filter(
      (client) => {
        const contracts =
          client.contracts ??
          [];

        if (
          selectedCompanyId
        ) {
          return !contracts.some(
            (contract) =>
              contract.company_id ===
                selectedCompanyId &&
              contract.status ===
                "active"
          );
        }

        return !contracts.some(
          (contract) =>
            contract.status ===
            "active"
        );
      }
    );

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
            Relatório de Clientes
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {selectedCompanyId
              ? "Situação dos clientes da empresa selecionada."
              : "Visão consolidada dos clientes das empresas do Grupo Pulso."}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={Users}
            label="Total"
            value={
              clients.length
            }
          />

          <MetricCard
            icon={UserCheck}
            label="Ativos"
            value={
              active.length
            }
            tone="green"
          />

          <MetricCard
            icon={AlertTriangle}
            label="A vencer"
            value={
              expiring.length
            }
            tone="orange"
          />

          <MetricCard
            icon={UserRoundX}
            label="Vencidos"
            value={
              expired.length
            }
            tone="red"
          />

          <MetricCard
            icon={UserRoundX}
            label="Cancelados"
            value={
              cancelled.length
            }
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <AlertCard
            icon={MapPinOff}
            title="Clientes sem endereço"
            value={
              withoutAddress.length
            }
            description="Clientes que precisam de endereço cadastrado para utilização em rotas e entregas."
          />

          <AlertCard
            icon={FileWarning}
            title="Sem contrato ativo"
            value={
              withoutActiveContract.length
            }
            description="Clientes cadastrados que não possuem contrato ativo na visualização atual."
          />
        </div>

        <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-900">
              Situação dos clientes
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Relação completa dos clientes da visualização atual.
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
                    CPF / CNPJ
                  </Header>

                  <Header>
                    Contato
                  </Header>

                  <Header>
                    Endereço
                  </Header>

                  <Header>
                    Contrato ativo
                  </Header>

                  <Header>
                    Situação
                  </Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {clients.map(
                  (client) => {
                    const statuses =
                      getStatuses(
                        client,
                        selectedCompanyId
                      );

                    const mainStatus =
                      getMainStatus(
                        statuses
                      );

                    const hasAddress =
                      Boolean(
                        client
                          .client_addresses
                          ?.length
                      );

                    const hasContract =
                      hasActiveContract(
                        client,
                        selectedCompanyId
                      );

                    return (
                      <tr
                        key={client.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/clientes/${client.id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-[#15704f]"
                          >
                            {client.name}
                          </Link>

                          <p className="mt-1 text-xs text-slate-400">
                            {client.type ===
                            "company"
                              ? "Pessoa Jurídica"
                              : "Pessoa Física"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {client.cpf_cnpj ||
                            "—"}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-700">
                            {client.whatsapp ||
                              client.phone ||
                              "—"}
                          </p>

                          {client.email && (
                            <p className="mt-1 text-xs text-slate-400">
                              {client.email}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {hasAddress ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Cadastrado
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Sem endereço
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {hasContract ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Sim
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                              Não
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={
                              mainStatus
                            }
                          />
                        </td>
                      </tr>
                    );
                  }
                )}

                {!clients.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-14 text-center text-sm text-slate-400"
                    >
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function hasStatus(
  client: Client,
  selectedCompanyId:
    | string
    | null,
  status: string
) {
  const relations =
    client.client_companies ??
    [];

  if (
    selectedCompanyId
  ) {
    return relations.some(
      (relation) =>
        relation.company_id ===
          selectedCompanyId &&
        relation.status ===
          status
    );
  }

  return relations.some(
    (relation) =>
      relation.status ===
      status
  );
}

function getStatuses(
  client: Client,
  selectedCompanyId:
    | string
    | null
) {
  const relations =
    client.client_companies ??
    [];

  if (
    selectedCompanyId
  ) {
    return relations
      .filter(
        (relation) =>
          relation.company_id ===
          selectedCompanyId
      )
      .map(
        (relation) =>
          relation.status
      );
  }

  return relations.map(
    (relation) =>
      relation.status
  );
}

function getMainStatus(
  statuses: string[]
) {
  if (
    statuses.includes(
      "expired"
    )
  ) {
    return "expired";
  }

  if (
    statuses.includes(
      "expiring"
    )
  ) {
    return "expiring";
  }

  if (
    statuses.includes(
      "active"
    )
  ) {
    return "active";
  }

  if (
    statuses.includes(
      "cancelled"
    )
  ) {
    return "cancelled";
  }

  return "active";
}

function hasActiveContract(
  client: Client,
  selectedCompanyId:
    | string
    | null
) {
  const contracts =
    client.contracts ?? [];

  if (
    selectedCompanyId
  ) {
    return contracts.some(
      (contract) =>
        contract.company_id ===
          selectedCompanyId &&
        contract.status ===
          "active"
    );
  }

  return contracts.some(
    (contract) =>
      contract.status ===
      "active"
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
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

function AlertCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: React.ElementType;
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <Icon className="h-5 w-5 text-amber-700" />
        </div>

        <div>
          <p className="text-sm font-semibold text-amber-800">
            {title}
          </p>

          <p className="mt-2 text-2xl font-semibold text-amber-900">
            {value}
          </p>

          <p className="mt-2 text-xs leading-5 text-amber-700">
            {description}
          </p>
        </div>
      </div>
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
  const labels: Record<
    string,
    string
  > = {
    active: "Ativo",
    expiring: "A vencer",
    expired: "Vencido",
    cancelled: "Cancelado",
  };

  const styles: Record<
    string,
    string
  > = {
    active:
      "bg-emerald-50 text-emerald-700",

    expiring:
      "bg-amber-50 text-amber-700",

    expired:
      "bg-red-50 text-red-700",

    cancelled:
      "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        styles.active
      }`}
    >
      {labels[status] ??
        status}
    </span>
  );
}