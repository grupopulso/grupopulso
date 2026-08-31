import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  FileText,
  MapPin,
  Monitor,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  UserRound,
} from "lucide-react";

import DeleteContractButton from "./delete-contract-button";
import RenewContractButton from "./renew-contract-button";
import ContractResponsibleEditor from "./contract-responsible-editor";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_STYLES,
  getContractStatus,
} from "@/app/lib/contract-status";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ContractDetailPage({
  params,
}: PageProps) {
  const access =
    await requireModulePermission(
      "contracts",
      "view"
    );

  const canReassignResponsible =
    access.profile.role === "admin" ||
    access.profile.role === "manager";

  const {
    id,
  } = await params;

  const supabase =
    await createClient();

  /*
   * =========================
   * CONTRATO
   * =========================
   */

  const {
    data: contract,
    error,
  } =
    await supabase
      .from(
        "contracts"
      )
      .select(`
        id,
        client_id,
        company_id,
        product_id,
        responsible_user_id,
        title,

        start_date,
        end_date,

        value,
        billing_frequency,

        status,
        auto_renew,

        payment_method_id,
        installments,
        first_due_date,

        legacy_subscription_number,

        notes,

        created_at,
        updated_at,

        client:clients (
          id,
          name
        ),

        company:companies (
          id,
          name,
          color,
          slug
        ),

        product:products (
          id,
          name,
          type
        ),

        payment_method:payment_methods (
          id,
          name,
          code
        )
      `)
      .eq(
        "id",
        id
      )
      .maybeSingle();

  if (error) {
    console.error(
      "Erro ao buscar contrato:",
      error
    );
  }

  if (
    error ||
    !contract
  ) {
    notFound();
  }

  /*
   * Escopo de empresa: além da permissão de módulo, o usuário
   * só pode ver um contrato específico se tiver vínculo com a
   * empresa dele (admin sempre passa). Sem isto, trocar o id na
   * URL exibiria contrato de qualquer empresa.
   */
  await requireCompanyAccess(
    contract.company_id
  );

  /*
   * =========================
   * PUBLICAÇÕES EM EDIÇÕES
   * =========================
   *
   * Só para contratos de anúncio do O Estafeta. Contrato de
   * assinatura do jornal não "publica em edição".
   */

  const contractCompany =
    getFirst(contract.company);

  const contractProduct =
    getFirst(contract.product);

  const isEstafetaContract =
    contractCompany?.slug ===
    "o-estafeta";

  const isSubscriptionContract =
    contractProduct?.type ===
      "subscription" ||
    Boolean(
      contract.legacy_subscription_number
    );

  const canPublishInEditions =
    isEstafetaContract &&
    !isSubscriptionContract;

  let editionPublications: {
    id: string;
    editionId: string;
    editionName: string;
    editionNumber: number | null;
    editionStatus: string;
    sectionName: string | null;
    positionName: string | null;
    sizeDescription: string | null;
    amount: number;
    publicationDate: string;
  }[] = [];

  let openEditionsForPublish: {
    id: string;
    name: string;
    editionNumber: number | null;
  }[] = [];

  if (canPublishInEditions) {
    const [
      publicationsResult,
      openEditionsResult,
    ] = await Promise.all([
      supabase
        .from(
          "contract_edition_publications"
        )
        .select(`
          id,
          edition_id,
          size_description,
          amount,
          active,

          edition:newspaper_editions (
            id,
            name,
            edition_number,
            status,
            publication_date
          ),

          section:edition_sections (
            id,
            name
          ),

          position:edition_ad_positions (
            id,
            name
          )
        `)
        .eq(
          "contract_id",
          contract.id
        )
        .eq("active", true),

      supabase
        .from("newspaper_editions")
        .select(`
          id,
          name,
          edition_number,
          publication_date
        `)
        .eq(
          "company_id",
          contract.company_id
        )
        .eq("status", "open")
        .order("publication_date", {
          ascending: true,
        }),
    ]);

    if (publicationsResult.error) {
      console.error(
        "Erro ao carregar publicações do contrato:",
        publicationsResult.error
      );
    }

    editionPublications = (
      publicationsResult.data ?? []
    )
      .map((publication) => {
        const publicationEdition =
          getFirst(publication.edition);

        const publicationSection =
          getFirst(publication.section);

        const publicationPosition =
          getFirst(
            publication.position
          );

        return {
          id: publication.id,
          editionId:
            publication.edition_id,
          editionName:
            publicationEdition?.name ??
            "Edição",
          editionNumber:
            publicationEdition?.edition_number ??
            null,
          editionStatus:
            publicationEdition?.status ??
            "open",
          sectionName:
            publicationSection?.name ??
            null,
          positionName:
            publicationPosition?.name ??
            null,
          sizeDescription:
            publication.size_description,
          amount: Number(
            publication.amount ?? 0
          ),
          publicationDate:
            publicationEdition?.publication_date ??
            "",
        };
      })
      .sort((a, b) =>
        b.publicationDate.localeCompare(
          a.publicationDate
        )
      );

    const linkedEditionIds = new Set(
      editionPublications.map(
        (publication) =>
          publication.editionId
      )
    );

    openEditionsForPublish = (
      openEditionsResult.data ?? []
    )
      .filter(
        (edition) =>
          !linkedEditionIds.has(
            edition.id
          )
      )
      .map((edition) => ({
        id: edition.id,
        name: edition.name,
        editionNumber:
          edition.edition_number,
      }));
  }

  /*
   * =========================
   * PARCELAS
   * =========================
   */

  const {
    data: installments,
    error:
      installmentsError,
  } =
    await supabase
      .from(
        "contract_installments"
      )
      .select(`
        id,
        installment_number,
        due_date,
        amount,
        financial_entry_id,

        financial_entry:financial_entries (
          id,
          amount,
          amount_paid,
          interest,
          fine,
          discount,
          due_date,
          status,
          invoice_issued,
          invoice_number,
          invoice_issued_at,
          charge_sent,
          charge_sent_at
        )
      `)
      .eq(
        "contract_id",
        id
      )
      .order(
        "installment_number",
        {
          ascending: true,
        }
      );

  if (
    installmentsError
  ) {
    console.error(
      "Erro ao buscar parcelas:",
      installmentsError
    );
  }

    /*
   * =========================
   * COMISSÃO DO CONTRATO
   * =========================
   */

 const {
  data: contractCommissions,
  error:
    commissionsError,
} =
  await supabase
    .from(
      "contract_commissions"
    )
    .select(`
      id,
      contract_id,
      beneficiary_user_id,
      source_user_id,
      percentage,
      base_amount,
      amount,
      amount_released,
      amount_paid,
      status,
      paid_at,
      created_at,
      updated_at
    `)
    .eq(
      "contract_id",
      id
    )
    .order(
      "created_at",
      {
        ascending:
          true,
      }
    );

  if (
    commissionsError
  ) {
    console.error(
      "Erro ao buscar comissões do contrato:",
      commissionsError
    );
  }

  /*
   * =========================
   * RESPONSÁVEL
   * =========================
   */

  let responsibleProfile: {
    id: string;
    name: string | null;
  } | null = null;

  if (
    contract.responsible_user_id
  ) {
    const {
      data: profile,
      error:
        profileError,
    } =
      await supabase
        .from(
          "user_profiles"
        )
        .select(`
          id,
          name
        `)
        .eq(
          "id",
          contract
            .responsible_user_id
        )
        .maybeSingle();

    if (
      profileError
    ) {
      console.error(
        "Erro ao buscar responsável:",
        profileError
      );
    }

    responsibleProfile =
      profile;
  }

  /*
   * Opções para o admin/gestor trocar o responsável.
   */
  let responsibleOptions: {
    id: string;
    name: string | null;
  }[] = [];

  if (canReassignResponsible) {
    const { data: activeUsers } =
      await supabase
        .from("user_profiles")
        .select("id, name")
        .eq("active", true)
        .order("name");

    responsibleOptions =
      activeUsers ?? [];
  }

  /*
   * =========================
   * PAGAMENTOS DAS COMISSÕES
   * =========================
   */

  const commissionIds =
    (
      contractCommissions ??
      []
    ).map(
      (
        commission
      ) =>
        commission.id
    );

  let commissionPayments: {
    id: string;
    commission_id: string;
    financial_entry_id: string;
    amount:
      | number
      | string;
    amount_applied:
      | number
      | string;
    status: string;
    created_at: string;
  }[] = [];

  if (
    commissionIds.length >
    0
  ) {
    const {
      data:
        paymentRows,
      error:
        paymentsError,
    } =
      await supabase
        .from(
          "contract_commission_payments"
        )
        .select(`
          id,
          commission_id,
          financial_entry_id,
          amount,
          amount_applied,
          status,
          created_at
        `)
        .in(
          "commission_id",
          commissionIds
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (
      paymentsError
    ) {
      console.error(
        "Erro ao buscar pagamentos das comissões:",
        paymentsError
      );
    }

    commissionPayments =
      paymentRows ??
      [];
  }

  /*
   * =========================
   * TVs / TELÕES
   * =========================
   */

  const {
    data: contractTvs,
    error:
      contractTvsError,
  } =
    await supabase
      .from(
        "contract_tvs"
      )
      .select(`
        id,
        tv_id,

        tv:pottencializa_tvs (
          id,
          name,
          location
        )
      `)
      .eq(
        "contract_id",
        id
      );

  if (
    contractTvsError
  ) {
    console.error(
      "Erro ao buscar TVs do contrato:",
      contractTvsError
    );
  }

  /*
   * =========================
   * RELACIONAMENTOS
   * =========================
   */

  const client =
    getFirst(
      contract.client
    );

  const company =
    getFirst(
      contract.company
    );

  const product =
    getFirst(
      contract.product
    );

  const paymentMethod =
    getFirst(
      contract.payment_method
    );

  const linkedTvs =
    (
      contractTvs ??
      []
    )
      .map(
        (item) =>
          getFirst(
            item.tv
          )
      )
      .filter(
        (
          tv
        ): tv is NonNullable<
          typeof tv
        > =>
          Boolean(tv)
      );

  /*
   * =========================
   * STATUS
   * =========================
   */

  const displayStatus =
    getContractStatus(contract);

  /*
   * =========================
   * FINANCEIRO
   * =========================
   */

  const totalPaid =
    (
      installments ??
      []
    ).reduce(
      (
        total,
        installment
      ) => {
        const entry =
          getFirst(
            installment.financial_entry
          );

        return (
          total +
          Number(
            entry?.amount_paid ??
              0
          )
        );
      },
      0
    );

  const contractValue =
    Number(
      contract.value
    );

  const openValue =
    Math.max(
      contractValue -
        totalPaid,
      0
    );

      /*
   * =========================
   * RESUMO DAS COMISSÕES
   * =========================
   */

  const activeCommissions =
    (
      contractCommissions ??
      []
    ).filter(
      (
        commission
      ) =>
        commission.status !==
        "cancelled"
    );

    /*
 * =====================================================
 * PERFIS DOS BENEFICIÁRIOS DAS COMISSÕES
 * =====================================================
 */

const commissionUserIds =
  [
    ...new Set(
      activeCommissions.map(
        (
          commission
        ) =>
          commission
            .beneficiary_user_id
      )
    ),
  ];

let commissionProfiles: {
  id: string;
  name: string | null;
}[] = [];

if (
  commissionUserIds.length >
  0
) {
  const {
    data:
      profileRows,
    error:
      profileRowsError,
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
        commissionUserIds
      );

  if (
    profileRowsError
  ) {
    console.error(
      "Erro ao buscar beneficiários das comissões:",
      profileRowsError
    );
  }

  commissionProfiles =
    profileRows ??
    [];
}

const commissionProfilesById =
  new Map(
    commissionProfiles.map(
      (
        profile
      ) => [
        profile.id,
        profile,
      ]
    )
  );

  const commissionExpected =
    roundMoney(
      activeCommissions.reduce(
        (
          total,
          commission
        ) =>
          total +
          Number(
            commission.amount ??
              0
          ),
        0
      )
    );

  const commissionReleased =
    roundMoney(
      activeCommissions.reduce(
        (
          total,
          commission
        ) =>
          total +
          Number(
            commission
              .amount_released ??
              0
          ),
        0
      )
    );

  const commissionPaid =
    roundMoney(
      activeCommissions.reduce(
        (
          total,
          commission
        ) =>
          total +
          Number(
            commission
              .amount_paid ??
              0
          ),
        0
      )
    );

  const commissionCommitted =
    roundMoney(
      commissionPayments
        .filter(
          (
            payment
          ) =>
            payment.status !==
            "cancelled"
        )
        .reduce(
          (
            total,
            payment
          ) =>
            total +
            Math.max(
              Number(
                payment.amount ??
                  0
              ) -
                Number(
                  payment
                    .amount_applied ??
                    0
                ),
              0
            ),
          0
        )
    );

  const commissionAvailable =
    Math.max(
      roundMoney(
        commissionReleased -
          commissionPaid -
          commissionCommitted
      ),
      0
    );

  const commissionPendingRelease =
    Math.max(
      roundMoney(
        commissionExpected -
          commissionReleased
      ),
      0
    );


  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        {/* VOLTAR */}

        <Link
          href="/contratos"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Voltar para contratos
        </Link>

        {/* CABEÇALHO */}

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">
                {contract.title}
              </h1>

              <StatusBadge
                status={
                  displayStatus
                }
              />
            </div>

            <p className="mt-2 text-sm text-slate-500">
              {client?.name ??
                "Cliente não identificado"}

              {company?.name
                ? ` • ${company.name}`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/contratos/${contract.id}/editar`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />

              Editar contrato
            </Link>

            {displayStatus !==
              "cancelled" && (
              <RenewContractButton
                contractId={
                  contract.id
                }
                contractTitle={
                  contract.title
                }
              />
            )}

            <DeleteContractButton
              contractId={
                contract.id
              }
              contractTitle={
                contract.title
              }
            />

            <Link
              href={`/contratos/${contract.id}/recibo`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />

              PDF / Recibo
            </Link>

            {client && (
              <Link
                href={`/clientes/${client.id}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
              >
                <UserRound className="h-4 w-4" />

                Ver cliente
              </Link>
            )}
          </div>
        </div>

        {/* RESUMO */}

        <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Valor do contrato"
            value={formatCurrency(
              contractValue
            )}
            icon={
              <FileText className="h-5 w-5" />
            }
          />

          <SummaryCard
            label="Recebido"
            value={formatCurrency(
              totalPaid
            )}
            icon={
              <ReceiptText className="h-5 w-5" />
            }
          />

          <SummaryCard
            label="Em aberto"
            value={formatCurrency(
              openValue
            )}
            icon={
              <CreditCard className="h-5 w-5" />
            }
          />

          <SummaryCard
            label="Parcelas"
            value={`${
              contract.installments ??
              1
            }x`}
            icon={
              <CalendarDays className="h-5 w-5" />
            }
          />
        </div>

        {/* INFORMAÇÕES */}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
            <h2 className="font-semibold text-slate-900">
              Informações do contrato
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              <Info
                label="Cliente"
                value={
                  client?.name ??
                  "—"
                }
              />

              <Info
                label="Empresa"
                value={
                  company?.name ??
                  "—"
                }
              />

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Responsável
                </p>

                <div className="mt-1">
                  <ContractResponsibleEditor
                    contractId={contract.id}
                    currentUserId={
                      contract.responsible_user_id
                    }
                    currentUserName={
                      responsibleProfile?.name ??
                      null
                    }
                    canEdit={
                      canReassignResponsible
                    }
                    options={
                      responsibleOptions
                    }
                  />
                </div>
              </div>

              <Info
                label="Produto / Serviço"
                value={
                  product?.name ??
                  "—"
                }
              />

              <Info
                label="Valor"
                value={formatCurrency(
                  contractValue
                )}
              />

              <Info
                label="Início da vigência"
                value={formatDate(
                  contract.start_date
                )}
              />

              <Info
                label="Fim da vigência"
                value={
                  contract.end_date
                    ? formatDate(
                        contract.end_date
                      )
                    : "Sem término"
                }
              />

              <Info
                label="Periodicidade"
                value={getBillingLabel(
                  contract.billing_frequency
                )}
              />

              <Info
                label="Renovação automática"
                value={
                  contract.auto_renew
                    ? "Sim"
                    : "Não"
                }
              />
            </div>
          </section>

          {/* COBRANÇA */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              Condições de cobrança
            </h2>

            <div className="mt-6 space-y-5">
              <Info
                label="Forma de pagamento"
                value={
                  paymentMethod?.name ??
                  "Não informada"
                }
              />

              <Info
                label="Parcelamento"
                value={`${
                  contract.installments ??
                  1
                }x`}
              />

              <Info
                label="Primeiro vencimento"
                value={
                  contract.first_due_date
                    ? formatDate(
                        contract.first_due_date
                      )
                    : "—"
                }
              />
            </div>
          </section>
        </div>

        {/* PUBLICAÇÕES EM EDIÇÕES */}

        {canPublishInEditions && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-[#15704f]" />

                  <h2 className="font-semibold text-slate-900">
                    Publicações em edições
                  </h2>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Este contrato de anúncio pode ser publicado em uma ou mais edições do jornal.
                </p>
              </div>

              {openEditionsForPublish.length >
              0 ? (
                <details className="group relative">
                  <summary className="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]">
                    <Plus className="h-4 w-4" />
                    Publicar numa edição
                  </summary>

                  <div className="absolute right-0 z-10 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    {openEditionsForPublish.map(
                      (edition) => (
                        <Link
                          key={edition.id}
                          href={`/edicoes/${edition.id}?publicar=${contract.id}`}
                          className="block px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          {edition.name}

                          {edition.editionNumber
                            ? ` • Nº ${edition.editionNumber}`
                            : ""}
                        </Link>
                      )
                    )}
                  </div>
                </details>
              ) : (
                <span className="text-xs text-slate-400">
                  Nenhuma edição aberta disponível
                </span>
              )}
            </div>

            {editionPublications.length >
            0 ? (
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeader>
                        Edição
                      </TableHeader>

                      <TableHeader>
                        Caderno / Posição
                      </TableHeader>

                      <TableHeader>
                        Tamanho
                      </TableHeader>

                      <TableHeader>
                        Valor
                      </TableHeader>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {editionPublications.map(
                      (publication) => (
                        <tr
                          key={publication.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <Link
                              href={`/edicoes/${publication.editionId}`}
                              className="text-sm font-semibold text-[#15704f] hover:underline"
                            >
                              {publication.editionName}
                            </Link>

                            <p className="mt-0.5 text-xs text-slate-400">
                              {publication.editionStatus ===
                              "open"
                                ? "Aberta"
                                : publication.editionStatus ===
                                    "closed"
                                  ? "Fechada"
                                  : "Cancelada"}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {publication.sectionName ??
                              "Geral"}

                            {publication.positionName
                              ? ` • ${publication.positionName}`
                              : ""}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {publication.sizeDescription ||
                              "—"}
                          </td>

                          <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              publication.amount
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Este contrato ainda não foi publicado em nenhuma edição.
              </div>
            )}
          </section>
        )}

                   {/* COMISSÃO */}

        {activeCommissions.length >
          0 && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-[#15704f]" />

                  <h2 className="font-semibold text-slate-900">
                    Comissão do contrato
                  </h2>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  A comissão é liberada conforme os recebimentos deste contrato.
                </p>
              </div>

              <Link
                href="/comissoes"
                className="text-sm font-semibold text-[#15704f] hover:underline"
              >
                Ver todas as comissões
              </Link>
            </div>

            {/* BENEFICIÁRIOS */}

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Beneficiários da comissão
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Comissão principal e adicionais configuradas para este contrato.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {activeCommissions.map(
                  (
                    commission
                  ) => {
                    const profile =
                      commissionProfilesById.get(
                        commission
                          .beneficiary_user_id
                      );

                    const isResponsible =
                      commission
                        .beneficiary_user_id ===
                      contract
                        .responsible_user_id;

                    return (
                      <div
                        key={
                          commission.id
                        }
                        className="flex flex-col justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {profile?.name ??
                                "Usuário"}
                            </p>

                            {isResponsible ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Responsável
                              </span>
                            ) : (
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                                Adicional
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatPercentage(
                              Number(
                                commission.percentage ??
                                  0
                              )
                            )}{" "}
                            sobre{" "}
                            {formatCurrency(
                              Number(
                                commission
                                  .base_amount ??
                                  0
                              )
                            )}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              Number(
                                commission.amount ??
                                  0
                              )
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            comissão prevista
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* RESUMO DA COMISSÃO */}

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <CommissionValueCard
                label="Prevista"
                value={
                  commissionExpected
                }
              />

              <CommissionValueCard
                label="Liberada"
                value={
                  commissionReleased
                }
              />

              <CommissionValueCard
                label="Em pagamento"
                value={
                  commissionCommitted
                }
              />

              <CommissionValueCard
                label="Paga"
                value={
                  commissionPaid
                }
              />

              <CommissionValueCard
                label="Disponível"
                value={
                  commissionAvailable
                }
              />

              <CommissionValueCard
                label="A liberar"
                value={
                  commissionPendingRelease
                }
              />
            </div>

            {/* PAGAMENTOS GERADOS */}

            {commissionPayments.length >
              0 && (
              <div className="mt-7 overflow-hidden rounded-xl border border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Pagamentos de comissão
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Lançamentos financeiros gerados para pagamento das comissões.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <TableHeader>
                          Valor
                        </TableHeader>

                        <TableHeader>
                          Pago
                        </TableHeader>

                        <TableHeader>
                          Saldo
                        </TableHeader>

                        <TableHeader>
                          Situação
                        </TableHeader>

                        <TableHeader>
                          Financeiro
                        </TableHeader>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {commissionPayments.map(
                        (
                          payment
                        ) => {
                          const paymentAmount =
                            Number(
                              payment.amount ??
                                0
                            );

                          const appliedAmount =
                            Number(
                              payment
                                .amount_applied ??
                                0
                            );

                          const paymentOpen =
                            Math.max(
                              roundMoney(
                                paymentAmount -
                                  appliedAmount
                              ),
                              0
                            );

                          return (
                            <tr
                              key={
                                payment.id
                              }
                              className="hover:bg-slate-50"
                            >
                              <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                                {formatCurrency(
                                  paymentAmount
                                )}
                              </td>

                              <td className="px-5 py-4 text-sm font-semibold text-emerald-700">
                                {formatCurrency(
                                  appliedAmount
                                )}
                              </td>

                              <td className="px-5 py-4 text-sm text-slate-700">
                                {formatCurrency(
                                  paymentOpen
                                )}
                              </td>

                              <td className="px-5 py-4">
                                <CommissionPaymentStatusBadge
                                  status={
                                    payment.status
                                  }
                                />
                              </td>

                              <td className="px-5 py-4">
                                <Link
                                  href={`/financeiro/${payment.financial_entry_id}`}
                                  className="text-sm font-semibold text-[#15704f] hover:underline"
                                >
                                  Abrir
                                </Link>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TVs / TELÕES */}

        {linkedTvs.length >
          0 && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-[#15704f]" />

                  <h2 className="font-semibold text-slate-900">
                    TVs / Telões contratados
                  </h2>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Pontos de exibição
                  vinculados a este
                  contrato.
                </p>
              </div>

              <span className="w-fit rounded-full bg-[#15704f]/10 px-3 py-1.5 text-sm font-semibold text-[#15704f]">
                {
                  linkedTvs.length
                }{" "}
                {linkedTvs.length ===
                1
                  ? "ponto"
                  : "pontos"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {linkedTvs.map(
                (tv) => (
                  <div
                    key={
                      tv.id
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#15704f]/10 text-[#15704f]">
                        <Monitor className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {
                            tv.name
                          }
                        </p>

                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />

                          <span>
                            {tv.location ||
                              "Localização não informada"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* PARCELAS */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="font-semibold text-slate-900">
              Parcelas e financeiro
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Acompanhe vencimentos,
              pagamentos, cobrança e
              emissão de nota fiscal.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Parcela
                  </TableHeader>

                  <TableHeader>
                    Vencimento
                  </TableHeader>

                  <TableHeader>
                    Valor
                  </TableHeader>

                  <TableHeader>
                    Pago
                  </TableHeader>

                  <TableHeader>
                    Situação
                  </TableHeader>

                  <TableHeader>
                    Cobrança
                  </TableHeader>

                  <TableHeader>
                    Nota Fiscal
                  </TableHeader>

                  <TableHeader>
                    Financeiro
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {(
                  installments ??
                  []
                ).map(
                  (
                    installment
                  ) => {
                    const entry =
                      getFirst(
                        installment.financial_entry
                      );

                    return (
                      <tr
                        key={
                          installment.id
                        }
                        className="hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {
                            installment.installment_number
                          }
                          /
                          {contract.installments ??
                            installments?.length ??
                            1}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(
                            installment.due_date
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            Number(
                              installment.amount
                            )
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatCurrency(
                            Number(
                              entry?.amount_paid ??
                                0
                            )
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {entry ? (
                            <FinancialStatusBadge
                              status={
                                entry.status
                              }
                            />
                          ) : (
                            <span className="text-sm text-slate-400">
                              —
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {entry?.charge_sent ? (
                            <span className="text-sm font-medium text-emerald-700">
                              Enviada
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">
                              Não
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {entry?.invoice_issued ? (
                            <div>
                              <p className="text-sm font-medium text-emerald-700">
                                Emitida
                              </p>

                              {entry.invoice_number && (
                                <p className="mt-1 text-xs text-slate-400">
                                  Nº{" "}
                                  {
                                    entry.invoice_number
                                  }
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">
                              Não
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {entry ? (
                            <Link
                              href={`/financeiro/${entry.id}`}
                              className="text-sm font-semibold text-[#15704f] hover:underline"
                            >
                              Abrir
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-400">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}

                {!installments?.length && (
                  <tr>
                    <td
                      colSpan={
                        8
                      }
                      className="px-5 py-10 text-center text-sm text-slate-400"
                    >
                      Este contrato
                      ainda não possui
                      parcelas
                      vinculadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* OBSERVAÇÕES */}

        {contract.notes && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              Observações
            </h2>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {contract.notes}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

/*
 * =========================
 * COMPONENTES
 * =========================
 */

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {label}
        </p>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15704f]/10 text-[#15704f]">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Info({
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

      <p className="mt-1 text-sm font-medium text-slate-800">
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
    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function StatusBadge({
  status,
}: {
  status: ReturnType<typeof getContractStatus>;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONTRACT_STATUS_STYLES[status]}`}
    >
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}

function FinancialStatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    pending:
      "bg-amber-50 text-amber-700",

    overdue:
      "bg-red-50 text-red-700",

    partial:
      "bg-blue-50 text-blue-700",

    paid:
      "bg-emerald-50 text-emerald-700",

    cancelled:
      "bg-slate-100 text-slate-600",
  };

  const labels: Record<
    string,
    string
  > = {
    pending:
      "Pendente",

    overdue:
      "Atrasada",

    partial:
      "Parcial",

    paid:
      "Paga",

    cancelled:
      "Cancelada",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
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
 * =========================
 * STATUS DO CONTRATO
 * =========================
 */
function CommissionValueCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-slate-900">
        {formatCurrency(
          value
        )}
      </p>
    </div>
  );
}

function CommissionPaymentStatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    generated:
      "bg-amber-50 text-amber-700",

    partial:
      "bg-blue-50 text-blue-700",

    paid:
      "bg-emerald-50 text-emerald-700",

    cancelled:
      "bg-slate-100 text-slate-600",
  };

  const labels: Record<
    string,
    string
  > = {
    generated:
      "A pagar",

    partial:
      "Parcial",

    paid:
      "Pago",

    cancelled:
      "Cancelado",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
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
 * =========================
 * HELPERS
 * =========================
 */

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

function formatDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "pt-BR"
  ).format(
    new Date(
      `${date}T12:00:00`
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
    value
  );
}

function getBillingLabel(
  frequency:
    | string
    | null
) {
  const labels: Record<
    string,
    string
  > = {
    one_time:
      "Pagamento único",

    monthly:
      "Mensal",

    quarterly:
      "Trimestral",

    semiannual:
      "Semestral",

    annual:
      "Anual",

    custom:
      "Personalizado",
  };

  return frequency
    ? labels[
        frequency
      ] ??
        frequency
    : "—";
}