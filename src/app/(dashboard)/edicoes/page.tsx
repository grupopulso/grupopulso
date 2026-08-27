import Link from "next/link";

import {
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Newspaper,
  Plus,
  ShoppingCart,
  Users,
} from "lucide-react";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

type ContractPublication = {
  id: string;

  edition_id: string;

  contract_id: string;

  section_id:
    | string
    | null;

  ad_position_id:
    | string
    | null;

  size_description:
    | string
    | null;

  amount:
    | number
    | string;

  active:
    boolean;
};

type ContractRecord = {
  id: string;

  client_id: string;

  status: string;
};

export default async function EditionsPage() {
  const access =
    await requireEstafetaAccess();

  const supabase =
    await createClient();

  /*
   * =====================================================
   * EDIÇÕES
   * =====================================================
   *
   * A edição agora é o destino das
   * publicações já comercializadas.
   *
   * Mantemos edition_sales porque
   * existem vendas avulsas/legadas.
   * =====================================================
   */

  const {
    data:
      editions,
    error:
      editionsError,
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
        sales_goal,
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
      .eq(
        "company_id",
        access
          .estafetaCompany
          .id
      )
      .order(
        "publication_date",
        {
          ascending:
            false,
        }
      );

  if (
    editionsError
  ) {
    console.error(
      "Erro ao carregar edições:",
      editionsError
    );
  }

  const editionList =
    editions ??
    [];

  /*
   * =====================================================
   * PUBLICAÇÕES VINDAS DE CONTRATOS
   * =====================================================
   */

  const editionIds =
    editionList.map(
      (
        edition
      ) =>
        edition.id
    );

  let contractPublications:
    ContractPublication[] =
    [];

  if (
    editionIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "contract_edition_publications"
        )
        .select(`
          id,
          edition_id,
          contract_id,
          section_id,
          ad_position_id,
          size_description,
          amount,
          active
        `)
        .in(
          "edition_id",
          editionIds
        )
        .eq(
          "active",
          true
        );

    if (
      error
    ) {
      console.error(
        "Erro ao carregar publicações dos contratos:",
        error
      );
    } else {
      contractPublications =
        (
          data ??
          []
        ) as ContractPublication[];
    }
  }

  /*
   * =====================================================
   * CONTRATOS
   * =====================================================
   *
   * Precisamos do client_id para
   * calcular clientes únicos por edição.
   * =====================================================
   */

  const contractIds =
    [
      ...new Set(
        contractPublications.map(
          (
            publication
          ) =>
            publication.contract_id
        )
      ),
    ];

  let contracts:
    ContractRecord[] =
    [];

  if (
    contractIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "contracts"
        )
        .select(`
          id,
          client_id,
          status
        `)
        .eq(
          "company_id",
          access
            .estafetaCompany
            .id
        )
        .in(
          "id",
          contractIds
        );

    if (
      error
    ) {
      console.error(
        "Erro ao carregar contratos das edições:",
        error
      );
    } else {
      contracts =
        (
          data ??
          []
        ) as ContractRecord[];
    }
  }

  const contractsById =
    new Map(
      contracts.map(
        (
          contract
        ) => [
          contract.id,
          contract,
        ]
      )
    );

  /*
   * =====================================================
   * PUBLICAÇÕES AGRUPADAS POR EDIÇÃO
   * =====================================================
   */

  const publicationsByEdition =
    new Map<
      string,
      ContractPublication[]
    >();

  for (
    const publication of
      contractPublications
  ) {
    const current =
      publicationsByEdition.get(
        publication.edition_id
      ) ??
      [];

    current.push(
      publication
    );

    publicationsByEdition.set(
      publication.edition_id,
      current
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">

        {/* =================================================
            CABEÇALHO
           ================================================= */}

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
                  Crie as edições e organize nelas as publicações já comercializadas.
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

        {/* =================================================
            EXPLICAÇÃO DO FLUXO
           ================================================= */}

        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#15704f]" />

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Fluxo comercial
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                As vendas e contratos são comercializados primeiro. Depois, dentro de cada edição, são vinculadas e configuradas as publicações que participarão daquela edição.
              </p>
            </div>
          </div>
        </div>

        {/* =================================================
            EDIÇÕES
           ================================================= */}

        {editionList.length >
        0 ? (
          <div className="mt-8 grid gap-5">
            {editionList.map(
              (
                edition
              ) => {
                /*
                 * =========================================
                 * VENDAS AVULSAS JÁ VINCULADAS
                 * =========================================
                 */

                const sales =
                  edition.sales ??
                  [];

                const confirmedSales =
                  sales.filter(
                    (
                      sale
                    ) =>
                      sale.status ===
                      "confirmed"
                  );

                const standaloneAmount =
                  roundMoney(
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
                    )
                  );

                const standaloneAds =
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

                /*
                 * =========================================
                 * PUBLICAÇÕES VINDAS DE CONTRATOS
                 * =========================================
                 */

                const publications =
                  publicationsByEdition.get(
                    edition.id
                  ) ??
                  [];

                const contractAmount =
                  roundMoney(
                    publications.reduce(
                      (
                        total,
                        publication
                      ) =>
                        total +
                        Number(
                          publication.amount ??
                            0
                        ),
                      0
                    )
                  );

                /*
                 * =========================================
                 * TOTAL VINCULADO À EDIÇÃO
                 * =========================================
                 */

                const totalLinkedAmount =
                  roundMoney(
                    standaloneAmount +
                      contractAmount
                  );

                const totalPublications =
                  standaloneAds +
                  publications.length;

                /*
                 * =========================================
                 * CLIENTES ÚNICOS
                 * =========================================
                 */

                const clientIds =
                  new Set<
                    string
                  >();

                for (
                  const sale of
                    confirmedSales
                ) {
                  if (
                    sale.client_id
                  ) {
                    clientIds.add(
                      sale.client_id
                    );
                  }
                }

                for (
                  const publication of
                    publications
                ) {
                  const contract =
                    contractsById.get(
                      publication.contract_id
                    );

                  if (
                    contract?.client_id
                  ) {
                    clientIds.add(
                      contract.client_id
                    );
                  }
                }

                /*
                 * =========================================
                 * PENDÊNCIAS DE CONFIGURAÇÃO
                 * =========================================
                 *
                 * Uma publicação contratada ainda precisa
                 * de definição operacional se não possuir
                 * posição ou tamanho.
                 *
                 * Caderno continua opcional.
                 * =========================================
                 */

                const pendingPublications =
                  publications.filter(
                    (
                      publication
                    ) =>
                      !publication.ad_position_id ||
                      !publication
                        .size_description
                  ).length;

                /*
                 * =========================================
                 * META
                 * =========================================
                 */

                const salesGoal =
                  Number(
                    edition.sales_goal ??
                      0
                  );

                const progress =
                  salesGoal >
                  0
                    ? (
                        totalLinkedAmount /
                        salesGoal
                      ) *
                      100
                    : 0;

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
                    className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm"
                  >
                    {/* PRINCIPAL */}

                    <div className="p-6">
                      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">

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

                            {pendingPublications >
                              0 && (
                              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                {
                                  pendingPublications
                                }{" "}
                                pendente
                                {pendingPublications !==
                                1
                                  ? "s"
                                  : ""}
                              </span>
                            )}
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

                          {edition.notes && (
                            <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-slate-400">
                              {
                                edition.notes
                              }
                            </p>
                          )}
                        </div>

                        {/* INDICADORES */}

                        <div className="flex flex-wrap items-center gap-3">
                          <Metric
                            icon={
                              CircleDollarSign
                            }
                            label="Vinculado"
                            value={formatCurrency(
                              totalLinkedAmount
                            )}
                          />

                          <Metric
                            icon={
                              Users
                            }
                            label="Clientes"
                            value={String(
                              clientIds.size
                            )}
                          />

                          <Metric
                            icon={
                              ShoppingCart
                            }
                            label="Publicações"
                            value={String(
                              totalPublications
                            )}
                          />

                          <div className="ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition group-hover:bg-emerald-50 group-hover:text-[#15704f]">
                            <ChevronRight className="h-5 w-5" />
                          </div>
                        </div>
                      </div>

                      {/* ORIGEM */}

                      {(standaloneAmount >
                        0 ||
                        contractAmount >
                          0) && (
                        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                          {contractAmount >
                            0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                              <FileText className="h-3.5 w-3.5" />

                              Contratos:{" "}
                              {formatCurrency(
                                contractAmount
                              )}
                            </span>
                          )}

                          {standaloneAmount >
                            0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                              <ShoppingCart className="h-3.5 w-3.5" />

                              Avulsas:{" "}
                              {formatCurrency(
                                standaloneAmount
                              )}
                            </span>
                          )}

                          {publications.length >
                            0 && (
                            <span className="inline-flex items-center rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
                              {
                                publications.length
                              }{" "}
                              via contrato
                            </span>
                          )}
                        </div>
                      )}

                      {/* META */}

                      {salesGoal >
                        0 && (
                        <div className="mt-5 border-t border-slate-100 pt-4">
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <span className="text-xs font-medium text-slate-400">
                              Meta{" "}
                              {formatCurrency(
                                salesGoal
                              )}
                            </span>

                            <span className="text-xs font-semibold text-[#15704f]">
                              {formatPercentage(
                                progress
                              )}
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#15704f]"
                              style={{
                                width:
                                  `${Math.min(
                                    Math.max(
                                      progress,
                                      0
                                    ),
                                    100
                                  )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
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
              Crie a edição para depois selecionar e organizar as publicações que farão parte dela.
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

/*
 * =====================================================
 * MÉTRICA
 * =====================================================
 */

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon:
    React.ElementType;

  label:
    string;

  value:
    string;
}) {
  return (
    <div className="min-w-[120px] rounded-xl bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" />

        {
          label
        }
      </div>

      <p className="mt-1 text-sm font-semibold text-slate-900">
        {
          value
        }
      </p>
    </div>
  );
}

/*
 * =====================================================
 * STATUS
 * =====================================================
 */

function StatusBadge({
  status,
}: {
  status:
    string;
}) {
  const styles:
    Record<
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

  const labels:
    Record<
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
        styles[
          status
        ] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[
        status
      ] ??
        status}
    </span>
  );
}

/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

function getFirst<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (
    !value
  ) {
    return null;
  }

  return Array.isArray(
    value
  )
    ? value[
        0
      ] ??
        null
    : value;
}

function roundMoney(
  value:
    number
) {
  return (
    Math.round(
      (
        Number(
          value
        ) +
        Number.EPSILON
      ) *
        100
    ) /
    100
  );
}

function formatCurrency(
  value:
    number
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
    Number.isFinite(
      value
    )
      ? value
      : 0
  );
}

function formatPercentage(
  value:
    number
) {
  return (
    new Intl.NumberFormat(
      "pt-BR",
      {
        maximumFractionDigits:
          1,
      }
    ).format(
      Number.isFinite(
        value
      )
        ? value
        : 0
    ) +
    "%"
  );
}

function formatDate(
  value:
    string
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