import Link from "next/link";

import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCircle2,
  Circle,
  LayoutGrid,
  Newspaper,
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

import { PrintButton } from "./print-button";

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

type PositionRecord = {
  id: string;

  edition_id: string;

  section_id:
    | string
    | null;

  position_code: string;

  name: string;

  capacity:
    | number
    | null;

  manually_blocked: boolean;

  blocked_reason:
    | string
    | null;

  active: boolean;
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
};

type ContractRecord = {
  id: string;

  client_id: string;

  product_id:
    | string
    | null;

  title: string;
};

type ClientRecord = {
  id: string;
  name: string;
};

type ProductRecord = {
  id: string;
  name: string;
};

type MirrorEntry = {
  id: string;

  origin:
    | "contract"
    | "standalone";

  clientName: string;

  title: string;

  productName:
    | string
    | null;

  sizeDescription:
    | string
    | null;

  amount: number;

  notes:
    | string
    | null;

  sectionId:
    | string
    | null;

  positionId:
    | string
    | null;
};

/*
 * =====================================================
 * PAGE
 * =====================================================
 */

export default async function EditionMirrorPage({
  params,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const {
    id: editionId,
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
    error: editionError,
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
          active
        )
      `)
      .eq(
        "id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (
    editionError ||
    !edition
  ) {
    console.error(
      "Erro ao carregar edição:",
      editionError
    );

    notFound();
  }

  const company =
    getFirst(
      edition.company
    );

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
   * =====================================================
   * TODAS AS POSIÇÕES
   * =====================================================
   */

  const {
    data: positionsData,
    error: positionsError,
  } =
    await supabase
      .from(
        "edition_ad_positions"
      )
      .select(`
        id,
        edition_id,
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
      );

  if (
    positionsError
  ) {
    console.error(
      "Erro ao carregar posições:",
      positionsError
    );
  }

  const positions =
    (
      positionsData ??
      []
    ) as PositionRecord[];

  /*
   * =====================================================
   * PUBLICAÇÕES DE CONTRATOS
   * =====================================================
   */

  const {
    data:
      contractPublicationsData,
    error:
      contractPublicationsError,
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
        active
      `)
      .eq(
        "edition_id",
        edition.id
      )
      .eq(
        "active",
        true
      );

  if (
    contractPublicationsError
  ) {
    console.error(
      "Erro ao carregar publicações dos contratos:",
      contractPublicationsError
    );
  }

  const contractPublications =
    (
      contractPublicationsData ??
      []
    ) as ContractPublication[];

  /*
   * =====================================================
   * CONTRATOS
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
          product_id,
          title
        `)
        .eq(
          "company_id",
          edition.company_id
        )
        .in(
          "id",
          contractIds
        );

    if (
      error
    ) {
      console.error(
        "Erro ao carregar contratos:",
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
   * CLIENTES DOS CONTRATOS
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
      data,
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
        data ??
        []
      ) as ClientRecord[];
  }

  const clientsById =
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
   * ENTRIES DE CONTRATOS
   * =====================================================
   */

  const contractEntries:
    MirrorEntry[] =
    contractPublications.map(
      (
        publication
      ) => {
        const contract =
          contractsById.get(
            publication.contract_id
          );

        const client =
          contract
            ? clientsById.get(
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

        return {
          id:
            publication.id,

          origin:
            "contract",

          clientName:
            client?.name ??
            "Cliente",

          title:
            contract?.title ??
            "Contrato",

          productName:
            product?.name ??
            null,

          sizeDescription:
            publication.size_description,

          amount:
            Number(
              publication.amount ??
                0
            ),

          notes:
            publication.notes,

          sectionId:
            publication.section_id,

          positionId:
            publication.ad_position_id,
        };
      }
    );

  /*
   * =====================================================
   * VENDAS AVULSAS
   * =====================================================
   */

  const {
    data:
      standaloneSales,
    error:
      standaloneSalesError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .select(`
        id,
        client_id,
        status,
        total_amount,
        notes,

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
          total_amount,
          notes
        )
      `)
      .eq(
        "edition_id",
        edition.id
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .eq(
        "status",
        "confirmed"
      );

  if (
    standaloneSalesError
  ) {
    console.error(
      "Erro ao carregar vendas avulsas:",
      standaloneSalesError
    );
  }

  const standaloneEntries:
    MirrorEntry[] =
    [];

  for (
    const sale of
      standaloneSales ??
      []
  ) {
    const client =
      getFirst(
        sale.client
      );

    for (
      const item of
        sale.items ??
        []
    ) {
      standaloneEntries.push({
        id:
          item.id,

        origin:
          "standalone",

        clientName:
          client?.name ??
          "Cliente",

        title:
          item.description ||
          "Venda avulsa",

        productName:
          null,

        sizeDescription:
          item.size_description,

        amount:
          Number(
            item.total_amount ??
              0
          ),

        notes:
          item.notes ??
          sale.notes ??
          null,

        sectionId:
          item.section_id,

        positionId:
          item.ad_position_id,
      });
    }
  }

  /*
   * =====================================================
   * TODAS AS PUBLICAÇÕES
   * =====================================================
   */

  const entries =
    [
      ...contractEntries,
      ...standaloneEntries,
    ];

  /*
   * =====================================================
   * PUBLICAÇÕES POR POSIÇÃO
   * =====================================================
   */

  const entriesByPosition =
    new Map<
      string,
      MirrorEntry[]
    >();

  for (
    const entry of
      entries
  ) {
    if (
      !entry.positionId
    ) {
      continue;
    }

    const current =
      entriesByPosition.get(
        entry.positionId
      ) ??
      [];

    current.push(
      entry
    );

    entriesByPosition.set(
      entry.positionId,
      current
    );
  }

  /*
   * =====================================================
   * PENDÊNCIAS SEM POSIÇÃO
   * =====================================================
   */

  const unpositionedEntries =
    entries.filter(
      (
        entry
      ) =>
        !entry.positionId
    );

  /*
   * =====================================================
   * POSIÇÕES GERAIS
   * =====================================================
   */

  const generalPositions =
    positions
      .filter(
        (
          position
        ) =>
          position.section_id ===
          null
      )
      .sort(
        positionSorter
      );

  /*
   * =====================================================
   * TOTAIS
   * =====================================================
   */

  const occupiedPositions =
    positions.filter(
      (
        position
      ) =>
        (
          entriesByPosition.get(
            position.id
          ) ??
          []
        ).length >
        0
    ).length;

  const blockedPositions =
    positions.filter(
      (
        position
      ) =>
        position.manually_blocked
    ).length;

  const freePositions =
    positions.filter(
      (
        position
      ) => {
        if (
          !position.active ||
          position.manually_blocked
        ) {
          return false;
        }

        const usage =
          (
            entriesByPosition.get(
              position.id
            ) ??
            []
          ).length;

        if (
          position.capacity ===
          null
        ) {
          return usage ===
            0;
        }

        return (
          usage <
          Number(
            position.capacity
          )
        );
      }
    ).length;

  const totalAmount =
    entries.reduce(
      (
        total,
        entry
      ) =>
        total +
        entry.amount,
      0
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl">

        {/* =================================================
            TOPO
           ================================================= */}

        <div className="print:hidden">
          <Link
            href={`/edicoes/${edition.id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />

            Voltar para edição
          </Link>
        </div>

        <div className="mt-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-start print:mt-0">
          <div className="flex items-start gap-3">
            <div className="print:hidden flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
              <LayoutGrid className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#15704f]">
                Espelho da edição
              </p>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {
                  edition.name
                }
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
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

                {company?.name && (
                  <span>
                    {
                      company.name
                    }
                  </span>
                )}
              </div>
            </div>
          </div>

          <PrintButton />
        </div>

        {/* =================================================
            RESUMO
           ================================================= */}

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 print:grid-cols-5">
          <SummaryCard
            label="Publicações"
            value={
              String(
                entries.length
              )
            }
          />

          <SummaryCard
            label="Posições ocupadas"
            value={
              String(
                occupiedPositions
              )
            }
          />

          <SummaryCard
            label="Posições livres"
            value={
              String(
                freePositions
              )
            }
          />

          <SummaryCard
            label="Bloqueadas"
            value={
              String(
                blockedPositions
              )
            }
          />

          <SummaryCard
            label="Valor"
            value={
              formatCurrency(
                totalAmount
              )
            }
          />
        </div>

        {/* =================================================
            LEGENDA
           ================================================= */}

        <div className="mt-5 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 print:border-slate-300">
          <Legend
            icon={
              Circle
            }
            label="Livre"
          />

          <Legend
            icon={
              CheckCircle2
            }
            label="Ocupada"
          />

          <Legend
            icon={
              Ban
            }
            label="Bloqueada"
          />

          <Legend
            icon={
              AlertTriangle
            }
            label="Pendente"
          />
        </div>

        {/* =================================================
            POSIÇÕES GERAIS
           ================================================= */}

        {generalPositions.length >
          0 && (
          <MirrorSection
            title="Posições gerais da edição"
            description="Posições que não pertencem a um caderno específico."
            positions={
              generalPositions
            }
            entriesByPosition={
              entriesByPosition
            }
          />
        )}

        {/* =================================================
            CADERNOS
           ================================================= */}

        {sections.map(
          (
            section
          ) => {
            const sectionPositions =
              positions
                .filter(
                  (
                    position
                  ) =>
                    position.section_id ===
                    section.id
                )
                .sort(
                  positionSorter
                );

            const looseEntries =
              entries.filter(
                (
                  entry
                ) =>
                  entry.sectionId ===
                    section.id &&
                  !entry.positionId
              );

            return (
              <section
                key={
                  section.id
                }
                className="mt-8 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white print:rounded-none print:border-slate-300"
              >
                <div className="border-b border-slate-100 px-6 py-5 print:border-slate-300">
                  <div className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-[#15704f]" />

                    <h2 className="text-lg font-semibold text-slate-900">
                      {
                        section.name
                      }
                    </h2>
                  </div>

                  {section.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {
                        section.description
                      }
                    </p>
                  )}
                </div>

                {sectionPositions.length >
                0 ? (
                  <div className="grid gap-4 p-6 lg:grid-cols-2 print:grid-cols-2">
                    {sectionPositions.map(
                      (
                        position
                      ) => (
                        <PositionCard
                          key={
                            position.id
                          }
                          position={
                            position
                          }
                          entries={
                            entriesByPosition.get(
                              position.id
                            ) ??
                            []
                          }
                        />
                      )
                    )}
                  </div>
                ) : (
                  <div className="px-6 py-8 text-sm text-slate-400">
                    Nenhuma posição cadastrada neste caderno.
                  </div>
                )}

                {looseEntries.length >
                  0 && (
                  <div className="border-t border-amber-100 bg-amber-50/50 px-6 py-5">
                    <p className="text-sm font-semibold text-amber-800">
                      Publicações sem posição definida
                    </p>

                    <div className="mt-3 grid gap-3">
                      {looseEntries.map(
                        (
                          entry
                        ) => (
                          <LooseEntry
                            key={
                              `${entry.origin}-${entry.id}`
                            }
                            entry={
                              entry
                            }
                          />
                        )
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          }
        )}

        {/* =================================================
            SEM CADERNO E SEM POSIÇÃO
           ================================================= */}

        {unpositionedEntries.filter(
          (
            entry
          ) =>
            !entry.sectionId
        ).length >
          0 && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-amber-200 bg-white">
            <div className="border-b border-amber-100 bg-amber-50 px-6 py-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />

                <h2 className="font-semibold text-amber-900">
                  Publicações ainda sem posição
                </h2>
              </div>

              <p className="mt-1 text-sm text-amber-700">
                Estas publicações ainda não foram distribuídas no espelho.
              </p>
            </div>

            <div className="grid gap-3 p-6 lg:grid-cols-2 print:grid-cols-2">
              {unpositionedEntries
                .filter(
                  (
                    entry
                  ) =>
                    !entry.sectionId
                )
                .map(
                  (
                    entry
                  ) => (
                    <LooseEntry
                      key={
                        `${entry.origin}-${entry.id}`
                      }
                      entry={
                        entry
                      }
                    />
                  )
                )}
            </div>
          </section>
        )}

        {/* =================================================
            SEM POSIÇÕES
           ================================================= */}

        {positions.length ===
          0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <LayoutGrid className="mx-auto h-7 w-7 text-slate-300" />

            <h2 className="mt-3 font-semibold text-slate-800">
              Nenhuma posição cadastrada
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre as posições da edição para montar o espelho.
            </p>
          </div>
        )}

        {/* =================================================
            RODAPÉ IMPRESSÃO
           ================================================= */}

        <div className="mt-10 hidden border-t border-slate-300 pt-4 text-xs text-slate-400 print:block">
          Espelho operacional •{" "}
          {
            edition.name
          }{" "}
          • Gerado pelo sistema Grupo Pulso
        </div>
      </div>
    </main>
  );
}

/*
 * =====================================================
 * SEÇÃO DO ESPELHO
 * =====================================================
 */

function MirrorSection({
  title,
  description,
  positions,
  entriesByPosition,
}: {
  title: string;

  description: string;

  positions:
    PositionRecord[];

  entriesByPosition:
    Map<
      string,
      MirrorEntry[]
    >;
}) {
  return (
    <section className="mt-8 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white print:rounded-none print:border-slate-300">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-900">
          {
            title
          }
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {
            description
          }
        </p>
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-2 print:grid-cols-2">
        {positions.map(
          (
            position
          ) => (
            <PositionCard
              key={
                position.id
              }
              position={
                position
              }
              entries={
                entriesByPosition.get(
                  position.id
                ) ??
                []
              }
            />
          )
        )}
      </div>
    </section>
  );
}

/*
 * =====================================================
 * POSIÇÃO
 * =====================================================
 */

function PositionCard({
  position,
  entries,
}: {
  position:
    PositionRecord;

  entries:
    MirrorEntry[];
}) {
  const usage =
    entries.length;

  const capacity =
    position.capacity;

  const isBlocked =
    position.manually_blocked ||
    !position.active;

  const isFull =
    capacity !==
      null &&
    usage >=
      Number(
        capacity
      );

  const isFree =
    !isBlocked &&
    usage ===
      0;

  return (
    <div
      className={`break-inside-avoid rounded-xl border p-4 ${
        isBlocked
          ? "border-red-200 bg-red-50/50"
          : isFree
            ? "border-slate-200 bg-slate-50/50"
            : isFull
              ? "border-emerald-200 bg-emerald-50/50"
              : "border-blue-200 bg-blue-50/40"
      }`}
    >
      {/* HEADER */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">
              {
                position.name
              }
            </p>

            {position.position_code && (
              <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {
                  position.position_code
                }
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-400">
            {capacity ===
            null
              ? `${usage} ocupação(ões)`
              : `${usage}/${capacity} ocupado`}
          </p>
        </div>

        <PositionStatus
          blocked={
            isBlocked
          }
          free={
            isFree
          }
          full={
            isFull
          }
        />
      </div>

      {/* BLOQUEIO */}

      {isBlocked &&
        position.blocked_reason && (
        <div className="mt-3 rounded-lg bg-red-100/70 px-3 py-2 text-xs text-red-700">
          {
            position.blocked_reason
          }
        </div>
      )}

      {/* ENTRIES */}

      {entries.length >
      0 ? (
        <div className="mt-4 space-y-3">
          {entries.map(
            (
              entry
            ) => (
              <PublicationEntry
                key={
                  `${entry.origin}-${entry.id}`
                }
                entry={
                  entry
                }
              />
            )
          )}
        </div>
      ) : (
        !isBlocked && (
          <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-5 text-center">
            <p className="text-xs font-medium text-slate-400">
              Posição livre
            </p>
          </div>
        )
      )}
    </div>
  );
}

/*
 * =====================================================
 * PUBLICAÇÃO
 * =====================================================
 */

function PublicationEntry({
  entry,
}: {
  entry:
    MirrorEntry;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {
              entry.clientName
            }
          </p>

          <p className="mt-0.5 text-xs text-slate-500">
            {
              entry.title
            }
          </p>
        </div>

        <OriginBadge
          origin={
            entry.origin
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.productName && (
          <InfoBadge>
            {
              entry.productName
            }
          </InfoBadge>
        )}

        <InfoBadge>
          {entry.sizeDescription ||
            "Tamanho não definido"}
        </InfoBadge>

        <InfoBadge>
          {formatCurrency(
            entry.amount
          )}
        </InfoBadge>
      </div>

      {entry.notes && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
          {
            entry.notes
          }
        </p>
      )}
    </div>
  );
}

/*
 * =====================================================
 * SEM POSIÇÃO
 * =====================================================
 */

function LooseEntry({
  entry,
}: {
  entry:
    MirrorEntry;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {
              entry.clientName
            }
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {
              entry.title
            }
          </p>
        </div>

        <OriginBadge
          origin={
            entry.origin
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.sizeDescription && (
          <InfoBadge>
            {
              entry.sizeDescription
            }
          </InfoBadge>
        )}

        <InfoBadge>
          {formatCurrency(
            entry.amount
          )}
        </InfoBadge>
      </div>
    </div>
  );
}

/*
 * =====================================================
 * STATUS
 * =====================================================
 */

function PositionStatus({
  blocked,
  free,
  full,
}: {
  blocked: boolean;

  free: boolean;

  full: boolean;
}) {
  if (
    blocked
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        <Ban className="h-3.5 w-3.5" />

        Bloqueada
      </span>
    );
  }

  if (
    free
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        <Circle className="h-3.5 w-3.5" />

        Livre
      </span>
    );
  }

  if (
    full
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />

        Lotada
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
      <CheckCircle2 className="h-3.5 w-3.5" />

      Ocupada
    </span>
  );
}

function OriginBadge({
  origin,
}: {
  origin:
    | "contract"
    | "standalone";
}) {
  if (
    origin ===
    "contract"
  ) {
    return (
      <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
        Contrato
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
      Avulsa
    </span>
  );
}

/*
 * =====================================================
 * SUMMARY
 * =====================================================
 */

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-400">
        {
          label
        }
      </p>

      <p className="mt-1 text-lg font-semibold text-slate-900">
        {
          value
        }
      </p>
    </div>
  );
}

function InfoBadge({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
      {
        children
      }
    </span>
  );
}

function Legend({
  icon: Icon,
  label,
}: {
  icon:
    React.ElementType;

  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <Icon className="h-3.5 w-3.5" />

      {
        label
      }
    </span>
  );
}

/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

function positionSorter(
  a: PositionRecord,
  b: PositionRecord
) {
  const orderDifference =
    getPositionOrder(
      a.position_code
    ) -
    getPositionOrder(
      b.position_code
    );

  if (
    orderDifference !==
    0
  ) {
    return orderDifference;
  }

  return a.name.localeCompare(
    b.name,
    "pt-BR"
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

    columnist:
      6,
  };

  return (
    order[
      code
    ] ??
    99
  );
}

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
    ? value[0] ??
        null
    : value;
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