import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowLeft,
  Building2,
  Edit3,
  MapPin,
  Plus,
  Printer,
  Route,
  Truck,
  Users,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";

import RouteClientActions from "@/app/components/route-client-actions";
import {
  requireModulePermission,
} from "@/app/lib/permissions";


type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Company = {
  id: string;
  name: string;
  color: string | null;
};

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
};

type Client = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
};

type Address = {
  id: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

type RouteClient = {
  id: string;
  delivery_order: number | null;
  notes: string | null;
  active: boolean;

  client:
    | Client
    | Client[]
    | null;

  address:
    | Address
    | Address[]
    | null;
};

export default async function RotaDetalhePage({
  params,
}: PageProps) {
    await requireModulePermission(
  "routes",
  "view"
);
  const { id } = await params;

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const { data: route, error } =
    await supabase
      .from("delivery_routes")
      .select(`
        id,
        company_id,
        name,
        description,
        region,
        active,
        created_at,

        company:companies (
          id,
          name,
          color
        ),

        driver:delivery_drivers (
          id,
          name,
          phone,
          whatsapp
        ),

        delivery_route_clients (
          id,
          delivery_order,
          notes,
          active,

          client:clients (
            id,
            name,
            phone,
            whatsapp
          ),

          address:client_addresses (
  id,
  street,
  number,
  complement,
  neighborhood,
  city,
  state
)
        )
      `)
      .eq("id", id)
      .maybeSingle();

  if (error) {
  console.error(
    "ERRO COMPLETO AO CARREGAR ROTA:",
    JSON.stringify(error, null, 2)
  );

  throw new Error(
    `Erro ao carregar rota: ${error.message}`
  );
}

if (!route) {
  console.error(
    "ROTA NÃO ENCONTRADA. ID:",
    id
  );

  notFound();
}

  if (
    selectedCompanyId &&
    route.company_id !== selectedCompanyId
  ) {
    notFound();
  }

  const company =
    getFirst<Company>(
      route.company
    );

  const driver =
    getFirst<Driver>(
      route.driver
    );

  const routeClients =
    (
      route.delivery_route_clients ??
      []
    )
      .filter(
        (relation) =>
          relation.active
      )
      .sort(
        (a, b) =>
          (
            a.delivery_order ??
            999999
          ) -
          (
            b.delivery_order ??
            999999
          )
      ) as RouteClient[];

  const totalClients =
    routeClients.length;

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

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#15704f]/10">
              <Route className="h-6 w-6 text-[#15704f]" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {route.name}
                </h1>

                <StatusBadge
                  active={route.active}
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                {company && (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          company.color ??
                          "#94a3b8",
                      }}
                    />

                    {company.name}
                  </span>
                )}

                {route.region && (
                  <>
                    <span className="text-slate-300">
                      •
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {route.region}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/rotas/${route.id}/editar`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#15704f]/30 hover:text-[#15704f]"
            >
              <Edit3 className="h-4 w-4" />
              Editar rota
            </Link>

            <Link
              href={`/rotas/${route.id}/imprimir`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#15704f]/30 hover:text-[#15704f]"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Link>

            <Link
              href={`/rotas/${route.id}/assinantes`}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
            >
              <Plus className="h-4 w-4" />
              Adicionar assinantes
            </Link>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
          <SummaryCard
            icon={Users}
            label="Assinantes"
            value={String(
              totalClients
            )}
          />

          <SummaryCard
            icon={Truck}
            label="Entregador"
            value={
              driver?.name ??
              "Não definido"
            }
          />

          <SummaryCard
            icon={Building2}
            label="Empresa"
            value={
              company?.name ??
              "—"
            }
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
            <h2 className="font-semibold text-slate-900">
              Informações da rota
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <InfoItem
                label="Região / Bairro"
                value={
                  route.region ||
                  "Não informado"
                }
              />

              <InfoItem
                label="Situação"
                value={
                  route.active
                    ? "Ativa"
                    : "Inativa"
                }
              />
            </div>

            {route.description && (
              <div className="mt-5 border-t border-slate-100 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Observações
                </p>

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {route.description}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <Truck className="h-5 w-5 text-slate-500" />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Entregador
                </p>

                <p className="mt-0.5 font-semibold text-slate-900">
                  {driver?.name ??
                    "Não definido"}
                </p>
              </div>
            </div>

            {driver ? (
              <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
                <InfoItem
                  label="Telefone"
                  value={
                    driver.phone ||
                    "—"
                  }
                />

                <InfoItem
                  label="WhatsApp"
                  value={
                    driver.whatsapp ||
                    "—"
                  }
                />
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-slate-400">
                Nenhum entregador foi vinculado a esta rota.
              </p>
            )}
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Ordem de entrega
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Assinantes organizados na sequência da rota.
              </p>
            </div>

            <Link
              href={`/rotas/${route.id}/assinantes`}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#15704f]/10 px-4 text-sm font-semibold text-[#15704f] transition hover:bg-[#15704f]/15"
            >
              <Plus className="h-4 w-4" />
              Adicionar assinantes
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Ordem
                  </TableHeader>

                  <TableHeader>
                    Assinante
                  </TableHeader>

                  <TableHeader>
                    Endereço
                  </TableHeader>

                  <TableHeader>
                    Bairro
                  </TableHeader>

                  <TableHeader>
                    Contato
                  </TableHeader>

                  <TableHeader>
                    Observação
                  </TableHeader>

                  <TableHeader>
                    Ações
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {routeClients.map(
                  (
                    relation,
                    index
                  ) => {
                    const client =
                      getFirst<Client>(
                        relation.client
                      );

                    const address =
                      getFirst<Address>(
                        relation.address
                      );

                    return (
                      <tr
                        key={
                          relation.id
                        }
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#15704f]/10 text-sm font-bold text-[#15704f]">
                            {relation.delivery_order ??
                              index + 1}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {client ? (
                            <Link
                              href={`/clientes/${client.id}`}
                              className="text-sm font-semibold text-slate-900 transition hover:text-[#15704f]"
                            >
                              {client.name}
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-400">
                              Cliente não encontrado
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="max-w-xs">
                            <p className="text-sm text-slate-700">
                              {formatAddress(
                                address
                              )}
                            </p>

                            {address?.complement && (
                              <p className="mt-1 text-xs text-slate-400">
                                {address.complement}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {address?.neighborhood ??
                            "—"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {client?.whatsapp ||
                            client?.phone ||
                            "—"}
                        </td>

                        <td className="px-5 py-4">
                          <p className="max-w-xs text-sm text-slate-500">
                            {relation.notes ||
                              "—"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <RouteClientActions
                            routeId={
                              route.id
                            }
                            relationId={
                              relation.id
                            }
                            notes={
                              relation.notes
                            }
                            first={
                              index === 0
                            }
                            last={
                              index ===
                              routeClients.length -
                                1
                            }
                          />
                        </td>
                      </tr>
                    );
                  }
                )}

                {!routeClients.length && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-14 text-center"
                    >
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>

                      <p className="mt-4 text-sm font-semibold text-slate-600">
                        Nenhum assinante nesta rota
                      </p>

                      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">
                        Adicione os assinantes que fazem parte desta rota e organize a sequência de entrega.
                      </p>

                      <Link
                        href={`/rotas/${route.id}/assinantes`}
                        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar assinantes
                      </Link>
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-xl font-semibold text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#15704f]/10">
          <Icon className="h-5 w-5 text-[#15704f]" />
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-700">
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

function formatAddress(
  address: Address | null
) {
  if (!address) {
    return "Endereço não definido";
  }

  const street =
    address.street || "";

  const number =
    address.number || "";

  if (!street && !number) {
    return "Endereço não definido";
  }

  if (street && number) {
    return `${street}, ${number}`;
  }

  return street || number;
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