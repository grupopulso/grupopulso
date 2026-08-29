import Link from "next/link";

import {
  ChevronLeft,
  ChevronRight,
  Target,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

import GoalEditor from "./goal-editor";

type Company = {
  id: string;
  name: string;
  color: string | null;
};

type PageProps = {
  searchParams: Promise<{
    ano?: string;
    mes?: string;
    periodo?: string;
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

export default async function MetasPage({
  searchParams,
}: PageProps) {
  const access =
    await requireModulePermission(
      "financial",
      "view"
    );

  const isAdmin =
    access.profile.role === "admin";

  const { ano, mes, periodo } =
    await searchParams;

  const isAnnual = periodo === "ano";

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

  /*
   * Coluna `month` em company_goals:
   * 1–12 = meta mensal, 0 = meta anual.
   */
  const goalMonth = isAnnual ? 0 : month;

  const monthStart = isAnnual
    ? dateStr(year, 1, 1)
    : dateStr(year, month, 1);

  const monthEnd = isAnnual
    ? dateStr(year + 1, 1, 1)
    : dateStr(
        month === 12 ? year + 1 : year,
        month === 12 ? 1 : month + 1,
        1
      );

  const supabase =
    await createClient();

  /*
   * =========================
   * EMPRESAS DO USUÁRIO
   * =========================
   */

  let companies: Company[] = [];

  if (isAdmin) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, color")
      .eq("active", true)
      .order("name");

    companies = (data ?? []) as Company[];
  } else {
    const { data } = await supabase
      .from("user_companies")
      .select(`
        company:companies (
          id,
          name,
          color,
          active
        )
      `)
      .eq("user_id", access.user.id);

    companies = (
      (data ?? []).flatMap(
        (relation) =>
          relation.company ?? []
      ) as (Company & {
        active: boolean;
      })[]
    )
      .filter((company) => company.active)
      .map((company) => ({
        id: company.id,
        name: company.name,
        color: company.color,
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR")
      );
  }

  const companyIds = companies.map(
    (company) => company.id
  );

  /*
   * =========================
   * METAS DO MÊS
   * =========================
   */

  const goalsByCompany = new Map<
    string,
    number
  >();

  if (companyIds.length > 0) {
    const { data: goals, error } =
      await supabase
        .from("company_goals")
        .select(`
          company_id,
          target_amount
        `)
        .eq("year", year)
        .eq("month", goalMonth)
        .in("company_id", companyIds);

    if (error) {
      console.error(
        "Erro ao carregar metas:",
        error
      );
    }

    for (const goal of goals ?? []) {
      goalsByCompany.set(
        goal.company_id,
        Number(goal.target_amount ?? 0)
      );
    }
  }

  /*
   * =========================
   * FATURAMENTO DO MÊS
   * =========================
   *
   * Soma das contas a receber (income) não canceladas
   * com vencimento dentro do mês, por empresa. Cobre
   * parcelas de contrato, parcelas de venda de edição
   * e lançamentos avulsos de receita.
   */

  const billedByCompany = new Map<
    string,
    number
  >();

  if (companyIds.length > 0) {
    const { data: entries, error } =
      await supabase
        .from("financial_entries")
        .select(`
          company_id,
          amount,
          status
        `)
        .eq("type", "income")
        .neq("status", "cancelled")
        .gte("due_date", monthStart)
        .lt("due_date", monthEnd)
        .in("company_id", companyIds);

    if (error) {
      console.error(
        "Erro ao carregar faturamento:",
        error
      );
    }

    for (const entry of entries ?? []) {
      billedByCompany.set(
        entry.company_id,
        (billedByCompany.get(
          entry.company_id
        ) ?? 0) +
          Number(entry.amount ?? 0)
      );
    }
  }

  /*
   * =========================
   * LINHAS
   * =========================
   */

  const rows = companies.map((company) => {
    const target =
      goalsByCompany.get(company.id) ??
      null;

    const billed =
      billedByCompany.get(company.id) ?? 0;

    const progress =
      target && target > 0
        ? billed / target
        : null;

    return {
      company,
      target,
      billed,
      progress,
    };
  });

  const totalTarget = rows.reduce(
    (total, row) =>
      total + (row.target ?? 0),
    0
  );

  const totalBilled = rows.reduce(
    (total, row) => total + row.billed,
    0
  );

  const totalProgress =
    totalTarget > 0
      ? totalBilled / totalTarget
      : null;

  const companiesWithGoal = rows.filter(
    (row) => row.target !== null
  ).length;

  const companiesOnTarget = rows.filter(
    (row) =>
      row.progress !== null &&
      row.progress >= 1
  ).length;

  /*
   * =========================
   * NAVEGAÇÃO DE MÊS
   * =========================
   */

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const prevHref = isAnnual
    ? `/metas?periodo=ano&ano=${year - 1}`
    : `/metas?ano=${prevYear}&mes=${prevMonth}`;

  const nextHref = isAnnual
    ? `/metas?periodo=ano&ano=${year + 1}`
    : `/metas?ano=${nextYear}&mes=${nextMonth}`;

  const isCurrentPeriod = isAnnual
    ? year === now.getFullYear()
    : year === now.getFullYear() &&
      month === now.getMonth() + 1;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-6 w-6 text-[#15704f]" />

              <h1 className="text-2xl font-semibold text-slate-900">
                Metas
              </h1>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {isAnnual
                ? "Acompanhe o faturamento acumulado de cada empresa contra a meta do ano."
                : "Acompanhe o faturamento de cada empresa contra a meta do mês."}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {/* ALTERNADOR MÊS / ANO */}

            <div className="inline-flex self-end rounded-xl border border-slate-200 bg-white p-1">
              <Link
                href={`/metas?ano=${year}&mes=${month}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  !isAnnual
                    ? "bg-[#15704f] text-white"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Mensal
              </Link>

              <Link
                href={`/metas?periodo=ano&ano=${year}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isAnnual
                    ? "bg-[#15704f] text-white"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Anual
              </Link>
            </div>

            {/* SELETOR DE PERÍODO */}

            <div className="flex items-center gap-2">
              <Link
                href={prevHref}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#15704f]/40 hover:text-[#15704f]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>

              <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  {isAnnual
                    ? `Ano ${year}`
                    : `${MONTH_LABELS[month - 1]} ${year}`}
                </p>

                {!isCurrentPeriod && (
                  <Link
                    href={
                      isAnnual
                        ? "/metas?periodo=ano"
                        : "/metas"
                    }
                    className="text-[11px] font-medium text-[#15704f] hover:underline"
                  >
                    {isAnnual
                      ? "Voltar para o ano atual"
                      : "Voltar para o mês atual"}
                  </Link>
                )}
              </div>

              <Link
                href={nextHref}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#15704f]/40 hover:text-[#15704f]"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* RESUMO CONSOLIDADO */}

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Meta total"
            value={formatCurrency(totalTarget)}
          />

          <SummaryCard
            label={
              isAnnual
                ? "Faturado no ano"
                : "Faturado no mês"
            }
            value={formatCurrency(totalBilled)}
          />

          <SummaryCard
            label="Atingido"
            value={
              totalProgress !== null
                ? formatPercentage(totalProgress)
                : "—"
            }
          />

          <SummaryCard
            label="Empresas na meta"
            value={`${companiesOnTarget}/${companiesWithGoal}`}
          />
        </div>

        {/* CARDS POR EMPRESA */}

        {rows.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Target className="mx-auto h-7 w-7 text-slate-300" />

            <h2 className="mt-3 font-semibold text-slate-800">
              Nenhuma empresa disponível
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Você não tem acesso a nenhuma empresa para acompanhar metas.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <CompanyGoalCard
                key={row.company.id}
                company={row.company}
                target={row.target}
                billed={row.billed}
                progress={row.progress}
                year={year}
                month={goalMonth}
                isAnnual={isAnnual}
                canEdit={isAdmin}
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
 * CARD DE EMPRESA
 * =========================
 */

function CompanyGoalCard({
  company,
  target,
  billed,
  progress,
  year,
  month,
  isAnnual,
  canEdit,
}: {
  company: Company;
  target: number | null;
  billed: number;
  progress: number | null;
  year: number;
  month: number;
  isAnnual: boolean;
  canEdit: boolean;
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
      ? Math.max(target - billed, 0)
      : null;

  const status = getStatus(
    progress
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{
              backgroundColor:
                company.color ?? "#94a3b8",
            }}
          />

          <p className="font-semibold text-slate-900">
            {company.name}
          </p>
        </div>

        <StatusBadge status={status} />
      </div>

      {target === null ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
          <p className="text-sm font-medium text-slate-500">
            {isAnnual
              ? "Meta anual não definida"
              : "Meta não definida para este mês"}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Faturado até agora:{" "}
            {formatCurrency(billed)}
          </p>

          {canEdit && (
            <div className="mt-3 flex justify-center">
              <GoalEditor
                companyId={company.id}
                year={year}
                month={month}
                currentTarget={null}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Faturado
                </p>

                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatCurrency(billed)}
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

            {/* BARRA */}

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

          {canEdit && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <GoalEditor
                companyId={company.id}
                year={year}
                month={month}
                currentTarget={target}
              />
            </div>
          )}
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

function getStatus(progress: number | null) {
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {label}
        </p>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15704f]/10 text-[#15704f]">
          <TrendingUp className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-3 text-xl font-semibold text-slate-900">
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

function dateStr(
  year: number,
  month: number,
  day: number
) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercentage(ratio: number) {
  return `${formatNumber(
    Math.round(ratio * 1000) / 10
  )}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value);
}
