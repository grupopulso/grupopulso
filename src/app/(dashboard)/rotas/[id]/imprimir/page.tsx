import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import PrintRouteButton from "@/app/components/print-route-button";
import PrintLandscape from "@/app/components/print-landscape";
import {
  requireCompanyAccess,
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
  legacy_code: string | null;
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
  await requireModulePermission(
    "routes",
    "view"
  );

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
            legacy_code
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

  await requireCompanyAccess(
    route.company_id
  );

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

  /*
   * Impressão compacta, no formato do sistema antigo: uma linha
   * por assinante, sem espaço entre linhas — antes saíam ~21
   * folhas numa rota de ~500 assinantes.
   */
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 print:bg-white print:p-0">
      <PrintLandscape />

      <style>
        {`
          .route-print table { border-collapse: collapse; width: 100%; }
          .route-print th, .route-print td {
            padding: 1px 6px;
            font-size: 11px;
            line-height: 1.25;
            white-space: nowrap;
            text-align: left;
            vertical-align: top;
          }
          .route-print th {
            font-weight: 700;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 3px;
          }
          .route-print tbody tr:nth-child(even) { background: #f1f5f9; }
          .route-print td.wrap { white-space: normal; }
          @media print {
            @page { margin: 8mm; }
            .route-print th, .route-print td { font-size: 9.5px; }
            .route-print tbody tr:nth-child(even) {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .route-print tr { break-inside: avoid; }
            .route-print thead { display: table-header-group; }
          }
        `}
      </style>

      <div className="mx-auto max-w-[1100px] print:max-w-none">
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

        <div className="route-print bg-white p-6 shadow-sm print:p-0 print:shadow-none">
          <header className="mb-2 flex items-end justify-between gap-6 border-b border-slate-400 pb-1">
            <p className="text-sm font-bold text-slate-950">
              {route.name}
              <span className="ml-3 text-xs font-normal text-slate-600">
                {company?.name ?? ""}
                {driver?.name
                  ? ` · Entregador: ${driver.name}`
                  : ""}
              </span>
            </p>

            <p className="text-xs text-slate-600">
              {routeClients.length} entregas
            </p>
          </header>

          {route.description && (
            <p className="mb-2 whitespace-pre-line text-xs text-slate-700">
              {route.description}
            </p>
          )}

          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Assinante</th>
                <th>Endereço</th>
                <th>Complemento</th>
                <th>Bairro</th>
                <th>Cidade</th>
              </tr>
            </thead>

            <tbody>
              {routeClients.map((relation) => {
                const client = getFirst<Client>(
                  relation.client
                );

                const address = getFirst<Address>(
                  relation.address
                );

                const note = cleanRouteNote(
                  relation.notes
                );

                const complement = [
                  address?.complement,
                  note,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <tr key={relation.id}>
                    <td>{client?.legacy_code ?? ""}</td>
                    <td className="wrap">
                      {client?.name ??
                        "Cliente não encontrado"}
                    </td>
                    <td className="wrap">
                      {formatAddress(address)}
                    </td>
                    <td className="wrap">{complement}</td>
                    <td>{address?.neighborhood ?? ""}</td>
                    <td>
                      {[address?.city, address?.state]
                        .filter(Boolean)
                        .join(" - ")}
                    </td>
                  </tr>
                );
              })}

              {!routeClients.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-slate-500"
                  >
                    Nenhum assinante cadastrado nesta rota.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

/*
 * As observações importadas são só "Assinatura: X | Código
 * cliente: Y" — não servem pro entregador. Tira esses pedaços e
 * mantém só o que alguém escreveu de verdade.
 */
function cleanRouteNote(notes: string | null) {
  if (!notes) {
    return "";
  }

  return notes
    .split("|")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part &&
        !/^Assinatura:/i.test(part) &&
        !/^Código cliente:/i.test(part) &&
        !/^Cliente criado a partir do roteiro/i.test(part)
    )
    .join(" · ");
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