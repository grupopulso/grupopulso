import Link from "next/link";

import {
  ArrowLeft,
  BadgePercent,
  CalendarDays,
  FileText,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

import {
  notFound,
} from "next/navigation";

import SaleActions from "./sale-actions";

import {
  createAdminClient,
} from "@/app/lib/supabase/admin";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

type PageProps = {
  params: Promise<{
    id: string;
    saleId: string;
  }>;
};

type SellerProfile = {
  id: string;
  name: string | null;
};

type FinancialEntry = {
  id: string;
  due_date: string;
  amount: number | string;
  amount_paid: number | string;
  interest: number | string;
  fine: number | string;
  discount: number | string;
  status: string;
};

export default async function SaleDetailPage({
  params,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const {
    id: editionId,
    saleId,
  } = await params;

  /*
   * Service role: acesso já validado por
   * `requireEstafetaAccess()`; consultas filtradas por
   * `access.estafetaCompany.id`. A tela mostra o financeiro
   * da venda (RLS por módulo financial).
   */
  const supabase =
    createAdminClient();

  /*
   * =========================
   * EDIÇÃO
   * =========================
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
        status
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
    notFound();
  }

  /*
   * =========================
   * VENDA
   * =========================
   */

  const {
    data: sale,
    error: saleError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .select(`
        id,
        company_id,
        edition_id,
        client_id,
        seller_user_id,
        status,
        total_amount,
        commission_percentage,
        commission_amount,
        payment_method_id,
        installments,
        first_due_date,
        notes,
        created_at,

        client:clients (
          id,
          name
        ),

        payment_method:financial_payment_methods (
          id,
          name,
          code
        ),

        items:edition_sale_items (
          id,
          section_id,
          description,
          placement,
          print_type,
          quantity,
          unit_price,
          total_amount,
          notes,

          section:edition_sections (
            id,
            name
          )
        )
      `)
      .eq(
        "id",
        saleId
      )
      .eq(
        "edition_id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (
    saleError ||
    !sale
  ) {
    console.error(
      "Erro ao carregar venda:",
      saleError
    );

    notFound();
  }

  /*
   * =========================
   * VENDEDOR
   * =========================
   */

  let seller:
    SellerProfile | null =
    null;

  if (
    sale.seller_user_id
  ) {
    const {
      data:
        sellerProfile,
      error:
        sellerError,
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
          sale.seller_user_id
        )
        .maybeSingle();

    if (
      sellerError
    ) {
      console.error(
        "Erro ao carregar vendedor:",
        sellerError
      );
    }

    seller =
      sellerProfile ??
      null;
  }

  /*
   * =========================
   * COMISSÕES
   * =========================
   */

  const {
    data: commissions,
    error:
      commissionsError,
  } =
    await supabase
      .from(
        "sale_commissions"
      )
      .select(`
        id,
        beneficiary_user_id,
        source_seller_user_id,
        commission_type,
        percentage,
        base_amount,
        amount,
        amount_released,
        status
      `)
      .eq(
        "sale_id",
        sale.id
      )
      .order(
        "commission_type"
      );

  if (
    commissionsError
  ) {
    console.error(
      "Erro ao carregar comissões:",
      commissionsError
    );
  }

  /*
   * =========================
   * PARCELAS DA VENDA
   * =========================
   */

  const {
    data: saleInstallments,
    error:
      saleInstallmentsError,
  } =
    await supabase
      .from(
        "edition_sale_installments"
      )
      .select(`
        id,
        installment_number,
        due_date,
        amount,
        financial_entry_id
      `)
      .eq(
        "sale_id",
        sale.id
      )
      .order(
        "installment_number"
      );

  if (
    saleInstallmentsError
  ) {
    console.error(
      "Erro ao carregar parcelas da venda:",
      saleInstallmentsError
    );
  }

  /*
   * =========================
   * FINANCEIRO DAS PARCELAS
   * =========================
   */

  const financialEntryIds =
    (
      saleInstallments ??
      []
    ).map(
      (
        installment
      ) =>
        installment
          .financial_entry_id
    );

  let financialEntries:
    FinancialEntry[] =
    [];

  if (
    financialEntryIds.length >
    0
  ) {
    const {
      data:
        financialEntriesData,
      error:
        financialEntriesError,
    } =
      await supabase
        .from(
          "financial_entries"
        )
        .select(`
          id,
          due_date,
          amount,
          amount_paid,
          interest,
          fine,
          discount,
          status
        `)
        .in(
          "id",
          financialEntryIds
        );

    if (
      financialEntriesError
    ) {
      console.error(
        "Erro ao carregar financeiro da venda:",
        financialEntriesError
      );
    }

    financialEntries =
      (
        financialEntriesData ??
        []
      ) as FinancialEntry[];
  }

  const financialEntriesById =
    new Map(
      financialEntries.map(
        (
          entry
        ) => [
          entry.id,
          entry,
        ]
      )
    );

  /*
   * =========================
   * BENEFICIÁRIOS
   * =========================
   */

  const commissionUserIds =
    [
      ...new Set(
        (
          commissions ??
          []
        ).flatMap(
          (
            commission
          ) => [
            commission
              .beneficiary_user_id,

            commission
              .source_seller_user_id,
          ]
        )
      ),
    ];

  let commissionProfiles:
    SellerProfile[] =
    [];

  if (
    commissionUserIds.length >
    0
  ) {
    const {
      data: profiles,
      error:
        profilesError,
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
      profilesError
    ) {
      console.error(
        "Erro ao carregar beneficiários:",
        profilesError
      );
    }

    commissionProfiles =
      profiles ??
      [];
  }

  const profilesById =
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

  /*
   * =========================
   * DADOS AUXILIARES
   * =========================
   */

  const client =
    getFirst(
      sale.client
    );

  const paymentMethod =
    getFirst(
      sale.payment_method
    );

  const items =
    sale.items ??
    [];

  const saleTotal =
    Number(
      sale.total_amount
    );

  /*
   * =========================
   * RECEBIDO
   * =========================
   *
   * Para progresso da venda,
   * consideramos somente o
   * principal da parcela.
   *
   * Juros/multa não aumentam
   * o percentual recebido da venda.
   */

  const totalReceived =
    roundMoney(
      (
        saleInstallments ??
        []
      ).reduce(
        (
          total,
          installment
        ) => {
          const entry =
            financialEntriesById.get(
              installment
                .financial_entry_id
            );

          if (
            !entry
          ) {
            return total;
          }

          const installmentAmount =
            Number(
              installment.amount
            );

          const amountPaid =
            Number(
              entry.amount_paid ??
                0
            );

          return (
            total +
            Math.max(
              0,
              Math.min(
                amountPaid,
                installmentAmount
              )
            )
          );
        },
        0
      )
    );

    const hasReceipts =
  totalReceived > 0;

  const totalOpen =
    Math.max(
      roundMoney(
        saleTotal -
          totalReceived
      ),
      0
    );

  const receivedPercentage =
    saleTotal >
    0
      ? Math.min(
          (
            totalReceived /
            saleTotal
          ) *
            100,
          100
        )
      : 0;

  /*
   * =========================
   * OUTRAS EDIÇÕES ABERTAS
   * =========================
   *
   * Para o caso de a venda ter sido cadastrada na
   * edição errada. Só faz sentido se esta edição
   * também estiver aberta.
   */

  let openEditionsForMove: {
    id: string;
    name: string;
  }[] = [];

  if (
    edition.status === "open" &&
    sale.status !== "cancelled"
  ) {
    const { data: otherEditions } =
      await supabase
        .from("newspaper_editions")
        .select("id, name")
        .eq(
          "company_id",
          access.estafetaCompany.id
        )
        .eq("status", "open")
        .neq("id", edition.id)
        .order("publication_date", {
          ascending: true,
        });

    openEditionsForMove =
      otherEditions ?? [];
  }

  /*
   * =========================
   * COMISSÕES TOTAIS
   * =========================
   */

  const totalCommissionExpected =
    roundMoney(
      (
        commissions ??
        []
      ).reduce(
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

  const totalCommissionReleased =
    roundMoney(
      (
        commissions ??
        []
      ).reduce(
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

  const totalCommissionOpen =
    Math.max(
      roundMoney(
        totalCommissionExpected -
          totalCommissionReleased
      ),
      0
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-6xl">

        {/* VOLTAR */}

        <Link
          href={`/edicoes/${edition.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Voltar para edição
        </Link>

        {/* CABEÇALHO */}

       <div className="mt-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
  {/* LADO ESQUERDO */}

  <div className="flex items-center gap-3">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
      <ShoppingCart className="h-5 w-5" />
    </div>

    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">
          Venda de publicidade
        </h1>

        <SaleStatusBadge
          status={
            sale.status
          }
        />
      </div>

      <p className="mt-1 text-sm text-slate-500">
        {
          edition.name
        }

        {edition.edition_number
          ? ` • Edição nº ${edition.edition_number}`
          : ""}
      </p>
    </div>
  </div>

  {/* LADO DIREITO */}

  <SaleActions
    editionId={
      edition.id
    }
    saleId={
      sale.id
    }
    status={
      sale.status
    }
    hasReceipts={
      hasReceipts
    }
    editionOpen={
      edition.status ===
      "open"
    }
    openEditions={
      openEditionsForMove
    }
  />
</div>

        {/* RESUMO */}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Cliente"
            value={
              client?.name ??
              "—"
            }
          />

          <SummaryCard
            label="Vendedor"
            value={
              seller?.name ??
              "—"
            }
          />

          <SummaryCard
            label="Total da venda"
            value={formatCurrency(
              saleTotal
            )}
          />

          <SummaryCard
            label="Recebido"
            value={formatCurrency(
              totalReceived
            )}
          />
        </div>

        {/* DADOS */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#15704f]" />

            <h2 className="font-semibold text-slate-900">
              Informações da venda
            </h2>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Info
              label="Data do registro"
              value={formatDateTime(
                sale.created_at
              )}
            />

            <Info
              label="Quantidade de anúncios"
              value={String(
                items.length
              )}
            />

            <Info
              label="Forma de pagamento"
              value={
                paymentMethod?.name ??
                "—"
              }
            />

            <Info
              label="Parcelas"
              value={`${Number(
                sale.installments ??
                  saleInstallments?.length ??
                  1
              )}x`}
            />

            {sale.first_due_date && (
              <Info
                label="Primeiro vencimento"
                value={formatDate(
                  sale.first_due_date
                )}
              />
            )}

            {sale.notes && (
              <div className="md:col-span-2 xl:col-span-3">
                <Info
                  label="Observações"
                  value={
                    sale.notes
                  }
                />
              </div>
            )}
          </div>
        </section>

        {/* FINANCEIRO */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-[#15704f]" />

              <h2 className="font-semibold text-slate-900">
                Pagamento
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Acompanhe os recebimentos gerados por esta venda.
            </p>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3">
            <SummaryCard
              label="Total da venda"
              value={formatCurrency(
                saleTotal
              )}
            />

            <SummaryCard
              label="Recebido"
              value={formatCurrency(
                totalReceived
              )}
            />

            <SummaryCard
              label="A receber"
              value={formatCurrency(
                totalOpen
              )}
            />
          </div>

          {/* PROGRESSO */}

          <div className="px-6 pb-6">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Progresso do recebimento
              </span>

              <span className="font-semibold text-slate-700">
                {formatPercentage(
                  receivedPercentage
                )}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#15704f] transition-all"
                style={{
                  width:
                    `${Math.max(
                      0,
                      Math.min(
                        receivedPercentage,
                        100
                      )
                    )}%`,
                }}
              />
            </div>
          </div>

          {/* PARCELAS */}

          {saleInstallments
            ?.length ? (
            <div className="overflow-x-auto border-t border-slate-100">
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
                      Recebido
                    </TableHeader>

                    <TableHeader>
                      Saldo
                    </TableHeader>

                    <TableHeader>
                      Status
                    </TableHeader>

                    <TableHeader>
                      Financeiro
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {saleInstallments.map(
                    (
                      installment
                    ) => {
                      const entry =
                        financialEntriesById.get(
                          installment
                            .financial_entry_id
                        );

                      const amount =
                        Number(
                          installment.amount
                        );

                      const amountPaid =
                        Math.max(
                          0,
                          Math.min(
                            Number(
                              entry
                                ?.amount_paid ??
                                0
                            ),
                            amount
                          )
                        );

                      const open =
                        Math.max(
                          roundMoney(
                            amount -
                              amountPaid
                          ),
                          0
                        );

                      return (
                        <tr
                          key={
                            installment.id
                          }
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-slate-900">
                              {installment.installment_number}/
                              {
                                saleInstallments.length
                              }
                            </span>
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {formatDate(
                              installment.due_date
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm font-medium text-slate-900">
                            {formatCurrency(
                              amount
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold text-emerald-700">
                            {formatCurrency(
                              amountPaid
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {formatCurrency(
                              open
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <FinancialStatusBadge
                              status={
                                entry?.status ??
                                "pending"
                              }
                            />
                          </td>

                          <td className="px-6 py-4">
                            <Link
                              href={`/financeiro/${installment.financial_entry_id}`}
                              className="text-sm font-semibold text-[#15704f] hover:underline"
                            >
                              Ver no financeiro
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
            <div className="border-t border-slate-100 px-6 py-10 text-center">
              <p className="text-sm text-slate-400">
                Nenhuma parcela financeira vinculada a esta venda.
              </p>
            </div>
          )}
        </section>

        {/* ANÚNCIOS */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#15704f]" />

              <h2 className="font-semibold text-slate-900">
                Anúncios
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Itens comercializados nesta venda.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map(
              (
                item,
                index
              ) => {
                const section =
                  getFirst(
                    item.section
                  );

                return (
                  <div
                    key={
                      item.id
                    }
                    className="p-6"
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Anúncio{" "}
                          {
                            index +
                            1
                          }
                        </p>

                        <h3 className="mt-1 text-base font-semibold text-slate-900">
                          {
                            item.description
                          }
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {section && (
                            <Tag>
                              {
                                section.name
                              }
                            </Tag>
                          )}

                          {item.placement && (
                            <Tag>
                              {
                                item.placement
                              }
                            </Tag>
                          )}

                          {item.print_type && (
                            <Tag>
                              {getPrintTypeLabel(
                                item.print_type
                              )}
                            </Tag>
                          )}
                        </div>

                        {item.notes && (
                          <p className="mt-4 text-sm leading-6 text-slate-500">
                            {
                              item.notes
                            }
                          </p>
                        )}
                      </div>

                      <div className="min-w-[200px] rounded-xl bg-slate-50 p-4">
                        <Info
                          label="Quantidade"
                          value={String(
                            item.quantity
                          )}
                        />

                        <div className="mt-3">
                          <Info
                            label="Valor unitário"
                            value={formatCurrency(
                              Number(
                                item.unit_price
                              )
                            )}
                          />
                        </div>

                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <Info
                            label="Total"
                            value={formatCurrency(
                              Number(
                                item.total_amount
                              )
                            )}
                            strong
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>

        {/* COMISSÕES */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5 text-[#15704f]" />

              <h2 className="font-semibold text-slate-900">
                Comissões
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              A comissão só é liberada conforme o recebimento real da venda.
            </p>
          </div>

          {/* TOTALIZADORES */}

          <div className="grid gap-4 border-b border-slate-100 p-6 md:grid-cols-3">
            <SummaryCard
              label="Comissão prevista"
              value={formatCurrency(
                totalCommissionExpected
              )}
            />

            <SummaryCard
              label="Já liberada"
              value={formatCurrency(
                totalCommissionReleased
              )}
            />

            <SummaryCard
              label="A liberar"
              value={formatCurrency(
                totalCommissionOpen
              )}
            />
          </div>

          {commissions?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>
                      Beneficiário
                    </TableHeader>

                    <TableHeader>
                      Tipo
                    </TableHeader>

                    <TableHeader>
                      Percentual
                    </TableHeader>

                    <TableHeader>
                      Base
                    </TableHeader>

                    <TableHeader>
                      Prevista
                    </TableHeader>

                    <TableHeader>
                      Liberada
                    </TableHeader>

                    <TableHeader>
                      A liberar
                    </TableHeader>

                    <TableHeader>
                      Status
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {commissions.map(
                    (
                      commission
                    ) => {
                      const beneficiary =
                        profilesById.get(
                          commission
                            .beneficiary_user_id
                        );

                      const expected =
                        Number(
                          commission.amount ??
                            0
                        );

                      const released =
                        Number(
                          commission
                            .amount_released ??
                            0
                        );

                      const open =
                        Math.max(
                          roundMoney(
                            expected -
                              released
                          ),
                          0
                        );

                      return (
                        <tr
                          key={
                            commission.id
                          }
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-900">
                              {beneficiary?.name ??
                                "Usuário"}
                            </p>
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {commission.commission_type ===
                            "seller"
                              ? "Venda própria"
                              : "Comissão adicional"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {formatPercentage(
                              Number(
                                commission.percentage
                              )
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {formatCurrency(
                              Number(
                                commission.base_amount
                              )
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              expected
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold text-emerald-700">
                            {formatCurrency(
                              released
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {formatCurrency(
                              open
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <CommissionStatusBadge
                              status={
                                commission.status
                              }
                            />
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-slate-400">
              Nenhuma comissão gerada para esta venda.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Info({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 ${
          strong
            ? "text-base font-semibold text-slate-900"
            : "text-sm text-slate-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Tag({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      {children}
    </span>
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
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] ??
        status}
    </span>
  );
}

function FinancialStatusBadge({
  status,
}: {
  status: string;
}) {
  const labels: Record<
    string,
    string
  > = {
    pending:
      "Pendente",

    overdue:
      "Vencida",

    partial:
      "Parcial",

    paid:
      "Recebida",

    cancelled:
      "Cancelada",
  };

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
      "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] ??
        status}
    </span>
  );
}

function CommissionStatusBadge({
  status,
}: {
  status: string;
}) {
  const labels: Record<
    string,
    string
  > = {
    pending:
      "Pendente",

    generated:
      "Liberada parcialmente",

    paid:
      "Liberada",

    cancelled:
      "Cancelada",
  };

  const styles: Record<
    string,
    string
  > = {
    pending:
      "bg-amber-50 text-amber-700",

    generated:
      "bg-blue-50 text-blue-700",

    paid:
      "bg-emerald-50 text-emerald-700",

    cancelled:
      "bg-red-50 text-red-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] ??
        status}
    </span>
  );
}

function getPrintTypeLabel(
  value: string
) {
  const labels: Record<
    string,
    string
  > = {
    color:
      "Interno colorido",

    black_white:
      "Interno preto e branco",

    other:
      "Outro",
  };

  return (
    labels[value] ??
    value
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

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle:
        "short",

      timeStyle:
        "short",
    }
  ).format(
    new Date(
      value
    )
  );
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