import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  Newspaper,
  Plus,
  ShoppingCart,
  Users,
} from "lucide-react";

import {
  notFound,
} from "next/navigation";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import SectionsManagement from "./sections-management";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type SellerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default async function EditionPage({
  params,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const {
    id,
  } = await params;

  const supabase =
    await createClient();

  /*
   * =========================================
   * EDIÇÃO + CADERNOS + VENDAS
   * =========================================
   */

  const {
    data: edition,
    error,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .select(`
        id,
        company_id,
        name,
        edition_number,
        publication_date,
        status,
        notes,

        company:companies (
          id,
          name
        ),

        sections:edition_sections (
          id,
          name,
          description,
          active,
          created_at
        ),

        sales:edition_sales (
          id,
          client_id,
          seller_user_id,
          status,
          total_amount,
          commission_percentage,
          commission_amount,
          notes,
          created_at,

          client:clients (
            id,
            name
          ),

          items:edition_sale_items (
            id,
            description,
            quantity,
            unit_price,
            total_amount
          )
        )
      `)
      .eq(
        "id",
        id
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (error) {
    console.error(
      "Erro ao carregar edição:",
      JSON.stringify(
        error,
        null,
        2
      )
    );
  }

  if (
    error ||
    !edition
  ) {
    notFound();
  }

  /*
   * =========================================
   * CADERNOS
   * =========================================
   */

  const sections =
    (
      edition.sections ??
      []
    )
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          a.name.localeCompare(
            b.name,
            "pt-BR"
          )
      );

  /*
   * =========================================
   * VENDAS
   * =========================================
   */

  const sales =
    edition.sales ??
    [];

  /*
   * =========================================
   * VENDEDORES
   * =========================================
   */

  const sellerIds =
    [
      ...new Set(
        sales
          .map(
            (sale) =>
              sale.seller_user_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          )
      ),
    ];

  let sellers:
    SellerProfile[] =
    [];

  if (
    sellerIds.length >
    0
  ) {
    const {
      data:
        sellerProfiles,
      error:
        sellersError,
    } =
      await supabase
        .from(
          "profiles"
        )
        .select(`
          id,
          full_name,
          email
        `)
        .in(
          "id",
          sellerIds
        );

    if (
      sellersError
    ) {
      console.error(
        "Erro ao carregar vendedores:",
        JSON.stringify(
          sellersError,
          null,
          2
        )
      );
    } else {
      sellers =
        sellerProfiles ??
        [];
    }
  }

  const sellersById =
    new Map(
      sellers.map(
        (seller) => [
          seller.id,
          seller,
        ]
      )
    );

  /*
   * =========================================
   * INDICADORES
   * =========================================
   */

  const confirmedSales =
    sales.filter(
      (sale) =>
        sale.status ===
        "confirmed"
    );

  const totalSales =
    confirmedSales.reduce(
      (
        total,
        sale
      ) =>
        total +
        Number(
          sale.total_amount ??
            0
        ),
      0
    );

  const totalAds =
    confirmedSales.reduce(
      (
        total,
        sale
      ) =>
        total +
        (
          sale.items ??
          []
        ).length,
      0
    );

  const totalClients =
    new Set(
      confirmedSales.map(
        (sale) =>
          sale.client_id
      )
    ).size;

  const totalCommissions =
    confirmedSales.reduce(
      (
        total,
        sale
      ) =>
        total +
        Number(
          sale.commission_amount ??
            0
        ),
      0
    );

  const company =
    getFirst(
      edition.company
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">

        {/* VOLTAR */}

        <Link
          href="/edicoes"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Edições
        </Link>

        {/* CABEÇALHO */}

        <div className="mt-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
                <Newspaper className="h-5 w-5" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {
                      edition.name
                    }
                  </h1>

                  <StatusBadge
                    status={
                      edition.status
                    }
                  />
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  {edition.edition_number && (
                    <span>
                      Edição nº{" "}
                      {
                        edition.edition_number
                      }
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />

                    {formatDate(
                      edition.publication_date
                    )}
                  </span>

                  {company && (
                    <span>
                      {
                        company.name
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>

            {edition.notes && (
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">
                {
                  edition.notes
                }
              </p>
            )}
          </div>

          {edition.status ===
            "open" && (
            <Link
              href={`/edicoes/${edition.id}/vendas/nova`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
            >
              <Plus className="h-4 w-4" />

              Nova venda
            </Link>
          )}
        </div>

        {/* INDICADORES */}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={
              CircleDollarSign
            }
            label="Total vendido"
            value={formatCurrency(
              totalSales
            )}
          />

          <SummaryCard
            icon={
              Users
            }
            label="Clientes"
            value={String(
              totalClients
            )}
          />

          <SummaryCard
            icon={
              ShoppingCart
            }
            label="Anúncios"
            value={String(
              totalAds
            )}
          />

          <SummaryCard
            icon={
              CircleDollarSign
            }
            label="Comissões"
            value={formatCurrency(
              totalCommissions
            )}
          />
        </div>

        {/* CADERNOS */}

        <SectionsManagement
          editionId={
            edition.id
          }
          editionOpen={
            edition.status ===
            "open"
          }
          sections={
            sections
          }
        />

        {/* VENDAS */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="font-semibold text-slate-900">
                Vendas da edição
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Clientes e anúncios comercializados nesta edição.
              </p>
            </div>

            {edition.status ===
              "open" && (
              <Link
                href={`/edicoes/${edition.id}/vendas/nova`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f]"
              >
                <Plus className="h-4 w-4" />

                Nova venda
              </Link>
            )}
          </div>

          {sales.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>
                      Cliente
                    </TableHeader>

                    <TableHeader>
                      Vendedor
                    </TableHeader>

                    <TableHeader>
                      Anúncios
                    </TableHeader>

                    <TableHeader>
                      Total
                    </TableHeader>

                    <TableHeader>
                      Comissão
                    </TableHeader>

                    <TableHeader>
                      Status
                    </TableHeader>

                    <TableHeader>
                      Ações
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {sales.map(
                    (sale) => {
                      const client =
                        getFirst(
                          sale.client
                        );

                      const seller =
                        sellersById.get(
                          sale.seller_user_id
                        );

                      return (
                        <tr
                          key={
                            sale.id
                          }
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-900">
                              {client?.name ??
                                "Cliente"}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-700">
                              {seller?.full_name ??
                                seller?.email ??
                                "Vendedor"}
                            </p>
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {
                              (
                                sale.items ??
                                []
                              ).length
                            }
                          </td>

                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                Number(
                                  sale.total_amount ??
                                    0
                                )
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-700">
                              {formatCurrency(
                                Number(
                                  sale.commission_amount ??
                                    0
                                )
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {formatPercentage(
                                Number(
                                  sale.commission_percentage ??
                                    0
                                )
                              )}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <SaleStatusBadge
                              status={
                                sale.status
                              }
                            />
                          </td>

                          <td className="px-6 py-4">
                            <Link
                              href={`/edicoes/${edition.id}/vendas/${sale.id}`}
                              className="text-sm font-semibold text-[#15704f] hover:underline"
                            >
                              Ver venda
                            </Link>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <ShoppingCart className="mx-auto h-7 w-7 text-slate-300" />

              <p className="mt-3 text-sm font-medium text-slate-700">
                Nenhuma venda registrada
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Cadastre a primeira venda de publicidade desta edição.
              </p>

              {edition.status ===
                "open" && (
                <Link
                  href={`/edicoes/${edition.id}/vendas/nova`}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
                >
                  <Plus className="h-4 w-4" />

                  Registrar primeira venda
                </Link>
              )}
            </div>
          )}
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
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-[#15704f]">
        <Icon className="h-4 w-4" />
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function TableHeader({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <th className="whitespace-nowrap px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
    open: "Aberta",
    closed: "Fechada",
    cancelled:
      "Cancelada",
  };

  const styles: Record<
    string,
    string
  > = {
    open:
      "bg-emerald-50 text-emerald-700",

    closed:
      "bg-blue-50 text-blue-700",

    cancelled:
      "bg-red-50 text-red-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] ??
        status}
    </span>
  );
}

function SaleStatusBadge({
  status,
}: {
  status: string;
}) {
  const labels: Record<
    string,
    string
  > = {
    draft:
      "Rascunho",

    confirmed:
      "Confirmada",

    cancelled:
      "Cancelada",
  };

  const styles: Record<
    string,
    string
  > = {
    draft:
      "bg-amber-50 text-amber-700",

    confirmed:
      "bg-emerald-50 text-emerald-700",

    cancelled:
      "bg-red-50 text-red-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] ??
        status}
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

  return Array.isArray(
    value
  )
    ? value[0] ??
        null
    : value;
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",
    }
  ).format(
    value
  );
}

function formatPercentage(
  value: number
) {
  return (
    new Intl.NumberFormat(
      "pt-BR",
      {
        maximumFractionDigits:
          2,
      }
    ).format(
      value
    ) + "%"
  );
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone:
        "UTC",
    }
  ).format(
    new Date(
      `${value}T00:00:00Z`
    )
  );
}