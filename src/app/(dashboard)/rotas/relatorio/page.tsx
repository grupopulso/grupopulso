import Link from "next/link";

import {
  ArrowLeft,
  Route,
  Truck,
  Users,
  AlertTriangle,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";
import PrintLandscape from "@/app/components/print-landscape";

type Company = {
  id: string;
  name: string;
  color: string | null;
};

type Driver = {
  id: string;
  name: string;
};

export default async function RelatorioRotasPage() {
  const access =
    await requireModulePermission(
      "routes",
      "view"
    );

  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  let query = supabase
    .from("delivery_routes")
    .select(`
      id,
      company_id,
      name,
      region,
      active,

      company:companies (
        id,
        name,
        color
      ),

      driver:delivery_drivers (
        id,
        name
      ),

      delivery_route_clients (
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

  const { data: routes, error } =
    await query;

  if (error) {
    console.error(
      "Erro ao carregar relatório de rotas:",
      error
    );
  }

  const normalized =
    routes?.map((route) => {
      const company =
        getFirst<Company>(
          route.company
        );

      const driver =
        getFirst<Driver>(
          route.driver
        );

      const subscribers =
        (
          route.delivery_route_clients ??
          []
        ).filter(
          (relation) =>
            relation.active
        ).length;

      return {
        ...route,
        company,
        driver,
        subscribers,
      };
    }) ?? [];

  const activeRoutes =
    normalized.filter(
      (route) => route.active
    ).length;

  const totalSubscribers =
    normalized.reduce(
      (total, route) =>
        total +
        route.subscribers,
      0
    );

  const withoutDriver =
    normalized.filter(
      (route) =>
        !route.driver
    ).length;

  const driverStats =
    createDriverStats(
      normalized
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <PrintLandscape />

      <div className="mx-auto max-w-7xl">
        <Link
          href="/rotas"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para rotas
        </Link>

        <div className="mt-5">
          <h1 className="text-2xl font-semibold text-slate-900">
            Relatório de Rotas
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {selectedCompanyId
              ? "Visão operacional das rotas da empresa selecionada."
              : "Visão consolidada das rotas e entregas do Grupo Pulso."}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Route}
            label="Rotas"
            value={String(
              normalized.length
            )}
          />

          <SummaryCard
            icon={Route}
            label="Rotas ativas"
            value={String(
              activeRoutes
            )}
          />

          <SummaryCard
            icon={Users}
            label="Assinantes em rotas"
            value={String(
              totalSubscribers
            )}
          />

          <SummaryCard
            icon={AlertTriangle}
            label="Sem entregador"
            value={String(
              withoutDriver
            )}
            alert={
              withoutDriver > 0
            }
          />
        </div>

        <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white xl:col-span-2">
            <div className="border-b border-slate-100 p-5">
              <h2 className="font-semibold text-slate-900">
                Distribuição das rotas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Quantidade de assinantes por rota e entregador responsável.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <Header>
                      Rota
                    </Header>

                    <Header>
                      Empresa
                    </Header>

                    <Header>
                      Região
                    </Header>

                    <Header>
                      Entregador
                    </Header>

                    <Header>
                      Assinantes
                    </Header>

                    <Header>
                      Situação
                    </Header>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {normalized.map(
                    (route) => (
                      <tr
                        key={route.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/rotas/${route.id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-[#15704f]"
                          >
                            {route.name}
                          </Link>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  route.company?.color ??
                                  "#94a3b8",
                              }}
                            />

                            <span className="text-sm text-slate-600">
                              {route.company?.name ??
                                "—"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {route.region ||
                            "—"}
                        </td>

                        <td className="px-5 py-4">
                          {route.driver ? (
                            <span className="text-sm font-medium text-slate-700">
                              {
                                route.driver.name
                              }
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Sem entregador
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {
                            route.subscribers
                          }
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            active={
                              route.active
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}

                  {!normalized.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-sm text-slate-400"
                      >
                        Nenhuma rota encontrada.
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
                <Truck className="h-5 w-5 text-[#15704f]" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Por entregador
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Distribuição atual
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {driverStats.map(
                (driver) => (
                  <div
                    key={driver.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      {driver.name}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-400">
                          Rotas
                        </p>

                        <p className="mt-1 text-lg font-semibold text-slate-800">
                          {
                            driver.routes
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Entregas
                        </p>

                        <p className="mt-1 text-lg font-semibold text-slate-800">
                          {
                            driver.subscribers
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}

              {!driverStats.length && (
                <p className="py-8 text-center text-sm text-slate-400">
                  Nenhum entregador com rota atribuída.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function createDriverStats(
  routes: {
    driver: Driver | null;
    subscribers: number;
  }[]
) {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      routes: number;
      subscribers: number;
    }
  >();

  for (const route of routes) {
    if (!route.driver) {
      continue;
    }

    const existing =
      map.get(
        route.driver.id
      );

    if (existing) {
      existing.routes += 1;
      existing.subscribers +=
        route.subscribers;
    } else {
      map.set(
        route.driver.id,
        {
          id:
            route.driver.id,

          name:
            route.driver.name,

          routes: 1,

          subscribers:
            route.subscribers,
        }
      );
    }
  }

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      b.subscribers -
      a.subscribers
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  alert = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-semibold ${
              alert
                ? "text-amber-700"
                : "text-slate-900"
            }`}
          >
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            alert
              ? "bg-amber-50"
              : "bg-[#15704f]/10"
          }`}
        >
          <Icon
            className={`h-5 w-5 ${
              alert
                ? "text-amber-600"
                : "text-[#15704f]"
            }`}
          />
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
      {active
        ? "Ativa"
        : "Inativa"}
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