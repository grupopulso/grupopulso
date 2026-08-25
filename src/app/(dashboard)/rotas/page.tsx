import Link from "next/link";

import {
  MapPinned,
  Plus,
  Printer,
  Route,
  Truck,
  Users,
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

type Driver = {
  id: string;
  name: string;
};

export default async function RotasPage() {
  const access =
    await requireModulePermission(
      "routes",
      "view"
    );

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  let routesQuery = supabase
    .from("delivery_routes")
    .select(`
      id,
      company_id,
      name,
      description,
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
        id
      )
    `);

  if (selectedCompanyId) {
  routesQuery =
    routesQuery.eq(
      "company_id",
      selectedCompanyId
    );
} else if (
  access.profile.role !==
  "admin"
) {
  if (
    access.companyIds.length > 0
  ) {
    routesQuery =
      routesQuery.in(
        "company_id",
        access.companyIds
      );
  } else {
    routesQuery =
      routesQuery.eq(
        "company_id",
        "00000000-0000-0000-0000-000000000000"
      );
  }
}

  const { data: routes, error } =
    await routesQuery.order("name");

  if (error) {
    console.error(
      "Erro ao carregar rotas:",
      error
    );
  }

  let driversQuery = supabase
    .from("delivery_drivers")
    .select(`
      id,
      company_id,
      active
    `)
    .eq("active", true);

 if (selectedCompanyId) {
  driversQuery =
    driversQuery.eq(
      "company_id",
      selectedCompanyId
    );
} else if (
  access.profile.role !==
  "admin"
) {
  if (
    access.companyIds.length > 0
  ) {
    driversQuery =
      driversQuery.in(
        "company_id",
        access.companyIds
      );
  } else {
    driversQuery =
      driversQuery.eq(
        "company_id",
        "00000000-0000-0000-0000-000000000000"
      );
  }
}

  const { data: drivers } =
    await driversQuery;

  const activeRoutes =
    routes?.filter(
      (route) => route.active
    ).length ?? 0;

  const totalSubscribers =
    routes?.reduce(
      (total, route) =>
        total +
        (
          route.delivery_route_clients ??
          []
        ).length,
      0
    ) ?? 0;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        {/* CABEÇALHO */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Rotas e Entregas
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Gerencie as rotas e entregadores da empresa selecionada."
                : "Gerencie as rotas, entregadores e assinantes do Grupo Pulso."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/rotas/entregadores"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#15704f]/30 hover:text-[#15704f]"
            >
              <Truck className="h-4 w-4" />
              Entregadores
            </Link>

            <Link
              href="/rotas/nova"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
            >
              <Plus className="h-4 w-4" />
              Nova rota
            </Link>
          </div>
        </div>

        {/* RESUMO */}

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
          <SummaryCard
            icon={Route}
            label="Rotas ativas"
            value={String(activeRoutes)}
          />

          <SummaryCard
            icon={Truck}
            label="Entregadores"
            value={String(
              drivers?.length ?? 0
            )}
          />

          <SummaryCard
            icon={Users}
            label="Assinantes em rotas"
            value={String(
              totalSubscribers
            )}
          />
        </div>

        {/* LISTAGEM */}

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          {routes?.map((route) => {
            const company = getFirst<Company>(
              route.company
            );

            const driver = getFirst<Driver>(
              route.driver
            );

            const subscribers =
              route.delivery_route_clients
                ?.length ?? 0;

            return (
              <div
                key={route.id}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#15704f]/10">
                      <MapPinned className="h-5 w-5 text-[#15704f]" />
                    </div>

                    <div>
                      <Link
                        href={`/rotas/${route.id}`}
                        className="text-lg font-semibold text-slate-900 transition hover:text-[#15704f]"
                      >
                        {route.name}
                      </Link>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {company && (
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
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
                        )}

                        <RouteStatusBadge
                          active={route.active}
                        />
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/rotas/${route.id}/imprimir`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-[#15704f] hover:text-[#15704f]"
                    title="Imprimir rota"
                  >
                    <Printer className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <InfoBox
                    label="Entregador"
                    value={
                      driver?.name ??
                      "Não definido"
                    }
                  />

                  <InfoBox
                    label="Assinantes"
                    value={String(
                      subscribers
                    )}
                  />

                  <InfoBox
                    label="Região"
                    value={
                      route.region || "—"
                    }
                  />

                  <InfoBox
                    label="Situação"
                    value={
                      route.active
                        ? "Ativa"
                        : "Inativa"
                    }
                  />
                </div>

                {route.description && (
                  <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-500">
                    {route.description}
                  </p>
                )}

                <div className="mt-5 flex gap-3">
                  <Link
                    href={`/rotas/${route.id}`}
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Abrir rota
                  </Link>

                  <Link
                    href={`/rotas/${route.id}/imprimir`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </Link>
                </div>
              </div>
            );
          })}

          {!routes?.length && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <Route className="h-6 w-6 text-slate-400" />
              </div>

              <h2 className="mt-4 font-semibold text-slate-700">
                Nenhuma rota cadastrada
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Cadastre a primeira rota de entrega e depois associe os assinantes e o entregador responsável.
              </p>

              <Link
                href="/rotas/nova"
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Criar primeira rota
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
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

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15704f]/10">
          <Icon className="h-5 w-5 text-[#15704f]" />
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
}

function RouteStatusBadge({
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
      {active ? "Ativa" : "Inativa"}
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