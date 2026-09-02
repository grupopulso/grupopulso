import Link from "next/link";

import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Target,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { requireEstafetaAccess } from "@/app/lib/estafeta-access";

const MONTH_LABELS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const MONTH_LABELS_FULL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type EditionSale = {
  id: string;
  total_amount: number | string | null;
  status: string;
};

type EditionRow = {
  id: string;
  name: string;
  edition_number: number | null;
  publication_date: string;
  sales_goal: number | string | null;
  status: string;
  sales: EditionSale[] | null;
};

type PageProps = {
  searchParams: Promise<{
    ano?: string;
    mes?: string;
  }>;
};

export default async function RelatorioEdicoesPage({
  searchParams,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const { ano, mes } =
    await searchParams;

  const supabase =
    await createClient();

  const realNow = new Date();

  const parsedYear = Number(ano);

  const year =
    Number.isInteger(parsedYear) &&
    parsedYear >= 2000 &&
    parsedYear <= 2100
      ? parsedYear
      : realNow.getFullYear();

  const parsedMonth = Number(mes);

  const selectedMonth =
    Number.isInteger(parsedMonth) &&
    parsedMonth >= 1 &&
    parsedMonth <= 12
      ? parsedMonth
      : null;

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  /*
   * =====================================================
   * EDIÇÕES DO ANO
   * =====================================================
   */

  const {
    data: editionsData,
    error: editionsError,
  } = await supabase
    .from("newspaper_editions")
    .select(`
      id,
      name,
      edition_number,
      publication_date,
      sales_goal,
      status,

      sales:edition_sales (
        id,
        total_amount,
        status
      )
    `)
    .eq(
      "company_id",
      access.estafetaCompany.id
    )
    .gte(
      "publication_date",
      yearStart
    )
    .lte(
      "publication_date",
      yearEnd
    )
    .order("publication_date", {
      ascending: true,
    });

  if (editionsError) {
    console.error(
      "Erro ao carregar edições do relatório:",
      editionsError
    );
  }

  const editions =
    (editionsData ??
      []) as EditionRow[];

  const editionIds = editions.map(
    (edition) => edition.id
  );

  /*
   * =====================================================
   * PUBLICIDADE VENDIDA VIA CONTRATO
   * =====================================================
   *
   * Mesmo critério de "vendido" usado em /edicoes: venda
   * avulsa confirmada + publicação ativa vinda de contrato.
   */

  const publicationsByEdition = new Map<
    string,
    number
  >();

  if (editionIds.length > 0) {
    const { data: publicationsData } =
      await supabase
        .from(
          "contract_edition_publications"
        )
        .select(`
          edition_id,
          amount,
          active
        `)
        .in(
          "edition_id",
          editionIds
        )
        .eq("active", true);

    for (const publication of publicationsData ??
      []) {
      publicationsByEdition.set(
        publication.edition_id,
        (publicationsByEdition.get(
          publication.edition_id
        ) ?? 0) +
          Number(
            publication.amount ?? 0
          )
      );
    }
  }

  /*
   * =====================================================
   * RESUMO POR EDIÇÃO
   * =====================================================
   */

  const editionSummaries = editions
    .map((edition) => {
      const confirmedSales = (
        edition.sales ?? []
      ).filter(
        (sale) =>
          sale.status === "confirmed"
      );

      const standaloneAmount =
        confirmedSales.reduce(
          (total, sale) =>
            total +
            Number(
              sale.total_amount ?? 0
            ),
          0
        );

      const contractAmount =
        publicationsByEdition.get(
          edition.id
        ) ?? 0;

      const sold = roundMoney(
        standaloneAmount +
          contractAmount
      );

      const goal = Number(
        edition.sales_goal ?? 0
      );

      const percent =
        goal > 0
          ? (sold / goal) * 100
          : null;

      const month = Number(
        (
          edition.publication_date ??
          ""
        ).slice(5, 7)
      );

      return {
        id: edition.id,
        name: edition.name,
        editionNumber:
          edition.edition_number,
        date: edition.publication_date,
        status: edition.status,
        goal,
        sold,
        percent,
        month,
      };
    })
    .filter(
      (edition) =>
        edition.status !== "cancelled"
    );

  /*
   * =====================================================
   * AGRUPAMENTO MENSAL
   * =====================================================
   */

  const monthly = Array.from(
    { length: 12 },
    (_, index) => {
      const monthNumber = index + 1;

      const monthEditions =
        editionSummaries.filter(
          (edition) =>
            edition.month ===
            monthNumber
        );

      const goal = roundMoney(
        monthEditions.reduce(
          (total, edition) =>
            total + edition.goal,
          0
        )
      );

      const sold = roundMoney(
        monthEditions.reduce(
          (total, edition) =>
            total + edition.sold,
          0
        )
      );

      return {
        monthNumber,
        label:
          MONTH_LABELS_SHORT[index],
        goal,
        sold,
        editionsCount:
          monthEditions.length,
      };
    }
  );

  const annualGoal = roundMoney(
    monthly.reduce(
      (total, month) =>
        total + month.goal,
      0
    )
  );

  const annualSold = roundMoney(
    monthly.reduce(
      (total, month) =>
        total + month.sold,
      0
    )
  );

  const annualPercent =
    annualGoal > 0
      ? (annualSold / annualGoal) *
        100
      : null;

  const maxScale =
    Math.max(
      ...monthly.map((month) =>
        Math.max(
          month.goal,
          month.sold
        )
      ),
      1
    ) * 1.15;

  /*
   * =====================================================
   * MÊS SELECIONADO (drill-down)
   * =====================================================
   */

  const selectedMonthSummary =
    selectedMonth !== null
      ? monthly[selectedMonth - 1]
      : null;

  const selectedMonthPercent =
    selectedMonthSummary &&
    selectedMonthSummary.goal > 0
      ? (selectedMonthSummary.sold /
          selectedMonthSummary.goal) *
        100
      : null;

  const visibleEditionSummaries =
    selectedMonth !== null
      ? editionSummaries.filter(
          (edition) =>
            edition.month ===
            selectedMonth
        )
      : editionSummaries;

  const editionMaxScale =
    visibleEditionSummaries.length >
    0
      ? Math.max(
          ...visibleEditionSummaries.map(
            (edition) =>
              Math.max(
                edition.goal,
                edition.sold
              )
          ),
          1
        ) * 1.15
      : 1;

  function monthHref(
    monthNumber: number | null
  ) {
    const query =
      new URLSearchParams();

    query.set("ano", String(year));

    if (monthNumber !== null) {
      query.set(
        "mes",
        String(monthNumber)
      );
    }

    return `/relatorios/edicoes?${query.toString()}`;
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-[1500px]">
        <Link
          href="/relatorios"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Relatórios
        </Link>

        {/* CABEÇALHO */}

        <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
              <Newspaper className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Edições e Publicidade
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Meta comercial x publicidade vendida, por mês e no ano.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/relatorios/edicoes?ano=${year - 1}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#15704f]/40 hover:text-[#15704f]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            <div className="min-w-[100px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-center">
              <p className="text-sm font-semibold text-slate-900">
                {year}
              </p>
            </div>

            <Link
              href={`/relatorios/edicoes?ano=${year + 1}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#15704f]/40 hover:text-[#15704f]"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* RESUMO — ANO OU MÊS SELECIONADO */}

        {selectedMonth !== null &&
        selectedMonthSummary ? (
          <>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Detalhe do mês
                </p>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {
                    MONTH_LABELS_FULL[
                      selectedMonth -
                        1
                    ]
                  }{" "}
                  de {year}
                </h2>
              </div>

              <Link
                href={monthHref(
                  null
                )}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#15704f] hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Ver o ano todo
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <MetricCard
                icon={Target}
                label={`Meta de ${selectedMonthSummary.label}`}
                value={formatCurrency(
                  selectedMonthSummary.goal
                )}
                description="Soma das metas das edições do mês"
              />

              <MetricCard
                icon={TrendingUp}
                label={`Vendido em ${selectedMonthSummary.label}`}
                value={formatCurrency(
                  selectedMonthSummary.sold
                )}
                description="Publicidade confirmada no mês"
                tone={
                  selectedMonthPercent ===
                  null
                    ? "default"
                    : selectedMonthPercent >=
                        100
                      ? "green"
                      : "amber"
                }
              />

              <MetricCard
                icon={BarChart3}
                label="Atingimento da meta"
                value={
                  selectedMonthPercent !==
                  null
                    ? formatPercentage(
                        selectedMonthPercent
                      )
                    : "—"
                }
                description={
                  selectedMonthSummary.goal >
                  0
                    ? selectedMonthSummary.sold >=
                      selectedMonthSummary.goal
                      ? "Meta do mês atingida"
                      : "Abaixo da meta do mês"
                    : "Nenhuma meta cadastrada no mês"
                }
                tone={
                  selectedMonthSummary.goal ===
                  0
                    ? "default"
                    : selectedMonthSummary.sold >=
                        selectedMonthSummary.goal
                      ? "green"
                      : "amber"
                }
              />
            </div>
          </>
        ) : (
          <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <MetricCard
              icon={Target}
              label={`Meta ${year}`}
              value={formatCurrency(
                annualGoal
              )}
              description="Soma das metas das edições do ano"
            />

            <MetricCard
              icon={TrendingUp}
              label={`Vendido ${year}`}
              value={formatCurrency(
                annualSold
              )}
              description="Publicidade confirmada no ano"
              tone={
                annualPercent ===
                null
                  ? "default"
                  : annualPercent >=
                      100
                    ? "green"
                    : "amber"
              }
            />

            <MetricCard
              icon={BarChart3}
              label="Atingimento da meta"
              value={
                annualPercent !==
                null
                  ? formatPercentage(
                      annualPercent
                    )
                  : "—"
              }
              description={
                annualGoal > 0
                  ? annualSold >=
                    annualGoal
                    ? "Meta anual atingida"
                    : "Abaixo da meta anual"
                  : "Nenhuma meta cadastrada no ano"
              }
              tone={
                annualGoal === 0
                  ? "default"
                  : annualSold >=
                      annualGoal
                    ? "green"
                    : "amber"
              }
            />
          </div>
        )}

        {/* GRÁFICO MENSAL */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">
                Meta x Vendido por mês
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Publicidade vendida em cada edição do mês, comparada à meta comercial do período. Clique em um mês para ver o detalhe.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <LegendItem
                swatchClass="bg-slate-300"
                label="Meta"
              />

              <LegendItem
                swatchClass="bg-[#15704f]"
                label="Vendido (meta atingida)"
              />

              <LegendItem
                swatchClass="bg-amber-500"
                label="Vendido (abaixo da meta)"
              />
            </div>
          </div>

          <div className="mt-8 flex items-end gap-2 overflow-x-auto pb-2 sm:gap-4">
            {monthly.map((month) => {
              const goalHeight =
                maxScale > 0
                  ? (month.goal /
                      maxScale) *
                    100
                  : 0;

              const soldHeight =
                maxScale > 0
                  ? (month.sold /
                      maxScale) *
                    100
                  : 0;

              const soldColor =
                month.goal <= 0
                  ? "bg-slate-300"
                  : month.sold >=
                      month.goal
                    ? "bg-[#15704f]"
                    : "bg-amber-500";

              const percent =
                month.goal > 0
                  ? (month.sold /
                      month.goal) *
                    100
                  : null;

              const isSelected =
                selectedMonth ===
                month.monthNumber;

              return (
                <Link
                  key={
                    month.monthNumber
                  }
                  href={monthHref(
                    isSelected
                      ? null
                      : month.monthNumber
                  )}
                  className={`flex min-w-[48px] flex-1 flex-col items-center gap-2 rounded-lg py-1 transition ${
                    isSelected
                      ? "bg-[#15704f]/5 ring-1 ring-[#15704f]/30"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="group relative flex h-48 items-end gap-1">
                    {/* TOOLTIP */}

                    <div className="pointer-events-none absolute -top-2 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      <p className="font-semibold">
                        {month.label}{" "}
                        {year}
                      </p>

                      <p className="mt-1 text-slate-300">
                        Meta:{" "}
                        <span className="font-medium text-white">
                          {formatCurrency(
                            month.goal
                          )}
                        </span>
                      </p>

                      <p className="text-slate-300">
                        Vendido:{" "}
                        <span className="font-medium text-white">
                          {formatCurrency(
                            month.sold
                          )}
                        </span>
                      </p>

                      {percent !==
                        null && (
                        <p
                          className={`mt-1 font-semibold ${
                            percent >=
                            100
                              ? "text-emerald-300"
                              : "text-amber-300"
                          }`}
                        >
                          {formatPercentage(
                            percent
                          )}{" "}
                          da meta
                        </p>
                      )}

                      <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-slate-900" />
                    </div>

                    <div
                      className="w-3.5 rounded-t bg-slate-200"
                      style={{
                        height: `${goalHeight}%`,
                      }}
                    />

                    <div
                      className={`w-3.5 rounded-t transition-all ${soldColor}`}
                      style={{
                        height: `${soldHeight}%`,
                      }}
                    />
                  </div>

                  <span
                    className={`text-xs font-medium ${
                      isSelected
                        ? "text-[#15704f]"
                        : "text-slate-600"
                    }`}
                  >
                    {month.label}
                  </span>

                  {percent !== null ? (
                    <span
                      className={`text-[10px] font-semibold ${
                        percent >= 100
                          ? "text-[#15704f]"
                          : "text-amber-600"
                      }`}
                    >
                      {formatPercentage(
                        percent
                      )}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300">
                      —
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* GRÁFICO POR EDIÇÃO (só com um mês selecionado) */}

        {selectedMonth !== null && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Meta x Vendido por edição —{" "}
                  {
                    MONTH_LABELS_FULL[
                      selectedMonth -
                        1
                    ]
                  }
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Cada edição publicada no mês, com a mesma comparação de meta x vendido. Clique para abrir a edição.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <LegendItem
                  swatchClass="bg-slate-300"
                  label="Meta"
                />

                <LegendItem
                  swatchClass="bg-[#15704f]"
                  label="Vendido (meta atingida)"
                />

                <LegendItem
                  swatchClass="bg-amber-500"
                  label="Vendido (abaixo da meta)"
                />
              </div>
            </div>

            {visibleEditionSummaries.length >
            0 ? (
              <div className="mt-8 flex items-end gap-2 overflow-x-auto pb-2 sm:gap-4">
                {visibleEditionSummaries.map(
                  (edition) => {
                    const goalHeight =
                      editionMaxScale >
                      0
                        ? (edition.goal /
                            editionMaxScale) *
                          100
                        : 0;

                    const soldHeight =
                      editionMaxScale >
                      0
                        ? (edition.sold /
                            editionMaxScale) *
                          100
                        : 0;

                    const soldColor =
                      edition.goal <=
                      0
                        ? "bg-slate-300"
                        : edition.sold >=
                            edition.goal
                          ? "bg-[#15704f]"
                          : "bg-amber-500";

                    const editionLabel =
                      edition.editionNumber
                        ? `Nº ${edition.editionNumber}`
                        : edition.name.slice(
                            0,
                            10
                          );

                    return (
                      <Link
                        key={
                          edition.id
                        }
                        href={`/edicoes/${edition.id}`}
                        className="flex min-w-[56px] flex-1 flex-col items-center gap-2 rounded-lg py-1 transition hover:bg-slate-50"
                      >
                        <div className="group relative flex h-48 items-end gap-1">
                          {/* TOOLTIP */}

                          <div className="pointer-events-none absolute -top-2 left-1/2 z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-full whitespace-normal rounded-lg bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                            <p className="font-semibold">
                              {
                                edition.name
                              }
                            </p>

                            <p className="mt-1 text-slate-300">
                              {formatDate(
                                edition.date
                              )}
                            </p>

                            <p className="mt-1 text-slate-300">
                              Meta:{" "}
                              <span className="font-medium text-white">
                                {formatCurrency(
                                  edition.goal
                                )}
                              </span>
                            </p>

                            <p className="text-slate-300">
                              Vendido:{" "}
                              <span className="font-medium text-white">
                                {formatCurrency(
                                  edition.sold
                                )}
                              </span>
                            </p>

                            {edition.percent !==
                              null && (
                              <p
                                className={`mt-1 font-semibold ${
                                  edition.percent >=
                                  100
                                    ? "text-emerald-300"
                                    : "text-amber-300"
                                }`}
                              >
                                {formatPercentage(
                                  edition.percent
                                )}{" "}
                                da meta
                              </p>
                            )}

                            <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-slate-900" />
                          </div>

                          <div
                            className="w-3.5 rounded-t bg-slate-200"
                            style={{
                              height: `${goalHeight}%`,
                            }}
                          />

                          <div
                            className={`w-3.5 rounded-t transition-all ${soldColor}`}
                            style={{
                              height: `${soldHeight}%`,
                            }}
                          />
                        </div>

                        <span className="max-w-[80px] truncate text-xs font-medium text-slate-600">
                          {
                            editionLabel
                          }
                        </span>

                        {edition.percent !==
                        null ? (
                          <span
                            className={`text-[10px] font-semibold ${
                              edition.percent >=
                              100
                                ? "text-[#15704f]"
                                : "text-amber-600"
                            }`}
                          >
                            {formatPercentage(
                              edition.percent
                            )}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">
                            —
                          </span>
                        )}
                      </Link>
                    );
                  }
                )}
              </div>
            ) : (
              <p className="mt-8 text-sm text-slate-400">
                Nenhuma edição publicada em{" "}
                {
                  MONTH_LABELS_FULL[
                    selectedMonth - 1
                  ]
                }{" "}
                de {year}.
              </p>
            )}
          </div>
        )}

        {/* TABELA DE EDIÇÕES */}

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="font-semibold text-slate-900">
              {selectedMonth !== null
                ? `Edições de ${MONTH_LABELS_FULL[selectedMonth - 1]} de ${year}`
                : `Edições de ${year}`}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Detalhe por edição — clique para abrir.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Edição
                  </TableHeader>

                  <TableHeader>
                    Data
                  </TableHeader>

                  <TableHeader>
                    Meta
                  </TableHeader>

                  <TableHeader>
                    Vendido
                  </TableHeader>

                  <TableHeader>
                    Atingimento
                  </TableHeader>

                  <TableHeader>
                    Situação
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleEditionSummaries.map(
                  (edition) => (
                    <tr
                      key={edition.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/edicoes/${edition.id}`}
                          className="text-sm font-semibold text-slate-900 hover:text-[#15704f]"
                        >
                          {edition.name}
                        </Link>

                        {edition.editionNumber && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            Nº{" "}
                            {
                              edition.editionNumber
                            }
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(
                          edition.date
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {formatCurrency(
                          edition.goal
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          edition.sold
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {edition.percent !==
                        null
                          ? formatPercentage(
                              edition.percent
                            )
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        <GoalBadge
                          goal={
                            edition.goal
                          }
                          sold={
                            edition.sold
                          }
                        />
                      </td>
                    </tr>
                  )
                )}

                {!visibleEditionSummaries.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-slate-400"
                    >
                      {selectedMonth !==
                      null
                        ? `Nenhuma edição cadastrada em ${MONTH_LABELS_FULL[selectedMonth - 1]} de ${year}.`
                        : `Nenhuma edição cadastrada em ${year}.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  description: string;
  tone?:
    | "default"
    | "green"
    | "amber";
}) {
  const iconClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "amber"
        ? "bg-amber-50 text-amber-600"
        : "bg-[#15704f]/10 text-[#15704f]";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function LegendItem({
  swatchClass,
  label,
}: {
  swatchClass: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`h-2.5 w-2.5 rounded-full ${swatchClass}`}
      />
      {label}
    </span>
  );
}

function GoalBadge({
  goal,
  sold,
}: {
  goal: number;
  sold: number;
}) {
  if (goal <= 0) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
        Sem meta
      </span>
    );
  }

  if (sold >= goal) {
    return (
      <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Meta atingida
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      Abaixo da meta
    </span>
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

function roundMoney(value: number) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
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
  ).format(value);
}

function formatPercentage(
  value: number
) {
  return (
    new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 0,
    }).format(value) + "%"
  );
}

function formatDate(
  date: string | null
) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(
    `${date}T12:00:00`
  );

  if (
    Number.isNaN(parsed.getTime())
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-BR"
  ).format(parsed);
}
