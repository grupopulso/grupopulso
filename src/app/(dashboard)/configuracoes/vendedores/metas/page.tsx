import Link from "next/link";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Target,
} from "lucide-react";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireAdmin,
} from "@/app/lib/permissions";

import {
  fetchSellerSaleRecords,
} from "@/app/lib/seller-performance";

import SellerGoalEditor from "./seller-goal-editor";

type PageProps = {
  searchParams: Promise<{
    ano?: string;
    mes?: string;
  }>;
};

const MONTH_LABELS = [
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

export default async function SellerGoalsPage({
  searchParams,
}: PageProps) {
  await requireAdmin();

  const { ano, mes } =
    await searchParams;

  const now = new Date();

  const parsedYear = Number(ano);
  const parsedMonth = Number(mes);

  const year =
    Number.isInteger(parsedYear) &&
    parsedYear >= 2000 &&
    parsedYear <= 2100
      ? parsedYear
      : now.getFullYear();

  const month =
    Number.isInteger(parsedMonth) &&
    parsedMonth >= 1 &&
    parsedMonth <= 12
      ? parsedMonth
      : now.getMonth() + 1;

  const periodStart = `${year}-${String(
    month
  ).padStart(2, "0")}-01`;

  const nextPeriodMonth =
    month === 12 ? 1 : month + 1;

  const nextPeriodYear =
    month === 12 ? year + 1 : year;

  const periodEndExclusive = `${nextPeriodYear}-${String(
    nextPeriodMonth
  ).padStart(2, "0")}-01`;

  /*
   * Leitura via service role: esta página já é restrita a
   * admin (requireAdmin acima).
   */
  const adminDb = createAdminClient();

  /*
   * =========================
   * VENDEDORES ATIVOS
   * =========================
   *
   * user_profiles é buscado separado (não dá pra fazer embed
   * de seller_settings.user_id -> user_profiles.id: não existe
   * FK entre as duas pro PostgREST descobrir a relação).
   */

  const {
    data: settings,
    error: settingsError,
  } = await adminDb
    .from("seller_settings")
    .select(`
      user_id,
      company_id,

      company:companies (
        id,
        name,
        color
      )
    `)
    .eq("active", true)
    .order("created_at");

  if (settingsError) {
    console.error(
      "Erro ao carregar vendedores:",
      settingsError
    );
  }

  const sellerUserIds = [
    ...new Set(
      (settings ?? []).map(
        (setting) => setting.user_id
      )
    ),
  ];

  const { data: profiles } =
    sellerUserIds.length > 0
      ? await adminDb
          .from("user_profiles")
          .select("id, name")
          .in("id", sellerUserIds)
      : { data: [] };

  const profileById = new Map(
    (profiles ?? []).map(
      (profile) => [
        profile.id,
        profile,
      ]
    )
  );

  const sellerRows = (
    settings ?? []
  )
    .map((setting) => ({
      userId: setting.user_id,
      companyId: setting.company_id,
      profile:
        profileById.get(
          setting.user_id
        ) ?? null,
      company: getFirst(
        setting.company
      ),
    }))
    .filter(
      (row) =>
        row.profile && row.company
    )
    .sort((a, b) =>
      (a.profile?.name ?? "").localeCompare(
        b.profile?.name ?? "",
        "pt-BR"
      )
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
   * =========================
   * METAS DO PERÍODO
   * =========================
   */

  const goalByKey = new Map<
    string,
    number
  >();

  if (
    userIds.length > 0 &&
    companyIds.length > 0
  ) {
    const { data: goals, error } =
      await adminDb
        .from("seller_goals")
        .select(`
          user_id,
          company_id,
          target_amount
        `)
        .eq("year", year)
        .eq("month", month)
        .in("user_id", userIds)
        .in(
          "company_id",
          companyIds
        );

    if (error) {
      console.error(
        "Erro ao carregar metas dos vendedores:",
        error
      );
    }

    for (const goal of goals ?? []) {
      goalByKey.set(
        `${goal.user_id}:${goal.company_id}`,
        Number(
          goal.target_amount ?? 0
        )
      );
    }
  }

  /*
   * =========================
   * VENDIDO NO PERÍODO
   * =========================
   */

  const soldByKey = new Map<
    string,
    number
  >();

  const records =
    await fetchSellerSaleRecords(
      adminDb,
      {
        userIds,
        companyIds,
        periodStart,
        periodEndExclusive,
      }
    );

  for (const record of records) {
    const key = `${record.userId}:${record.companyId}`;

    soldByKey.set(
      key,
      (soldByKey.get(key) ?? 0) +
        record.amount
    );
  }

  /*
   * =========================
   * LINHAS
   * =========================
   */

  const rows = sellerRows.map(
    (row) => {
      const key = `${row.userId}:${row.companyId}`;

      const target =
        goalByKey.get(key) ?? null;

      const sold =
        soldByKey.get(key) ?? 0;

      const progress =
        target && target > 0
          ? sold / target
          : null;

      return {
        ...row,
        target,
        sold,
        progress,
      };
    }
  );

  const sellersWithGoal = rows.filter(
    (row) => row.target !== null
  ).length;

  const sellersOnTarget = rows.filter(
    (row) =>
      row.progress !== null &&
      row.progress >= 1
  ).length;

  /*
   * =========================
   * NAVEGAÇÃO DE MÊS
   * =========================
   */

  const prevMonth =
    month === 1 ? 12 : month - 1;

  const prevYear =
    month === 1 ? year - 1 : year;

  const nextMonth =
    month === 12 ? 1 : month + 1;

  const nextYear =
    month === 12 ? year + 1 : year;

  const isCurrentPeriod =
    year === now.getFullYear() &&
    month === now.getMonth() + 1;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">

        {/* VOLTAR */}

        <div className="mb-7">
          <Link
            href="/configuracoes/vendedores"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Vendedores
          </Link>
        </div>

        {/* CABEÇALHO */}

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
              <Target className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Metas dos vendedores
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Defina a meta mensal de cada vendedor e acompanhe o quanto já venderam.
              </p>
            </div>
          </div>

          {/* SELETOR DE PERÍODO */}

          <div className="flex items-center gap-2">
            <Link
              href={`/configuracoes/vendedores/metas?ano=${prevYear}&mes=${prevMonth}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#15704f]/40 hover:text-[#15704f]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-center">
              <p className="text-sm font-semibold text-slate-900">
                {MONTH_LABELS[month - 1]}{" "}
                {year}
              </p>

              {!isCurrentPeriod && (
                <Link
                  href="/configuracoes/vendedores/metas"
                  className="text-[11px] font-medium text-[#15704f] hover:underline"
                >
                  Voltar para o mês atual
                </Link>
              )}
            </div>

            <Link
              href={`/configuracoes/vendedores/metas?ano=${nextYear}&mes=${nextMonth}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#15704f]/40 hover:text-[#15704f]"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* RESUMO */}

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard
            label="Vendedores com meta"
            value={`${sellersWithGoal}/${rows.length}`}
          />

          <SummaryCard
            label="Bateram a meta"
            value={`${sellersOnTarget}/${sellersWithGoal}`}
          />
        </div>

        {/* CARDS POR VENDEDOR */}

        {rows.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Target className="mx-auto h-7 w-7 text-slate-300" />

            <h2 className="mt-3 font-semibold text-slate-800">
              Nenhum vendedor ativo
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre vendedores em Configurações → Vendedores.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <SellerGoalCard
                key={`${row.userId}:${row.companyId}`}
                name={
                  row.profile?.name ??
                  "Vendedor"
                }
                companyName={
                  row.company?.name ??
                  "—"
                }
                companyColor={
                  row.company?.color ??
                  null
                }
                userId={row.userId}
                companyId={
                  row.companyId
                }
                target={row.target}
                sold={row.sold}
                progress={
                  row.progress
                }
                year={year}
                month={month}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/*
 * =========================
 * CARD DE VENDEDOR
 * =========================
 */

function SellerGoalCard({
  name,
  companyName,
  companyColor,
  userId,
  companyId,
  target,
  sold,
  progress,
  year,
  month,
}: {
  name: string;
  companyName: string;
  companyColor: string | null;
  userId: string;
  companyId: string;
  target: number | null;
  sold: number;
  progress: number | null;
  year: number;
  month: number;
}) {
  const percent =
    progress !== null
      ? Math.round(progress * 1000) / 10
      : null;

  const clampedPercent =
    percent !== null
      ? Math.min(Math.max(percent, 0), 100)
      : 0;

  const remaining =
    target !== null
      ? Math.max(target - sold, 0)
      : null;

  const status = getStatus(progress);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">
            {name}
          </p>

          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  companyColor ??
                  "#94a3b8",
              }}
            />

            <p className="text-xs text-slate-500">
              {companyName}
            </p>
          </div>
        </div>

        <StatusBadge status={status} />
      </div>

      {target === null ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
          <p className="text-sm font-medium text-slate-500">
            Meta não definida para este mês
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Vendido até agora:{" "}
            {formatCurrency(sold)}
          </p>

          <div className="mt-3 flex justify-center">
            <SellerGoalEditor
              userId={userId}
              companyId={companyId}
              year={year}
              month={month}
              currentTarget={null}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Vendido
                </p>

                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatCurrency(sold)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Meta
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {formatCurrency(target)}
                </p>
              </div>
            </div>

            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${status.barClass}`}
                style={{
                  width: `${clampedPercent}%`,
                }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                {percent !== null
                  ? `${formatNumber(percent)}%`
                  : "—"}
              </span>

              <span className="text-slate-400">
                {remaining && remaining > 0
                  ? `faltam ${formatCurrency(
                      remaining
                    )}`
                  : "meta atingida"}
              </span>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <SellerGoalEditor
              userId={userId}
              companyId={companyId}
              year={year}
              month={month}
              currentTarget={target}
            />
          </div>
        </>
      )}
    </div>
  );
}

/*
 * =========================
 * STATUS
 * =========================
 */

function getStatus(
  progress: number | null
) {
  if (progress === null) {
    return {
      label: "Sem meta",
      badgeClass:
        "bg-slate-100 text-slate-500",
      barClass: "bg-slate-300",
    };
  }

  if (progress >= 1) {
    return {
      label: "Meta batida",
      badgeClass:
        "bg-emerald-50 text-emerald-700",
      barClass: "bg-emerald-500",
    };
  }

  if (progress >= 0.7) {
    return {
      label: "No caminho",
      badgeClass:
        "bg-amber-50 text-amber-700",
      barClass: "bg-amber-400",
    };
  }

  return {
    label: "Atrás da meta",
    badgeClass: "bg-red-50 text-red-700",
    barClass: "bg-red-400",
  };
}

function StatusBadge({
  status,
}: {
  status: ReturnType<typeof getStatus>;
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.badgeClass}`}
    >
      {status.label}
    </span>
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

      <p className="mt-2 text-xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

/*
 * =========================
 * HELPERS
 * =========================
 */

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value);
}
