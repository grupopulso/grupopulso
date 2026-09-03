import Link from "next/link";

import {
  ArrowLeft,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  Target,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";
import {
  competenceQueryRangeForYear,
  getEntryCompetenceMonth,
} from "@/app/lib/competence-date";

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

type Company = {
  id: string;
  name: string;
  color: string | null;
};

type PageProps = {
  searchParams: Promise<{
    ano?: string;
    mes?: string;
  }>;
};

export default async function RelatorioMetasPage({
  searchParams,
}: PageProps) {
  const access =
    await requireModulePermission(
      "reports",
      "view"
    );

  const { ano, mes } =
    await searchParams;

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

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

  /*
   * =====================================================
   * EMPRESAS VISÍVEIS
   * =====================================================
   */

  const allowedCompanyIds =
    access.profile.role === "admin"
      ? null
      : access.companyIds;

  let companiesQuery = supabase
    .from("companies")
    .select(`
      id,
      name,
      color
    `)
    .eq("active", true);

  if (selectedCompanyId) {
    companiesQuery =
      companiesQuery.eq(
        "id",
        selectedCompanyId
      );
  } else if (allowedCompanyIds) {
    companiesQuery =
      companiesQuery.in(
        "id",
        allowedCompanyIds.length
          ? allowedCompanyIds
          : [
              "00000000-0000-0000-0000-000000000000",
            ]
      );
  }

  const { data: companiesData } =
    await companiesQuery.order(
      "name"
    );

  const companies = (companiesData ??
    []) as Company[];

  const companyIds = companies.map(
    (company) => company.id
  );

  /*
   * =====================================================
   * METAS DO ANO (por empresa/mês)
   * =====================================================
   */

  const goalByCompanyMonth = new Map<
    string,
    number
  >();

  if (companyIds.length > 0) {
    const { data: goalsData } =
      await supabase
        .from("company_goals")
        .select(`
          company_id,
          month,
          target_amount
        `)
        .eq("year", year)
        .in(
          "company_id",
          companyIds
        );

    for (const row of goalsData ??
      []) {
      const key = `${row.company_id}-${row.month}`;

      goalByCompanyMonth.set(
        key,
        (goalByCompanyMonth.get(
          key
        ) ?? 0) +
          Number(
            row.target_amount ?? 0
          )
      );
    }
  }

  /*
   * =====================================================
   * FATURADO DO ANO (receita por empresa/mês)
   * =====================================================
   *
   * Faturamento conta pela COMPETÊNCIA, e a regra depende do
   * tipo de venda:
   *
   * - Serviço recorrente (contrato com billing_frequency
   *   diferente de "one_time"): cada parcela conta no mês
   *   ANTERIOR ao vencimento dela (um contrato de R$12.000
   *   em 12x soma R$1.000 por mês).
   *
   * - Item único (contrato "one_time", ou lançamento sem
   *   contrato vinculado): o valor TOTAL conta de uma vez no
   *   mês da venda (data de início do contrato), não importa
   *   em quantas parcelas foi dividido pra pagamento (um
   *   anúncio de R$5.000 em 4x conta R$5.000 no mês da venda).
   */

  const billedByCompanyMonth = new Map<
    string,
    number
  >();

  if (companyIds.length > 0) {
    const dueRange =
      competenceQueryRangeForYear(
        year
      );

    const { data: entriesData } =
      await supabase
        .from("financial_entries")
        .select(`
          company_id,
          due_date,
          competence_date,
          amount,
          status,
          type,
          contract_id,

          contract:contracts (
            billing_frequency
          )
        `)
        .eq("type", "income")
        .neq("status", "cancelled")
        .gte(
          "due_date",
          dueRange.start
        )
        .lte(
          "due_date",
          dueRange.end
        )
        .in(
          "company_id",
          companyIds
        );

    for (const entry of entriesData ??
      []) {
      const contract = getFirst(
        entry.contract
      );

      const competence =
        getEntryCompetenceMonth({
          dueDate: entry.due_date,
          competenceDate:
            entry.competence_date,
          billingFrequency:
            contract?.billing_frequency ??
            null,
        });

      if (
        !competence ||
        competence.year !== year
      ) {
        continue;
      }

      const key = `${entry.company_id}-${competence.month}`;

      billedByCompanyMonth.set(
        key,
        (billedByCompanyMonth.get(
          key
        ) ?? 0) +
          Number(entry.amount ?? 0)
      );
    }
  }

  /*
   * =====================================================
   * AGRUPAMENTO MENSAL (soma de todas as empresas visíveis)
   * =====================================================
   */

  const monthly = Array.from(
    { length: 12 },
    (_, index) => {
      const monthNumber = index + 1;

      const goal = roundMoney(
        companyIds.reduce(
          (total, companyId) =>
            total +
            (goalByCompanyMonth.get(
              `${companyId}-${monthNumber}`
            ) ?? 0),
          0
        )
      );

      const billed = roundMoney(
        companyIds.reduce(
          (total, companyId) =>
            total +
            (billedByCompanyMonth.get(
              `${companyId}-${monthNumber}`
            ) ?? 0),
          0
        )
      );

      return {
        monthNumber,
        label:
          MONTH_LABELS_SHORT[index],
        goal,
        billed,
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

  const annualBilled = roundMoney(
    monthly.reduce(
      (total, month) =>
        total + month.billed,
      0
    )
  );

  const annualPercent =
    annualGoal > 0
      ? (annualBilled / annualGoal) *
        100
      : null;

  const maxScale =
    Math.max(
      ...monthly.map((month) =>
        Math.max(
          month.goal,
          month.billed
        )
      ),
      1
    ) * 1.15;

  const selectedMonthSummary =
    selectedMonth !== null
      ? monthly[selectedMonth - 1]
      : null;

  const selectedMonthPercent =
    selectedMonthSummary &&
    selectedMonthSummary.goal > 0
      ? (selectedMonthSummary.billed /
          selectedMonthSummary.goal) *
        100
      : null;

  /*
   * =====================================================
   * POR EMPRESA — SÓ FAZ SENTIDO NO CONSOLIDADO
   * =====================================================
   */

  const byCompany = !selectedCompanyId
    ? companies.map((company) => {
        const monthsToSum =
          selectedMonth !== null
            ? [selectedMonth]
            : Array.from(
                { length: 12 },
                (_, index) =>
                  index + 1
              );

        const goal = roundMoney(
          monthsToSum.reduce(
            (total, monthNumber) =>
              total +
              (goalByCompanyMonth.get(
                `${company.id}-${monthNumber}`
              ) ?? 0),
            0
          )
        );

        const billed = roundMoney(
          monthsToSum.reduce(
            (total, monthNumber) =>
              total +
              (billedByCompanyMonth.get(
                `${company.id}-${monthNumber}`
              ) ?? 0),
            0
          )
        );

        return {
          id: company.id,
          name: company.name,
          color: company.color,
          goal,
          billed,
        };
      })
    : [];

  const byCompanyMaxScale =
    Math.max(
      ...byCompany.map((company) =>
        Math.max(
          company.goal,
          company.billed
        )
      ),
      1
    ) * 1.15;

  function periodHref({
    yearValue,
    monthValue,
  }: {
    yearValue?: number;
    monthValue?: number | null;
  }) {
    const query = new URLSearchParams();

    query.set(
      "ano",
      String(
        yearValue ?? year
      )
    );

    const monthToUse =
      monthValue === undefined
        ? selectedMonth
        : monthValue;

    if (monthToUse !== null) {
      query.set(
        "mes",
        String(monthToUse)
      );
    }

    return `/relatorios/metas?${query.toString()}`;
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
              <Building2 className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Metas e Faturamento
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {selectedCompanyId
                  ? "Meta comercial x faturado da empresa selecionada."
                  : "Meta comercial x faturado, consolidado e por empresa."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={periodHref({
                yearValue:
                  year - 1,
                monthValue: null,
              })}
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
              href={periodHref({
                yearValue:
                  year + 1,
                monthValue: null,
              })}
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
                href={periodHref({
                  monthValue: null,
                })}
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
                description="Soma das metas do mês"
              />

              <MetricCard
                icon={TrendingUp}
                label={`Faturado em ${selectedMonthSummary.label}`}
                value={formatCurrency(
                  selectedMonthSummary.billed
                )}
                description="Faturamento por competência no mês"
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
                    ? selectedMonthSummary.billed >=
                      selectedMonthSummary.goal
                      ? "Meta do mês atingida"
                      : "Abaixo da meta do mês"
                    : "Nenhuma meta cadastrada no mês"
                }
                tone={
                  selectedMonthSummary.goal ===
                  0
                    ? "default"
                    : selectedMonthSummary.billed >=
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
              description="Soma das metas cadastradas no ano"
            />

            <MetricCard
              icon={TrendingUp}
              label={`Faturado ${year}`}
              value={formatCurrency(
                annualBilled
              )}
              description="Faturamento por competência no ano"
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
                  ? annualBilled >=
                    annualGoal
                    ? "Meta anual atingida"
                    : "Abaixo da meta anual"
                  : "Nenhuma meta cadastrada no ano"
              }
              tone={
                annualGoal === 0
                  ? "default"
                  : annualBilled >=
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
                Meta x Faturado por mês
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {selectedCompanyId
                  ? "Receita da empresa selecionada, comparada à meta comercial do período."
                  : "Receita de todas as empresas, comparada à meta comercial do período."}{" "}
                Clique em um mês para ver o detalhe.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <LegendItem
                swatchClass="bg-slate-300"
                label="Meta"
              />

              <LegendItem
                swatchClass="bg-[#15704f]"
                label="Faturado (meta atingida)"
              />

              <LegendItem
                swatchClass="bg-amber-500"
                label="Faturado (abaixo da meta)"
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

              const billedHeight =
                maxScale > 0
                  ? (month.billed /
                      maxScale) *
                    100
                  : 0;

              const billedColor =
                month.goal <= 0
                  ? "bg-slate-300"
                  : month.billed >=
                      month.goal
                    ? "bg-[#15704f]"
                    : "bg-amber-500";

              const percent =
                month.goal > 0
                  ? (month.billed /
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
                  href={periodHref({
                    monthValue:
                      isSelected
                        ? null
                        : month.monthNumber,
                  })}
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
                        Faturado:{" "}
                        <span className="font-medium text-white">
                          {formatCurrency(
                            month.billed
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
                      className={`w-3.5 rounded-t transition-all ${billedColor}`}
                      style={{
                        height: `${billedHeight}%`,
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

        {/* POR EMPRESA (só no consolidado) */}

        {!selectedCompanyId && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              Por empresa
              {selectedMonth !==
              null
                ? ` — ${MONTH_LABELS_FULL[selectedMonth - 1]} de ${year}`
                : ` — ${year}`}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Compare a meta e o faturado de cada empresa do grupo.
            </p>

            <div className="mt-5 space-y-4">
              {byCompany.map(
                (company) => {
                  const goalWidth =
                    byCompanyMaxScale >
                    0
                      ? (company.goal /
                          byCompanyMaxScale) *
                        100
                      : 0;

                  const billedWidth =
                    byCompanyMaxScale >
                    0
                      ? (company.billed /
                          byCompanyMaxScale) *
                        100
                      : 0;

                  const barColor =
                    company.goal <=
                    0
                      ? "bg-slate-300"
                      : company.billed >=
                          company.goal
                        ? "bg-[#15704f]"
                        : "bg-amber-500";

                  const percent =
                    company.goal > 0
                      ? (company.billed /
                          company.goal) *
                        100
                      : null;

                  return (
                    <div
                      key={
                        company.id
                      }
                      className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                company.color ??
                                "#94a3b8",
                            }}
                          />

                          <span className="text-sm font-semibold text-slate-900">
                            {
                              company.name
                            }
                          </span>
                        </div>

                        <span className="text-xs text-slate-500">
                          {formatCurrency(
                            company.billed
                          )}
                          {" / "}
                          {formatCurrency(
                            company.goal
                          )}
                          {percent !==
                            null && (
                            <span
                              className={`ml-2 font-semibold ${
                                percent >=
                                100
                                  ? "text-[#15704f]"
                                  : "text-amber-600"
                              }`}
                            >
                              {formatPercentage(
                                percent
                              )}
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-slate-400/40"
                          style={{
                            width: `${goalWidth}%`,
                          }}
                        />

                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
                          style={{
                            width: `${billedWidth}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}

              {!byCompany.length && (
                <p className="py-6 text-center text-sm text-slate-400">
                  Nenhuma empresa disponível.
                </p>
              )}
            </div>
          </div>
        )}
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
    ? (value[0] ?? null)
    : value;
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
