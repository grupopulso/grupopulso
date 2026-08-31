"use client";

import {
  useMemo,
} from "react";

import Link from "next/link";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  useCompany,
} from "@/app/components/company-provider";

type Company = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
};

type DashboardMetrics = {
  companyId: string | null;

  activeClients: number;

  receivedMonth: number;

  paidMonth: number;

  monthResult: number;

  receivableOpen: number;

  payableOpen: number;

  receivableOverdue: number;

  payableOverdue: number;

  active: number;

  expiring: number;

  expired: number;

  cancelled: number;
};

type CompanyGoal = {
  companyId: string;
  companyName: string;
  color: string | null;
  target: number | null;
  billed: number;
};

type DashboardPeriod = {
  isAnnual: boolean;
  label: string;
  isCurrent: boolean;
  prevHref: string;
  nextHref: string;
  resetHref: string;
  monthlyHref: string;
  annualHref: string;
};

type DashboardClientProps = {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };

  period: DashboardPeriod;

  companies: Company[];

  consolidatedMetrics: DashboardMetrics;

  metricsByCompany: DashboardMetrics[];

  goalsByCompany: CompanyGoal[];
};

export default function DashboardClient({
  user,
  period,
  companies,
  consolidatedMetrics,
  metricsByCompany,
  goalsByCompany,
}: DashboardClientProps) {
const {
  selectedCompanyId,
  selectedCompany,
  selectCompany,
} = useCompany();

  const metrics =
    useMemo(() => {
      if (
        selectedCompanyId ===
        "all"
      ) {
        return consolidatedMetrics;
      }

      return (
        metricsByCompany.find(
          (item) =>
            item.companyId ===
            selectedCompanyId
        ) ??
        consolidatedMetrics
      );
    }, [
      selectedCompanyId,
      consolidatedMetrics,
      metricsByCompany,
    ]);

  return (
    <main className="min-h-screen bg-[#f5f7f6]">
      <div className="p-8">
        {/* IDENTIFICAÇÃO */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Visão Geral
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompany
                ? `Indicadores da ${selectedCompany.name}`
                : "Indicadores consolidados do Grupo Pulso"}
            </p>

            <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    selectedCompany?.color ??
                    "#15704f",
                }}
              />

              <span className="text-xs font-medium text-slate-600">
                {selectedCompany?.name ??
                  "Grupo Pulso"}
              </span>
            </div>
          </div>

          {/* SELETOR DE PERÍODO */}

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="inline-flex self-end rounded-xl border border-slate-200 bg-white p-1">
              <Link
                href={period.monthlyHref}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  !period.isAnnual
                    ? "bg-[#15704f] text-white"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Mensal
              </Link>

              <Link
                href={period.annualHref}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  period.isAnnual
                    ? "bg-[#15704f] text-white"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Anual
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={period.prevHref}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#15704f]/40 hover:text-[#15704f]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>

              <div className="min-w-[160px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  {period.label}
                </p>

                {!period.isCurrent && (
                  <Link
                    href={period.resetHref}
                    className="text-[11px] font-medium text-[#15704f] hover:underline"
                  >
                    Voltar para o atual
                  </Link>
                )}
              </div>

              <Link
                href={period.nextHref}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#15704f]/40 hover:text-[#15704f]"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* CARDS PRINCIPAIS */}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Users}
            label="Clientes ativos"
            value={String(
              metrics.activeClients
            )}
            description={
              selectedCompany
                ? selectedCompany.name
                : "Ver clientes"
            }
            href="/clientes"
          />

          <MetricCard
            icon={TrendingUp}
            label={period.isAnnual ? "Recebido no ano" : "Recebido no mês"}
            value={formatCurrency(
              metrics.receivedMonth
            )}
            description="Entradas realizadas"
            tone="green"
            href="/financeiro/recebimentos"
          />

          <MetricCard
            icon={ArrowDownLeft}
            label="A receber"
            value={formatCurrency(
              metrics.receivableOpen
            )}
            description="Saldo total em aberto"
            tone="blue"
            href="/financeiro/receber"
          />

          <MetricCard
            icon={TrendingDown}
            label="Receitas vencidas"
            value={formatCurrency(
              metrics.receivableOverdue
            )}
            description="Valores em atraso"
            tone="red"
            href="/financeiro/receber?status=overdue"
          />
        </div>

        {/* SEGUNDA LINHA */}

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={ArrowUpRight}
            label="A pagar"
            value={formatCurrency(
              metrics.payableOpen
            )}
            description="Despesas em aberto"
            tone="orange"
            href="/financeiro/pagar"
          />

          <MetricCard
            icon={TrendingDown}
            label={period.isAnnual ? "Pago no ano" : "Pago no mês"}
            value={formatCurrency(
              metrics.paidMonth
            )}
            description="Saídas realizadas"
            tone="red"
            href="/financeiro/pagamentos"
          />

          <MetricCard
            icon={CircleDollarSign}
            label={period.isAnnual ? "Resultado do ano" : "Resultado do mês"}
            value={formatCurrency(
              metrics.monthResult
            )}
            description="Recebido menos pago"
            tone={
              metrics.monthResult >=
              0
                ? "green"
                : "red"
            }
            href="/financeiro/fluxo"
          />

          <MetricCard
            icon={TrendingDown}
            label="Despesas vencidas"
            value={formatCurrency(
              metrics.payableOverdue
            )}
            description="Pagamentos em atraso"
            tone="orange"
            href="/financeiro/pagar?status=overdue"
          />
        </div>

        {/* METAS DO MÊS */}

        {(() => {
          const visibleGoals =
            selectedCompanyId === "all"
              ? goalsByCompany
              : goalsByCompany.filter(
                  (goal) =>
                    goal.companyId ===
                    selectedCompanyId
                );

          if (visibleGoals.length === 0) {
            return null;
          }

          return (
            <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-[#15704f]" />

                  <h2 className="font-semibold text-slate-900">
                    {period.isAnnual ? "Metas do ano" : "Metas do mês"}
                  </h2>
                </div>

                <Link
                  href="/metas"
                  className="text-sm font-semibold text-[#15704f] hover:underline"
                >
                  Ver metas
                </Link>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleGoals.map((goal) => {
                  const progress =
                    goal.target &&
                    goal.target > 0
                      ? goal.billed /
                        goal.target
                      : null;

                  const pct =
                    progress !== null
                      ? Math.round(
                          progress * 100
                        )
                      : null;

                  return (
                    <div
                      key={goal.companyId}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              goal.color ??
                              "#94a3b8",
                          }}
                        />

                        <p className="text-sm font-semibold text-slate-900">
                          {goal.companyName}
                        </p>
                      </div>

                      {goal.target === null ? (
                        <p className="mt-3 text-xs text-slate-400">
                          Meta não definida ·
                          faturado{" "}
                          {formatCurrency(
                            goal.billed
                          )}
                        </p>
                      ) : (
                        <>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {formatCurrency(
                              goal.billed
                            )}

                            <span className="ml-1 text-xs font-normal text-slate-400">
                              / {formatCurrency(
                                goal.target
                              )}
                            </span>
                          </p>

                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${
                                progress !==
                                  null &&
                                progress >= 1
                                  ? "bg-emerald-500"
                                  : progress !==
                                        null &&
                                      progress >=
                                        0.7
                                    ? "bg-amber-400"
                                    : "bg-red-400"
                              }`}
                              style={{
                                width: `${Math.min(
                                  Math.max(
                                    pct ?? 0,
                                    0
                                  ),
                                  100
                                )}%`,
                              }}
                            />
                          </div>

                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {pct}% atingido
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* VISÃO POR EMPRESA + SITUAÇÃO */}

        <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
            <div>
              <h2 className="font-semibold text-slate-900">
                Visão por empresa
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Indicadores financeiros e clientes por empresa.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {companies.map(
                (company) => {
                  const companyMetrics =
                    metricsByCompany.find(
                      (item) =>
                        item.companyId ===
                        company.id
                    );

                  const selected =
                    selectedCompanyId ===
                    company.id;

                  return (
                    <div
                      key={company.id}
                      className={`rounded-xl border p-4 transition ${
                        selected
                          ? "border-[#15704f]/30 bg-[#15704f]/5"
                          : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor:
                                company.color ??
                                "#94a3b8",
                            }}
                          />

                          <div>
                            <p className="font-semibold text-slate-900">
                              {company.name}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {companyMetrics?.activeClients ??
                                0}{" "}
                              clientes ativos
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6">
                          <SmallMetric
                            label="Recebido"
                            value={formatCurrency(
                              companyMetrics?.receivedMonth ??
                                0
                            )}
                          />

                          <SmallMetric
                            label="A receber"
                            value={formatCurrency(
                              companyMetrics?.receivableOpen ??
                                0
                            )}
                          />

                          <SmallMetric
                            label="Resultado"
                            value={formatCurrency(
                              companyMetrics?.monthResult ??
                                0
                            )}
                          />

                          <button
                            type="button"
                           onClick={() =>
  selectCompany(
    company.id
  )
}
                            
                            className="text-sm font-semibold text-[#15704f] transition hover:underline"
                          >
                            {selected
                              ? "Selecionada"
                              : "Visualizar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}

              {selectedCompanyId !==
                "all" && (
                <button
                  type="button"
                  onClick={() =>
  selectCompany(
    "all"
  )
}
                  className="mt-2 text-sm font-semibold text-slate-500 transition hover:text-[#15704f]"
                >
                  Voltar para visão consolidada
                </button>
              )}

              {!companies.length && (
                <div className="rounded-xl bg-slate-50 px-4 py-10 text-center">
                  <p className="text-sm text-slate-400">
                    Nenhuma empresa disponível.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              Situação dos clientes
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Conforme o filtro global atual.
            </p>

            <div className="mt-6 space-y-5">
              <StatusRow
                label="Ativos"
                value={String(
                  metrics.active
                )}
                dotClass="bg-emerald-500"
              />

              <StatusRow
                label="A vencer"
                value={String(
                  metrics.expiring
                )}
                dotClass="bg-amber-500"
              />

              <StatusRow
                label="Vencidos"
                value={String(
                  metrics.expired
                )}
                dotClass="bg-red-500"
              />

              <StatusRow
                label="Cancelados"
                value={String(
                  metrics.cancelled
                )}
                dotClass="bg-slate-400"
              />
            </div>
          </section>
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
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  description: string;
  tone?:
    | "default"
    | "green"
    | "blue"
    | "red"
    | "orange";
  href?: string;
}) {
  const tones = {
    default:
      "bg-[#15704f]/10 text-[#15704f]",

    green:
      "bg-emerald-50 text-emerald-600",

    blue:
      "bg-blue-50 text-blue-600",

    red:
      "bg-red-50 text-red-600",

    orange:
      "bg-orange-50 text-orange-600",
  };

  const inner = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-slate-500">
          {label}
        </p>

        <p className="mt-2 text-2xl font-semibold text-slate-900">
          {value}
        </p>

        <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
          {description}

          {href && (
            <ChevronRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
          )}
        </p>
      </div>

      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-[#15704f]/40 hover:shadow-sm"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {inner}
    </div>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function StatusRow({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: string;
  dotClass: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${dotClass}`}
        />

        <span className="text-sm text-slate-600">
          {label}
        </span>
      </div>

      <span className="text-sm font-semibold text-slate-900">
        {value}
      </span>
    </div>
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