import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Goal,
  Newspaper,
  Plus,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  ReopenEditionButton,
} from "./reopen-edition-button";

import {
  notFound,
} from "next/navigation";

import {
  LayoutGrid,
} from "lucide-react";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import SectionsManagement from "./sections-management";

import {
  AddContractPublication,
  EditContractPublication,
} from "./add-contract-publication";

import {
  CloseEditionButton,
} from "./close-edition-button";

/*
 * =====================================================
 * TIPOS
 * =====================================================
 */

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type SellerProfile = {
  id: string;

  name:
    | string
    | null;
};

type ContractRecord = {
  id: string;

  client_id: string;

  product_id:
    | string
    | null;

  responsible_user_id:
    | string
    | null;

  title: string;

  status: string;

  value:
    | number
    | string;

  start_date: string;

  end_date:
    | string
    | null;
};

type ClientRecord = {
  id: string;
  name: string;
};

type ProductRecord = {
  id: string;
  name: string;
};

type ContractPublication = {
  id: string;

  contract_id: string;

  edition_id: string;

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

  notes:
    | string
    | null;

  active: boolean;

  created_at: string;
};

type AvailableContract = {
  id: string;

  title: string;

  value:
    | number
    | string;

  start_date: string;

  end_date:
    | string
    | null;

  client: {
    id: string;
    name: string;
  } | null;

  product: {
    id: string;
    name: string;
  } | null;
};

/*
 * =====================================================
 * PÁGINA
 * =====================================================
 */

