import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import PrintRouteButton from "@/app/components/print-route-button";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Company = {
  id: string;
  name: string;
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

  client: Client | Client[] | null;
  address: Address | Address[] | null;
};

export default async function ImprimirRotaPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

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

        company:companies (
          id,
          name
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
      "Erro ao carregar rota para impressão:",
      error
    );
  }

  if (!route) {
    notFound();
  }

  if (
    selectedCompanyId &&
    route.company_id !== selectedCompanyId
  ) {
    notFound();
  }

  const company =
    getFirst<Company>(route.company);

  const driver =
    getFirst<Driver>(route.driver);

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

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1100px]">
        {/* CONTROLES - NÃO IMPRIME */}

        <div className="mb-5 flex items-center justify-between print:hidden">
          <Link
            href={`/rotas/${route.id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para rota
          </Link>

          <PrintRouteButton />
        </div>

        {/* FOLHA */}

        <div className="bg-white p-8 shadow-sm print:p-0 print:shadow-none">
          {/* CABEÇALHO */}

          <header className="border-b-2 border-slate-900 pb-5">
            <div className="flex items-start justify-between gap-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Grupo Pulso
                </p>

                <h1 className="mt-1 text-2xl font-bold text-slate-950">
                  Rota de Entrega
                </h1>

                <p className="mt-1 text-lg font-semibold text-slate-800">
                  {route.name}
                </p>
              </div>

              <div className="text-right text-sm text-slate-600">
                <p>
                  <strong>Empresa:</strong>{" "}
                  {company?.name ?? "—"}
                </p>

                <p className="mt-1">
                  <strong>Região:</strong>{" "}
                  {route.region || "—"}
                </p>

                <p className="mt-1">
                  <strong>Total:</strong>{" "}
                  {routeClients.length} entregas
                </p>
              </div>
            </div>
          </header>

          {/* ENTREGADOR */}

          <section className="mt-5 grid grid-cols-1 gap-4 border-b border-slate-300 pb-5 sm:grid-cols-3">
            <InfoItem
              label="Entregador"
              value={
                driver?.name ??
                "Não definido"
              }
            />

            <InfoItem
              label="Telefone"
              value={
                driver?.phone ??
                "—"
              }
            />

            <InfoItem
              label="WhatsApp"
              value={
                driver?.whatsapp ??
                "—"
              }
            />
          </section>

          {/* OBSERVAÇÕES GERAIS */}

          {route.description && (
            <section className="mt-5 rounded-lg border border-slate-300 p-4 print:rounded-none">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Observações da rota
              </p>

              <p className="mt-2 whitespace-pre-line text-sm leading-5 text-slate-700">
                {route.description}
              </p>
            </section>
          )}

          {/* LISTA */}

          <section className="mt-6">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-y-2 border-slate-900">
                  <PrintHeader>
                    #
                  </PrintHeader>

                  <PrintHeader>
                    Assinante
                  </PrintHeader>

                  <PrintHeader>
                    Endereço
                  </PrintHeader>

                  <PrintHeader>
                    Bairro
                  </PrintHeader>

                  <PrintHeader>
                    Observação
                  </PrintHeader>

                  <PrintHeader>
                    ✓
                  </PrintHeader>
                </tr>
              </thead>

              <tbody>
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
                        className="border-b border-slate-300 align-top"
                      >
                        <td className="w-[45px] px-2 py-3 text-center text-sm font-bold text-slate-900">
                          {relation.delivery_order ??
                            index + 1}
                        </td>

                        <td className="px-2 py-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {client?.name ??
                              "Cliente não encontrado"}
                          </p>

                          {(client?.whatsapp ||
                            client?.phone) && (
                            <p className="mt-1 text-[11px] text-slate-500">
                              {client.whatsapp ||
                                client.phone}
                            </p>
                          )}
                        </td>

                        <td className="px-2 py-3 text-sm text-slate-700">
                          {formatAddress(
                            address
                          )}

                          {address?.complement && (
                            <p className="mt-1 text-[11px] text-slate-500">
                              {address.complement}
                            </p>
                          )}
                        </td>

                        <td className="px-2 py-3 text-sm text-slate-700">
                          {address?.neighborhood ??
                            "—"}
                        </td>

                        <td className="max-w-[220px] px-2 py-3 text-sm text-slate-700">
                          {relation.notes ||
                            "—"}
                        </td>

                        <td className="w-[45px] px-2 py-3 text-center">
                          <div className="mx-auto h-5 w-5 border border-slate-600" />
                        </td>
                      </tr>
                    );
                  }
                )}

                {!routeClients.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      Nenhum assinante cadastrado nesta rota.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* RODAPÉ */}

          <footer className="mt-8 border-t border-slate-300 pt-4 text-xs text-slate-500">
            <div className="flex items-center justify-between gap-4">
              <span>
                Rota: {route.name}
              </span>

              <span>
                {routeClients.length} entregas
              </span>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

function PrintHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-2 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">
      {children}
    </th>
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
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function formatAddress(
  address: Address | null
) {
  if (!address) {
    return "Endereço não definido";
  }

  const parts: string[] = [];

  if (address.street) {
    parts.push(address.street);
  }

  if (address.number) {
    parts.push(address.number);
  }

  let result =
    parts.join(", ");

  if (!result) {
    result =
      "Endereço não definido";
  }

  return result;
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