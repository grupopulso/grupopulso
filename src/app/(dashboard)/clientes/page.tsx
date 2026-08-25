import Link from "next/link";
import { Search, UserPlus } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function ClientesPage() {
  const access =
    await requireModulePermission(
      "clients",
      "view"
    );

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const allowedCompanyIds =
    access.profile.role === "admin"
      ? null
      : access.companyIds;

  const {
    data: clientsData,
    error,
  } = await supabase
    .from("clients")
    .select(`
      id,
      name,
      cpf_cnpj,
      email,
      phone,
      whatsapp,
      type,

      client_companies (
        company_id,
        status,

        company:companies (
          id,
          name,
          color
        )
      )
    `)
    .order("name");

  if (error) {
    console.error(
      "Erro ao carregar clientes:",
      JSON.stringify(
        error,
        null,
        2
      )
    );
  }

  const clients =
    clientsData?.filter(
      (client) => {
        const relations =
          client.client_companies ??
          [];

        /*
         * Empresa específica selecionada.
         */
        if (
          selectedCompanyId
        ) {
          return relations.some(
            (relation) =>
              relation.company_id ===
              selectedCompanyId
          );
        }

        /*
         * Admin em "Todas as empresas".
         */
        if (
          access.profile.role ===
          "admin"
        ) {
          return true;
        }

        /*
         * Usuário comum em
         * "Todas as empresas":
         *
         * somente clientes das empresas
         * às quais ele possui acesso.
         */
        return relations.some(
          (relation) =>
            allowedCompanyIds?.includes(
              relation.company_id
            )
        );
      }
    ) ?? [];

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Clientes
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Clientes vinculados à empresa selecionada."
                : "Gerencie todos os clientes do Grupo Pulso."}
            </p>
          </div>

          <Link
            href="/clientes/novo"
            className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <UserPlus className="h-4 w-4" />
            Novo cliente
          </Link>
        </div>

        {/* RESUMO */}

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-4">
          <SummaryCard
            label="Total"
            value={clients.length}
          />

          <SummaryCard
            label="Ativos"
            value={countStatus(
              clients,
              selectedCompanyId,
              "active"
            )}
          />

          <SummaryCard
            label="A vencer"
            value={countStatus(
              clients,
              selectedCompanyId,
              "expiring"
            )}
          />

          <SummaryCard
            label="Vencidos / Cancelados"
            value={
              countStatus(
                clients,
                selectedCompanyId,
                "expired"
              ) +
              countStatus(
                clients,
                selectedCompanyId,
                "cancelled"
              )
            }
          />
        </div>

        <div className="mt-7 rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                placeholder="Buscar por nome, CPF, CNPJ..."
                className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none transition focus:border-[#15704f]"
              />
            </div>

            <p className="text-xs text-slate-400">
              {clients.length}{" "}
              {clients.length === 1
                ? "cliente"
                : "clientes"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Cliente
                  </TableHeader>

                  <TableHeader>
                    CPF / CNPJ
                  </TableHeader>

                  <TableHeader>
                    Contato
                  </TableHeader>

                  <TableHeader>
                    Empresas
                  </TableHeader>

                  <TableHeader>
                    Situação
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => {
                  /*
                   * Quando uma empresa estiver selecionada,
                   * mostramos apenas o vínculo daquela empresa.
                   *
                   * Em "Todas as empresas", mostramos todos.
                   */
                  const relations =
                    selectedCompanyId
                      ? client.client_companies?.filter(
                          (relation) =>
                            relation.company_id ===
                            selectedCompanyId
                        ) ?? []
                      : client.client_companies ?? [];

                  const companies =
                    relations.flatMap(
                      (relation) =>
                        relation.company ?? []
                    );

                  const statuses =
                    relations.map(
                      (relation) =>
                        relation.status
                    );

                  return (
                    <tr
                      key={client.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/clientes/${client.id}`}
                          className="font-medium text-slate-900 transition hover:text-[#15704f]"
                        >
                          {client.name}
                        </Link>

                        <p className="mt-1 text-xs text-slate-500">
                          {client.type === "company"
                            ? "Pessoa Jurídica"
                            : "Pessoa Física"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {client.cpf_cnpj || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-700">
                          {client.whatsapp ||
                            client.phone ||
                            "—"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {client.email || ""}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {companies.map((company) => (
                            <span
                              key={company.id}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    company.color ??
                                    "#94a3b8",
                                }}
                              />

                              {company.name}
                            </span>
                          ))}

                          {!companies.length && (
                            <span className="text-sm text-slate-400">
                              —
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={getMainStatus(
                            statuses
                          )}
                        />
                      </td>
                    </tr>
                  );
                })}

                {!clients.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-14 text-center"
                    >
                      <p className="text-sm font-medium text-slate-500">
                        Nenhum cliente encontrado.
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {selectedCompanyId
                          ? "Não há clientes vinculados à empresa selecionada."
                          : "Cadastre o primeiro cliente do Grupo Pulso."}
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
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
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

function countStatus(
  clients: {
    client_companies:
      | {
          company_id: string;
          status: string;
        }[]
      | null;
  }[],
  selectedCompanyId: string | null,
  status: string
) {
  return clients.filter((client) => {
    const relations =
      client.client_companies ?? [];

    if (selectedCompanyId) {
      return relations.some(
        (relation) =>
          relation.company_id ===
            selectedCompanyId &&
          relation.status === status
      );
    }

    return relations.some(
      (relation) =>
        relation.status === status
    );
  }).length;
}

function getMainStatus(
  statuses: string[]
) {
  /*
   * Prioridade proposital:
   *
   * vencido > a vencer > ativo > cancelado
   *
   * Em visão consolidada um cliente
   * pode possuir situações diferentes
   * em empresas distintas.
   */

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

function StatusBadge({
  status,
}: {
  status: string;
}) {
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

  const labels: Record<
    string,
    string
  > = {
    active: "Ativo",
    expiring: "A vencer",
    expired: "Vencido",
    cancelled: "Cancelado",
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