export default async function EditionPage({
  params,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const {
    id,
  } =
    await params;

  const supabase =
    await createClient();

  /*
   * =====================================================
   * EDIÇÃO
   * =====================================================
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
        sales_goal,
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
          sales_goal,
          active,
          created_at,

          positions:edition_ad_positions (
            id,
            section_id,
            position_code,
            name,
            capacity,
            manually_blocked,
            blocked_reason,
            active
          )
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
            section_id,
            ad_position_id,
            size_description,
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

  if (
    error
  ) {
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
   * =====================================================
   * PUBLICAÇÕES DE CONTRATOS
   * =====================================================
   */

  const {
    data:
      publicationData,
    error:
      publicationError,
  } =
    await supabase
      .from(
        "contract_edition_publications"
      )
      .select(`
        id,
        contract_id,
        edition_id,
        section_id,
        ad_position_id,
        size_description,
        amount,
        notes,
        active,
        created_at
      `)
      .eq(
        "edition_id",
        edition.id
      )
      .eq(
        "active",
        true
      )
      .order(
        "created_at",
        {
          ascending:
            true,
        }
      );

  if (
    publicationError
  ) {
    console.error(
      "Erro ao carregar publicações:",
      publicationError
    );
  }

  const contractPublications =
    (
      publicationData ??
      []
    ) as ContractPublication[];

  /*
   * =====================================================
   * CONTRATOS JÁ VINCULADOS
   * =====================================================
   */

  const linkedContractIds =
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

  /*
   * =====================================================
   * CONTRATOS DISPONÍVEIS
   * =====================================================
   */

  const {
    data:
      activeContractsData,
    error:
      activeContractsError,
  } =
    await supabase
      .from(
        "contracts"
      )
      .select(`
        id,
        client_id,
        product_id,
        responsible_user_id,
        title,
        status,
        value,
        start_date,
        end_date,

        client:clients (
          id,
          name
        ),

        product:products (
          id,
          name
        )
      `)
      .eq(
        "company_id",
        edition.company_id
      )
      .eq(
        "status",
        "active"
      )
      .order(
        "start_date",
        {
          ascending:
            false,
        }
      );

  if (
    activeContractsError
  ) {
    console.error(
      "Erro ao carregar contratos:",
      activeContractsError
    );
  }

  const availableContracts =
    (
      activeContractsData ??
      []
    )
      .filter(
        (
          contract
        ) =>
          !linkedContractIds.includes(
            contract.id
          )
      )
      .map(
        (
          contract
        ): AvailableContract => ({
          id:
            contract.id,

          title:
            contract.title,

          value:
            contract.value,

          start_date:
            contract.start_date,

          end_date:
            contract.end_date,

          client:
            getFirst(
              contract.client
            ),

          product:
            getFirst(
              contract.product
            ),
        })
      );

  /*
   * =====================================================
   * CONTRATOS VINCULADOS
   * =====================================================
   */

  let contracts:
    ContractRecord[] =
    [];

  if (
    linkedContractIds.length >
    0
  ) {
    const {
      data:
        contractData,
      error:
        contractsError,
    } =
      await supabase
        .from(
          "contracts"
        )
        .select(`
          id,
          client_id,
          product_id,
          responsible_user_id,
          title,
          status,
          value,
          start_date,
          end_date
        `)
        .in(
          "id",
          linkedContractIds
        )
        .eq(
          "company_id",
          edition.company_id
        );

    if (
      contractsError
    ) {
      console.error(
        "Erro ao carregar contratos vinculados:",
        contractsError
      );
    } else {
      contracts =
        (
          contractData ??
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
   * CLIENTES
   * =====================================================
   */

  const contractClientIds =
    [
      ...new Set(
        contracts.map(
          (
            contract
          ) =>
            contract.client_id
        )
      ),
    ];

  let contractClients:
    ClientRecord[] =
    [];

  if (
    contractClientIds.length >
    0
  ) {
    const {
      data:
        clientData,
    } =
      await supabase
        .from(
          "clients"
        )
        .select(`
          id,
          name
        `)
        .in(
          "id",
          contractClientIds
        );

    contractClients =
      (
        clientData ??
        []
      ) as ClientRecord[];
  }

  const contractClientsById =
    new Map(
      contractClients.map(
        (
          client
        ) => [
          client.id,
          client,
        ]
      )
    );

  /*
   * =====================================================
   * PRODUTOS
   * =====================================================
   */

  const productIds =
    [
      ...new Set(
        contracts
          .map(
            (
              contract
            ) =>
              contract.product_id
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

  let products:
    ProductRecord[] =
    [];

  if (
    productIds.length >
    0
  ) {
    const {
      data,
    } =
      await supabase
        .from(
          "products"
        )
        .select(`
          id,
          name
        `)
        .in(
          "id",
          productIds
        );

    products =
      (
        data ??
        []
      ) as ProductRecord[];
  }

  const productsById =
    new Map(
      products.map(
        (
          product
        ) => [
          product.id,
          product,
        ]
      )
    );

  /*
   * =====================================================
   * CADERNOS
   * =====================================================
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

  const sectionsById =
    new Map(
      sections.map(
        (
          section
        ) => [
          section.id,
          section,
        ]
      )
    );

  /*
   * =====================================================
   * POSIÇÕES
   * =====================================================
   */

  const positionsById =
    new Map<
      string,
      {
        id: string;
        name: string;
        position_code: string;
        section_id: string | null;
        capacity: number | null;
        manually_blocked: boolean;
        blocked_reason: string | null;
        active: boolean;
      }
    >();

  for (
    const section of
      sections
  ) {
    for (
      const position of
        section.positions ??
        []
    ) {
      positionsById.set(
        position.id,
        {
          id:
            position.id,

          name:
            position.name,

          position_code:
            position.position_code,

          section_id:
            section.id,

          capacity:
            position.capacity ===
              null
              ? null
              : Number(
                  position.capacity
                ),

          manually_blocked:
            Boolean(
              position.manually_blocked
            ),

          blocked_reason:
            position.blocked_reason,

          active:
            Boolean(
              position.active
            ),
        }
      );
    }
  }

  /*
   * POSIÇÕES SEM CADERNO
   */

  const {
    data:
      generalPositions,
  } =
    await supabase
      .from(
        "edition_ad_positions"
      )
      .select(`
        id,
        section_id,
        position_code,
        name,
        capacity,
        manually_blocked,
        blocked_reason,
        active
      `)
      .eq(
        "edition_id",
        edition.id
      )
      .is(
        "section_id",
        null
      );

  for (
    const position of
      generalPositions ??
      []
  ) {
    positionsById.set(
      position.id,
      {
        id:
          position.id,

        name:
          position.name,

        position_code:
          position.position_code,

        section_id:
          null,

        capacity:
          position.capacity ===
            null
            ? null
            : Number(
                position.capacity
              ),

        manually_blocked:
          Boolean(
            position.manually_blocked
          ),

        blocked_reason:
          position.blocked_reason,

        active:
          Boolean(
            position.active
          ),
      }
    );
  }

  /*
   * =====================================================
   * VENDAS AVULSAS
   * =====================================================
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

  const draftSales =
    sales.filter(
      (
        sale
      ) =>
        sale.status ===
        "draft"
    );

  /*
   * =====================================================
   * PENDÊNCIAS
   * =====================================================
   */

  const pendingContractPublications =
    contractPublications.filter(
      (
        publication
      ) =>
        !publication
          .ad_position_id ||
        !publication
          .size_description
          ?.trim()
    ).length;

  const pendingStandalonePublications =
    confirmedSales.reduce(
      (
        total,
        sale
      ) =>
        total +
        (
          sale.items ??
          []
        ).filter(
          (
            item
          ) =>
            !item
              .ad_position_id ||
            !item
              .size_description
              ?.trim()
        ).length,
      0
    );

  /*
   * =====================================================
   * VENDEDORES
   * =====================================================
   */

  const sellerIds =
    [
      ...new Set([
        ...sales
          .map(
            (
              sale
            ) =>
              sale.seller_user_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          ),

        ...contracts
          .map(
            (
              contract
            ) =>
              contract
                .responsible_user_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          ),
      ]),
    ];

  let sellers:
    SellerProfile[] =
    [];

  if (
    sellerIds.length >
    0
  ) {
    const {
      data,
    } =
      await supabase
        .from(
          "user_profiles"
        )
        .select(`
          id,
          name
        `)
        .in(
          "id",
          sellerIds
        );

    sellers =
      data ??
      [];
  }

  const sellersById =
    new Map(
      sellers.map(
        (
          seller
        ) => [
          seller.id,
          seller,
        ]
      )
    );

  /*
   * =====================================================
   * VENDIDO POR CADERNO
   * =====================================================
   */

  const soldBySection =
    new Map<
      string,
      number
    >();

  for (
    const sale of
      confirmedSales
  ) {
    for (
      const item of
        sale.items ??
        []
    ) {
      if (
        !item.section_id
      ) {
        continue;
      }

      soldBySection.set(
        item.section_id,
        roundMoney(
          (
            soldBySection.get(
              item.section_id
            ) ??
            0
          ) +
            Number(
              item.total_amount ??
                0
            )
        )
      );
    }
  }

  for (
    const publication of
      contractPublications
  ) {
    if (
      !publication.section_id
    ) {
      continue;
    }

    soldBySection.set(
      publication.section_id,
      roundMoney(
        (
          soldBySection.get(
            publication.section_id
          ) ??
          0
        ) +
          Number(
            publication.amount ??
              0
          )
      )
    );
  }

  /*
   * =====================================================
   * OCUPAÇÃO DE POSIÇÕES
   * =====================================================
   */

  const soldByPosition =
    new Map<
      string,
      number
    >();

  for (
    const sale of
      confirmedSales
  ) {
    for (
      const item of
        sale.items ??
        []
    ) {
      if (
        item.ad_position_id
      ) {
        soldByPosition.set(
          item.ad_position_id,
          (
            soldByPosition.get(
              item.ad_position_id
            ) ??
            0
          ) +
            1
        );
      }
    }
  }

  for (
    const publication of
      contractPublications
  ) {
    if (
      publication.ad_position_id
    ) {
      soldByPosition.set(
        publication.ad_position_id,
        (
          soldByPosition.get(
            publication.ad_position_id
          ) ??
          0
        ) +
          1
      );
    }
  }

  /*
   * =====================================================
   * POSIÇÕES UTILIZADAS / BLOQUEADAS
   * =====================================================
   */

  const usedPositionIds =
    new Set<
      string
    >();

  for (
    const publication of
      contractPublications
  ) {
    if (
      publication.ad_position_id
    ) {
      usedPositionIds.add(
        publication.ad_position_id
      );
    }
  }

  for (
    const sale of
      confirmedSales
  ) {
    for (
      const item of
        sale.items ??
        []
    ) {
      if (
        item.ad_position_id
      ) {
        usedPositionIds.add(
          item.ad_position_id
        );
      }
    }
  }

  const blockedUsedPositions =
    Array.from(
      usedPositionIds
    ).filter(
      (
        positionId
      ) =>
        Boolean(
          positionsById.get(
            positionId
          )
            ?.manually_blocked
        )
    ).length;

  const inactiveUsedPositions =
    Array.from(
      usedPositionIds
    ).filter(
      (
        positionId
      ) =>
        positionsById.get(
          positionId
        )?.active ===
        false
    ).length;

  /*
   * =====================================================
   * MODAIS
   * =====================================================
   */

  const positionsForPublication =
    Array.from(
      positionsById.values()
    )
      .sort(
        (
          a,
          b
        ) =>
          getPositionOrder(
            a.position_code
          ) -
          getPositionOrder(
            b.position_code
          )
      )
      .map(
        (
          position
        ) => ({
          id:
            position.id,

          section_id:
            position.section_id,

          position_code:
            position.position_code,

          name:
            position.name,

          capacity:
            position.capacity,

          manually_blocked:
            position.manually_blocked,

          blocked_reason:
            position.blocked_reason,

          active:
            position.active,

          usageCount:
            soldByPosition.get(
              position.id
            ) ??
            0,
        })
      );

  const sectionsForPublication =
    sections
      .filter(
        (
          section
        ) =>
          Boolean(
            section.active
          )
      )
      .map(
        (
          section
        ) => ({
          id:
            section.id,

          name:
            section.name,

          description:
            section.description,
        })
      );

  /*
   * =====================================================
   * RESUMO CADERNOS
   * =====================================================
   */

  const sectionSummaries =
    sections.map(
      (
        section
      ) => {
        const salesGoal =
          Number(
            section.sales_goal ??
              0
          );

        const soldAmount =
          soldBySection.get(
            section.id
          ) ??
          0;

        const remainingAmount =
          Math.max(
            roundMoney(
              salesGoal -
                soldAmount
            ),
            0
          );

        const progressPercentage =
          salesGoal >
          0
            ? (
                soldAmount /
                salesGoal
              ) *
              100
            : 0;

        const positions =
          (
            section.positions ??
            []
          )
            .slice()
            .sort(
              (
                a,
                b
              ) =>
                getPositionOrder(
                  a.position_code
                ) -
                getPositionOrder(
                  b.position_code
                )
            )
            .map(
              (
                position
              ) => {
                const soldCount =
                  soldByPosition.get(
                    position.id
                  ) ??
                  0;

                const capacity =
                  position.capacity ===
                  null
                    ? null
                    : Number(
                        position.capacity
                      );

                return {
                  id:
                    position.id,

                  positionCode:
                    position.position_code,

                  name:
                    position.name,

                  capacity,

                  soldCount,

                  manuallyBlocked:
                    Boolean(
                      position.manually_blocked
                    ),

                  blockedReason:
                    position.blocked_reason,

                  active:
                    Boolean(
                      position.active
                    ),

                  exhausted:
                    capacity !==
                      null &&
                    soldCount >=
                      capacity,
                };
              }
            );

        return {
          id:
            section.id,

          name:
            section.name,

          description:
            section.description,

          active:
            Boolean(
              section.active
            ),

          salesGoal,

          soldAmount:
            roundMoney(
              soldAmount
            ),

          remainingAmount,

          progressPercentage,

          positions,
        };
      }
    );

  /*
   * =====================================================
   * TOTAIS
   * =====================================================
   */

  const totalStandaloneSales =
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

  const totalContractPublications =
    roundMoney(
      contractPublications.reduce(
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

  const totalSales =
    roundMoney(
      totalStandaloneSales +
        totalContractPublications
    );

  const totalAds =
    standaloneAds +
    contractPublications.length;

  /*
   * =====================================================
   * CLIENTES ÚNICOS
   * =====================================================
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
    const contract of
      contracts
  ) {
    clientIds.add(
      contract.client_id
    );
  }

  const totalClients =
    clientIds.size;

  /*
   * =====================================================
   * COMISSÕES AVULSAS
   * =====================================================
   */

  const totalCommissions =
    roundMoney(
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
      )
    );

  /*
   * =====================================================
   * META
   * =====================================================
   */

  const editionSalesGoal =
    Number(
      edition.sales_goal ??
        0
    );

  const editionRemaining =
    Math.max(
      roundMoney(
        editionSalesGoal -
          totalSales
      ),
      0
    );

  const editionProgress =
    editionSalesGoal >
    0
      ? (
          totalSales /
          editionSalesGoal
        ) *
        100
      : 0;

  const editionProgressBar =
    Math.min(
      Math.max(
        editionProgress,
        0
      ),
      100
    );

  const company =
    getFirst(
      edition.company
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/edicoes"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Edições
        </Link>

        {/* HEADER */}

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
            <div className="flex flex-wrap items-center gap-3">
              <AddContractPublication
                editionId={
                  edition.id
                }
                contracts={
                  availableContracts
                }
                sections={
                  sectionsForPublication
                }
                positions={
                  positionsForPublication
                }
              />

              <Link
                href={`/edicoes/${edition.id}/vendas/nova`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f]"
              >
                <Plus className="h-4 w-4" />

                Venda avulsa
              </Link>

              <CloseEditionButton
                editionId={
                  edition.id
                }
                editionName={
                  edition.name
                }
                totalPublications={
                  totalAds
                }
                contractPublications={
                  contractPublications.length
                }
                standalonePublications={
                  standaloneAds
                }
                totalClients={
                  totalClients
                }
                totalAmount={
                  totalSales
                }
                salesGoal={
                  editionSalesGoal
                }
                pendingContractPublications={
                  pendingContractPublications
                }
                pendingStandalonePublications={
                  pendingStandalonePublications
                }
                draftSales={
                  draftSales.length
                }
                blockedUsedPositions={
                  blockedUsedPositions
                }
                inactiveUsedPositions={
                  inactiveUsedPositions
                }
              />
              
            </div>
            
          )}

          <Link
  href={`/edicoes/${edition.id}/espelho`}
  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f]"
>
  <LayoutGrid className="h-4 w-4" />

  Ver espelho
</Link>

{edition.status === "closed" && (
  <ReopenEditionButton
    editionId={edition.id}
    editionName={edition.name}
  />
)}
        </div>

        {/* FLUXO */}

        {edition.status ===
          "open" && (
          <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#15704f]" />

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Montagem da edição
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Vincule os contratos e configure posição e tamanho de todas as publicações antes de fechar a edição.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* META */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-2">
              <Goal className="h-5 w-5 text-[#15704f]" />

              <h2 className="font-semibold text-slate-900">
                Meta comercial da edição
              </h2>
            </div>
          </div>

          <div className="p-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CommercialValueCard
                label="Meta"
                value={
                  formatCurrency(
                    editionSalesGoal
                  )
                }
              />

              <CommercialValueCard
                label="Vinculado"
                value={
                  formatCurrency(
                    totalSales
                  )
                }
                highlighted
              />

              <CommercialValueCard
                label="Falta"
                value={
                  formatCurrency(
                    editionRemaining
                  )
                }
              />

              <CommercialValueCard
                label="Atingimento"
                value={
                  editionSalesGoal >
                  0
                    ? formatPercentage(
                        editionProgress
                      )
                    : "Sem meta"
                }
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-blue-500">
                  Via contratos
                </p>

                <p className="mt-1 text-sm font-semibold text-blue-800">
                  {formatCurrency(
                    totalContractPublications
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Vendas avulsas
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatCurrency(
                    totalStandaloneSales
                  )}
                </p>
              </div>
            </div>

            {editionSalesGoal >
              0 && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Progresso
                  </span>

                  <span className="text-xs font-semibold text-[#15704f]">
                    {formatPercentage(
                      editionProgress
                    )}
                  </span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#15704f]"
                    style={{
                      width:
                        `${editionProgressBar}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* INDICADORES */}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            icon={
              CircleDollarSign
            }
            label="Total vinculado"
            value={
              formatCurrency(
                totalSales
              )
            }
          />

          <SummaryCard
            icon={
              Users
            }
            label="Clientes"
            value={
              String(
                totalClients
              )
            }
          />

          <SummaryCard
            icon={
              ShoppingCart
            }
            label="Publicações"
            value={
              String(
                totalAds
              )
            }
          />

          <SummaryCard
            icon={
              FileText
            }
            label="Via contratos"
            value={
              String(
                contractPublications.length
              )
            }
          />

          <SummaryCard
            icon={
              TrendingUp
            }
            label="Comissões avulsas"
            value={
              formatCurrency(
                totalCommissions
              )
            }
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
            sectionSummaries
          }
        />

        {/* PUBLICAÇÕES VINCULADAS */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />

                <h2 className="font-semibold text-slate-900">
                  Publicações vinculadas
                </h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Contratos selecionados para esta edição.
              </p>
            </div>

            {edition.status ===
              "open" && (
              <AddContractPublication
                editionId={
                  edition.id
                }
                contracts={
                  availableContracts
                }
                sections={
                  sectionsForPublication
                }
                positions={
                  positionsForPublication
                }
              />
            )}
          </div>

          {contractPublications.length >
          0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>
                      Cliente
                    </TableHeader>

                    <TableHeader>
                      Contrato
                    </TableHeader>

                    <TableHeader>
                      Produto
                    </TableHeader>

                    <TableHeader>
                      Caderno
                    </TableHeader>

                    <TableHeader>
                      Posição
                    </TableHeader>

                    <TableHeader>
                      Tamanho
                    </TableHeader>

                    <TableHeader>
                      Valor
                    </TableHeader>

                    <TableHeader>
                      Responsável
                    </TableHeader>

                    <TableHeader>
                      Situação
                    </TableHeader>

                    <TableHeader>
                      Ações
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {contractPublications.map(
                    (
                      publication
                    ) => {
                      const contract =
                        contractsById.get(
                          publication.contract_id
                        );

                      const client =
                        contract
                          ? contractClientsById.get(
                              contract.client_id
                            )
                          : null;

                      const product =
                        contract
                          ?.product_id
                          ? productsById.get(
                              contract.product_id
                            )
                          : null;

                      const seller =
                        contract
                          ?.responsible_user_id
                          ? sellersById.get(
                              contract.responsible_user_id
                            )
                          : null;

                      const section =
                        publication.section_id
                          ? sectionsById.get(
                              publication.section_id
                            )
                          : null;

                      const position =
                        publication.ad_position_id
                          ? positionsById.get(
                              publication.ad_position_id
                            )
                          : null;

                      const completelyDefined =
                        Boolean(
                          publication.ad_position_id &&
                          publication
                            .size_description
                            ?.trim()
                        );

                      return (
                        <tr
                          key={
                            publication.id
                          }
                        >
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-900">
                              {client?.name ??
                                "Cliente"}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-700">
                              {contract?.title ??
                                "Contrato"}
                            </p>
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {product?.name ??
                              "—"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {section?.name ??
                              "Sem caderno"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {position?.name ??
                              "Definir depois"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {publication
                              .size_description ??
                              "Definir depois"}
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              Number(
                                publication.amount ??
                                  0
                              )
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {seller
                              ?.name ??
                              "—"}
                          </td>

                          <td className="px-6 py-4">
                            {completelyDefined ? (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                Configurada
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                Pendente
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            {edition.status ===
                            "open" ? (
                              <EditContractPublication
                                editionId={
                                  edition.id
                                }
                                publication={{
                                  id:
                                    publication.id,

                                  contractId:
                                    publication.contract_id,

                                  contractTitle:
                                    contract?.title ??
                                    "Contrato",

                                  clientName:
                                    client?.name ??
                                    "Cliente",

                                  productName:
                                    product?.name ??
                                    null,

                                  sectionId:
                                    publication.section_id,

                                  adPositionId:
                                    publication.ad_position_id,

                                  sizeDescription:
                                    publication.size_description,

                                  amount:
                                    publication.amount,

                                  notes:
                                    publication.notes,
                                }}
                                sections={
                                  sectionsForPublication
                                }
                                positions={
                                  positionsForPublication
                                }
                              />
                            ) : (
                              <span className="text-xs text-slate-400">
                                Edição fechada
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Nenhuma publicação de contrato vinculada.
            </div>
          )}
        </section>

        {/* VENDAS AVULSAS */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="font-semibold text-slate-900">
                Vendas avulsas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Vendas realizadas especificamente para esta edição.
              </p>
            </div>

            {edition.status ===
              "open" && (
              <Link
                href={`/edicoes/${edition.id}/vendas/nova`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600"
              >
                <Plus className="h-4 w-4" />

                Nova venda
              </Link>
            )}
          </div>

          {sales.length >
          0 ? (
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

                <tbody>
                  {sales.map(
                    (
                      sale
                    ) => {
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
                          className="border-t border-slate-100"
                        >
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                            {client?.name ??
                              "Cliente"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {seller
                              ?.name ??
                              "Vendedor"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {
                              (
                                sale.items ??
                                []
                              ).length
                            }
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              Number(
                                sale.total_amount ??
                                  0
                              )
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {formatCurrency(
                              Number(
                                sale.commission_amount ??
                                  0
                              )
                            )}
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
                              className="text-sm font-semibold text-[#15704f]"
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
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Nenhuma venda avulsa registrada.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/*
 * =====================================================
 * COMPONENTES AUXILIARES
 * =====================================================
 */

function CommercialValueCard({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlighted
          ? "border-emerald-100 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p
        className={`mt-2 text-lg font-semibold ${
          highlighted
            ? "text-[#15704f]"
            : "text-slate-900"
        }`}
      >
        {
          value
        }
      </p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon:
    React.ElementType;

  label: string;

  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-[#15704f]">
        <Icon className="h-4 w-4" />
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {
          label
        }
      </p>

      <p className="mt-1 text-xl font-semibold text-slate-900">
        {
          value
        }
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
      {
        children
      }
    </th>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
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

function SaleStatusBadge({
  status,
}: {
  status: string;
}) {
  const labels:
    Record<
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

  const styles:
    Record<
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

function roundMoney(
  value: number
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
    Number.isFinite(
      value
    )
      ? value
      : 0
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

function getPositionOrder(
  code: string
) {
  const order:
    Record<
      string,
      number
    > = {
    cover:
      1,

    back_cover:
      2,

    overcover:
      3,

    inside_color:
      4,

    inside_bw:
      5,
  };

  return (
    order[
      code
    ] ??
    99
  );
}