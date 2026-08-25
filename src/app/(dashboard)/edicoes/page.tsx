import Link from "next/link";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import {
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Newspaper,
  Plus,
  ShoppingCart,
  Users,
} from "lucide-react";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function EditionsPage() {
  await requireEstafetaAccess();

  const supabase =
    await createClient();

  const {
    data: editions,
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
        created_at,

        company:companies (
          id,
          name
        ),

        sales:edition_sales (
          id,
          client_id,
          total_amount,
          status,

          items:edition_sale_items (
            id
          )
        )
      `)
      .order(
        "publication_date",
        {
          ascending: false,
        }
      );

  if (error) {
    console.error(
      "Erro ao carregar edições:",
      error
    );
  }

  const editionList =
    editions ?? [];

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        {/* CABEÇALHO */}

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
                <Newspaper className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Edições
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Gerencie as edições e as vendas de publicidade.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/edicoes/nova"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <Plus className="h-4 w-4" />

            Nova edição
          </Link>
        </div>

        {/* EDIÇÕES */}

        {editionList.length ? (
          <div className="mt-8 grid gap-5">
            {editionList.map(
              (edition) => {
                const sales =
                  edition.sales ??
                  [];

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

                const clients =
                  new Set(
                    confirmedSales.map(
                      (sale) =>
                        sale.client_id
                    )
                  ).size;

                const ads =
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

                const company =
                  getFirst(
                    edition.company
                  );

                return (
                  <Link
                    key={
                      edition.id
                    }
                    href={`/edicoes/${edition.id}`}
                    className="group block rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                      {/* IDENTIFICAÇÃO */}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-lg font-semibold text-slate-900">
                            {
                              edition.name
                            }
                          </h2>

                          <StatusBadge
                            status={
                              edition.status
                            }
                          />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                          {edition.edition_number && (
                            <span>
                              Nº{" "}
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

                      {/* INDICADORES */}

                      <div className="flex flex-wrap items-center gap-3">
                        <Metric
                          icon={
                            CircleDollarSign
                          }
                          label="Vendido"
                          value={formatCurrency(
                            totalSales
                          )}
                        />

                        <Metric
                          icon={
                            Users
                          }
                          label="Clientes"
                          value={String(
                            clients
                          )}
                        />

                        <Metric
                          icon={
                            ShoppingCart
                          }
                          label="Anúncios"
                          value={String(
                            ads
                          )}
                        />

                        <div className="ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition group-hover:bg-emerald-50 group-hover:text-[#15704f]">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              }
            )}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
              <Newspaper className="h-6 w-6" />
            </div>

            <h2 className="mt-4 text-base font-semibold text-slate-900">
              Nenhuma edição cadastrada
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Crie a primeira edição para começar a registrar anúncios e vendas de publicidade.
            </p>

            <Link
              href="/edicoes/nova"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
            >
              <Plus className="h-4 w-4" />

              Criar primeira edição
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[120px] rounded-xl bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" />

        {label}
      </div>

      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
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
    open:
      "bg-emerald-50 text-emerald-700",

    closed:
      "bg-blue-50 text-blue-700",

    cancelled:
      "bg-red-50 text-red-600",
  };

  const labels: Record<
    string,
    string
  > = {
    open:
      "Aberta",

    closed:
      "Fechada",

    cancelled:
      "Cancelada",
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
      style: "currency",
      currency: "BRL",
    }
  ).format(
    value
  );
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone: "UTC",
    }
  ).format(
    new Date(
      `${value}T00:00:00Z`
    )
  );
}