import Link from "next/link";

import {
  ArrowLeft,
  Phone,
  Plus,
  Truck,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";

type Company = {
  id: string;
  name: string;
  color: string | null;
};

export default async function EntregadoresPage() {
  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  let query = supabase
    .from("delivery_drivers")
    .select(`
      id,
      company_id,
      name,
      phone,
      whatsapp,
      notes,
      active,

      company:companies (
        id,
        name,
        color
      ),

      delivery_routes (
        id,
        active
      )
    `)
    .order("name");

  if (selectedCompanyId) {
    query = query.eq(
      "company_id",
      selectedCompanyId
    );
  }

  const {
    data: drivers,
    error,
  } = await query;

  if (error) {
    console.error(
      "Erro ao carregar entregadores:",
      error
    );
  }

  const activeDrivers =
    drivers?.filter(
      (driver) => driver.active
    ).length ?? 0;

  const totalRoutes =
    drivers?.reduce(
      (total, driver) =>
        total +
        (
          driver.delivery_routes ??
          []
        ).filter(
          (route) => route.active
        ).length,
      0
    ) ?? 0;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/rotas"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para rotas
        </Link>

        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Entregadores
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Gerencie os entregadores da empresa selecionada."
                : "Gerencie os entregadores das empresas do Grupo Pulso."}
            </p>
          </div>

          <Link
            href="/rotas/entregadores/novo"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <Plus className="h-4 w-4" />
            Novo entregador
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
          <SummaryCard
            label="Entregadores"
            value={String(
              drivers?.length ?? 0
            )}
          />

          <SummaryCard
            label="Ativos"
            value={String(
              activeDrivers
            )}
          />

          <SummaryCard
            label="Rotas vinculadas"
            value={String(
              totalRoutes
            )}
          />
        </div>

        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <Header>
                    Entregador
                  </Header>

                  <Header>
                    Empresa
                  </Header>

                  <Header>
                    Contato
                  </Header>

                  <Header>
                    Rotas
                  </Header>

                  <Header>
                    Situação
                  </Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {drivers?.map(
                  (driver) => {
                    const company =
                      getFirst<Company>(
                        driver.company
                      );

                    const activeRoutes =
                      (
                        driver.delivery_routes ??
                        []
                      ).filter(
                        (route) =>
                          route.active
                      ).length;

                    return (
                      <tr
                        key={driver.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/rotas/entregadores/${driver.id}`}
                            className="flex items-center gap-3"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#15704f]/10">
                              <Truck className="h-5 w-5 text-[#15704f]" />
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {
                                  driver.name
                                }
                              </p>

                              {driver.notes && (
                                <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                                  {
                                    driver.notes
                                  }
                                </p>
                              )}
                            </div>
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

                        <td className="px-5 py-4">
                          {driver.whatsapp ||
                          driver.phone ? (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone className="h-4 w-4 text-slate-400" />

                              {driver.whatsapp ||
                                driver.phone}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">
                              —
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-sm font-semibold text-slate-700">
                            {activeRoutes}
                          </span>

                          <span className="ml-1 text-xs text-slate-400">
                            {activeRoutes === 1
                              ? "rota"
                              : "rotas"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            active={
                              driver.active
                            }
                          />
                        </td>
                      </tr>
                    );
                  }
                )}

                {!drivers?.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-14 text-center"
                    >
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                        <Truck className="h-6 w-6 text-slate-400" />
                      </div>

                      <p className="mt-4 text-sm font-semibold text-slate-600">
                        Nenhum entregador cadastrado
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Cadastre um entregador para vinculá-lo às rotas.
                      </p>

                      <Link
                        href="/rotas/entregadores/novo"
                        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white"
                      >
                        <Plus className="h-4 w-4" />
                        Novo entregador
                      </Link>
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

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "Ativo" : "Inativo"}
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