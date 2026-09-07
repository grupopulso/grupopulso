import Link from "next/link";

import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireAdmin,
} from "@/app/lib/permissions";

import {
  fetchSellerSaleRecords,
} from "@/app/lib/seller-performance";

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

type PageProps = {
  searchParams: Promise<{
    ano?: string;
    mes?: string;
  }>;
};

export default async function RelatorioVendedoresPage({
  searchParams,
}: PageProps) {
  await requireAdmin();

  const { ano, mes } =
    await searchParams;

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

  const supabase =
    await createClient();

  /*
   * =====================================================
   * VENDEDORES ATIVOS
   * =====================================================
   */

  const {
    data: settings,
  } = await supabase
    .from("seller_settings")
    .select(`
      user_id,
      company_id,

      profile:user_profiles (
        id,
        name
      ),

      company:companies (
        id,
        name,
        color
      )
    `)
    .eq("active", true)
    .order("created_at");

  const sellerRows = (
    settings ?? []
  )
    .map((setting) => ({
      userId: setting.user_id,
      companyId: setting.company_id,
      profile: getFirst(
        setting.profile
      ),
      company: getFirst(
        setting.company
      ),
    }))
    .filter(
      (row) =>
        row.profile && row.company
    );

  const userIds = [
    ...new Set(
      sellerRows.map(
        (row) => row.userId
      )
    ),
  ];

  const companyIds = [
    ...new Set(
      sellerRows.map(
        (row) => row.companyId
      )
    ),
  ];

  /*
   * =====================================================
   * METAS DO ANO
   * =====================================================
   */

  const goalByKeyMonth = new Map<
    string,
    number
  >();

  if (
    userIds.length > 0 &&
    companyIds.length > 0
  ) {
    const { data: goals } =
      await supabase
        .from("seller_goals")
        .select(`
          user_id,
          company_id,
          month,
          target_amount
        `)
        .eq("year", year)
        .in("user_id", userIds)
        .in(
          "company_id",
          companyIds
        );

    for (const goal of goals ?? []) {
      goalByKeyMonth.set(
        `${goal.user_id}:${goal.company_id}:${goal.month}`,
        Number(
          goal.target_amount ?? 0
        )
      );
    }
  }

  /*
   * =====================================================
   * VENDIDO NO ANO (por mês)
   * =====================================================
   */

  const soldByKeyMonth = new Map<
    string,
    number
  >();

  const records =
    await fetchSellerSaleRecords(
      supabase,
      {
        userIds,
        companyIds,
        periodStart: `${year}-01-01`,
        periodEndExclusive: `${
          year + 1
        }-01-01`,
      }
    );

  for (const record of records) {
    const recordMonth = Number(
      record.createdAt.slice(5, 7)
    );

    const key = `${record.userId}:${record.companyId}:${recordMonth}`;

    soldByKeyMonth.set(
      key,
      (soldByKeyMonth.get(key) ??
        0) + record.amount
    );
  }

  /*
   * =====================================================
   * POR MÊS (todos os vendedores somados)
   * =====================================================
   */

  const monthly = Array.from(
    { length: 12 },
    (_, index) => {
      const monthNumber = index + 1;

      let goal = 0;
      let sold = 0;

      for (const row of sellerRows) {
        const key = `${row.userId}:${row.companyId}:${monthNumber}`;

        goal +=
          goalByKeyMonth.get(key) ??
          0;

        sold +=
          soldByKeyMonth.get(key) ??
          0;
      }

      return {
        monthNumber,
        label:
          MONTH_LABELS_SHORT[index],
        goal: roundMoney(goal),
        sold: roundMoney(sold),
      };
    }
  );

  const maxScale =
    Math.max(
      ...monthly.map((month) =>
        Math.max(month.goal, month.sold)
      ),
      1
    ) * 1.15;

  /*
   * =====================================================
   * POR VENDEDOR (mês selecionado, ou ano inteiro)
   * =====================================================
   */

  const monthsToSum =
    selectedMonth !== null
      ? [selectedMonth]
      : Array.from(
          { length: 12 },
          (_, index) => index + 1
        );

  const bySeller = sellerRows
    .map((row) => {
      const goal = roundMoney(
        monthsToSum.reduce(
          (total, monthNumber) =>
            total +
            (goalByKeyMonth.get(
              `${row.userId}:${row.companyId}:${monthNumber}`
            ) ?? 0),
          0
        )
      );

      const sold = roundMoney(
        monthsToSum.reduce(
          (total, monthNumber) =>
            total +
            (soldByKeyMonth.get(
              `${row.userId}:${row.companyId}:${monthNumber}`
            ) ?? 0),
          0
        )
      );

      return {
        userId: row.userId,
        companyId: row.companyId,
        name:
          row.profile?.name ??
          "Vendedor",
        companyName:
          row.company?.name ?? "—",
        companyColor:
          row.company?.color ??
          null,
        goal,
        sold,
      };
    })
    .sort(
      (a, b) => b.sold - a.sold
    );

  const bySellerMaxScale =
    Math.max(
      ...bySeller.map((row) =>
        Math.max(row.goal, row.sold)
      ),
      1
    ) * 1.15;

  const sellersWithGoal =
    bySeller.filter(
      (row) => row.goal > 0
    ).length;

  const sellersOnTarget =
    bySeller.filter(
      (row) =>
        row.goal > 0 &&
        row.sold >= row.goal
    ).length;

  const totalGoal = roundMoney(
    bySeller.reduce(
      (total, row) =>
        total + row.goal,
      0
    )
  );

  const totalSold = roundMoney(
    bySeller.reduce(
      (total, row) =>
        total + row.sold,
      0
    )
  );

  const totalPercent =
    totalGoal > 0
      ? (totalSold / totalGoal) *
        100
      : null;

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
      String(yearValue ?? year)
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

    return `/relatorios/vendedores?${query.toString()}`;
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
              <Users className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Desempenho dos vendedores
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Meta x vendido de cada vendedor, mês a mês.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={periodHref({
                yearValue: year - 1,
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
                yearValue: year + 1,
                monthValue: null,
              })}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#15704f]/40 hover:text-[#15704f]"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* RESUMO */}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {selectedMonth !== null
                ? "Detalhe do mês"
                : "Ano inteiro"}
            </p>

            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {selectedMonth !== null
                ? `${MONTH_LABELS_FULL[selectedMonth - 1]} de ${year}`
                : `${year}`}
            </h2>
          </div>

          {selectedMonth !== null && (
            <Link
              href={periodHref({
                monthValue: null,
              })}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#15704f] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Ver o ano todo
            </Link>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Target}
            label="Meta"
            value={formatCurrency(
              totalGoal
            )}
            description="Soma das metas dos vendedores"
          />

          <MetricCard
            icon={TrendingUp}
            label="Vendido"
            value={formatCurrency(
              totalSold
            )}
            description="Vendas de edição + contratos atribuídos"
            tone={
              totalPercent === null
                ? "default"
                : totalPercent >= 100
                  ? "green"
                  : "amber"
            }
          />

          <MetricCard
            icon={BarChart3}
            label="Atingimento"
            value={
              totalPercent !== null
                ? formatPercentage(
                    totalPercent
                  )
                : "—"
            }
            description="Vendido sobre a meta"
            tone={
              totalGoal === 0
                ? "default"
                : totalSold >=
                    totalGoal
                  ? "green"
                  : "amber"
            }
          />

          <MetricCard
            icon={Users}
            label="Bateram a meta"
            value={`${sellersOnTarget}/${sellersWithGoal}`}
            description="Vendedores com meta cadastrada"
          />
        </div>

        {/* GRÁFICO MENSAL */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">
                Meta x Vendido por mês
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Soma de todos os vendedores. Clique em um mês para ver o detalhe.
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

        {/* POR VENDEDOR */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Por vendedor
            {selectedMonth !== null
              ? ` — ${MONTH_LABELS_FULL[selectedMonth - 1]} de ${year}`
              : ` — ${year}`}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Compare a meta e o vendido de cada vendedor no período.
          </p>

          <div className="mt-5 space-y-4">
            {bySeller.map((row) => {
              const goalWidth =
                bySellerMaxScale > 0
                  ? (row.goal /
                      bySellerMaxScale) *
                    100
                  : 0;

              const soldWidth =
                bySellerMaxScale > 0
                  ? (row.sold /
                      bySellerMaxScale) *
                    100
                  : 0;

              const barColor =
                row.goal <= 0
                  ? "bg-slate-300"
                  : row.sold >=
                      row.goal
                    ? "bg-[#15704f]"
                    : "bg-amber-500";

              const percent =
                row.goal > 0
                  ? (row.sold /
                      row.goal) *
                    100
                  : null;

              return (
                <div
                  key={`${row.userId}:${row.companyId}`}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            row.companyColor ??
                            "#94a3b8",
                        }}
                      />

                      <span className="text-sm font-semibold text-slate-900">
                        {row.name}
                      </span>

                      <span className="text-xs text-slate-400">
                        {
                          row.companyName
                        }
                      </span>
                    </div>

                    <span className="text-xs text-slate-500">
                      {formatCurrency(
                        row.sold
                      )}
                      {" / "}
                      {formatCurrency(
                        row.goal
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
                        width: `${soldWidth}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {!bySeller.length && (
              <p className="py-6 text-center text-sm text-slate-400">
                Nenhum vendedor ativo.
              </p>
            )}
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
  tone?: "default" | "green" | "amber";
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
  value: T | T[] | null | undefined
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercentage(
  value: number
) {
  return `${new Intl.NumberFormat(
    "pt-BR",
    {
      maximumFractionDigits: 1,
    }
  ).format(value)}%`;
}
