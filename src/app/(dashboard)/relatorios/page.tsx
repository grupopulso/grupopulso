import Link from "next/link";

import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  FileText,
  Route,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

type ClientRelation = {
  company_id: string;
  status: string;
};

type FinancialEntry = {
  id: string;
  company_id: string;
  type: "income" | "expense";
  due_date: string;
  amount: number | string;
  amount_paid: number | string;
  interest: number | string;
  fine: number | string;
  discount: number | string;
  status: string;
};

export default async function RelatoriosPage() {
  const access =
    await requireModulePermission(
      "reports",
      "view"
    );

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

    const allowedCompanyIds =
  access.profile.role === "admin"
    ? null
    : access.companyIds;

function canAccessCompany(
  companyId: string
) {
  if (selectedCompanyId) {
    return (
      companyId ===
      selectedCompanyId
    );
  }

  if (
    access.profile.role ===
    "admin"
  ) {
    return true;
  }

  return (
    allowedCompanyIds?.includes(
      companyId
    ) ?? false
  );
}

  const today = new Date();

  const todayString =
    formatDateForDatabase(today);

  const monthStart =
    formatDateForDatabase(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

  const monthEnd =
    formatDateForDatabase(
      new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      )
    );

  const [
    clientsResult,
    contractsResult,
    financialResult,
    routesResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(`
        id,

        client_companies (
          company_id,
          status
        )
      `),

    supabase
      .from("contracts")
      .select(`
        id,
        company_id,
        status,
        value
      `),

    supabase
      .from("financial_entries")
      .select(`
        id,
        company_id,
        type,
        due_date,
        amount,
        amount_paid,
        interest,
        fine,
        discount,
        status
      `),

    supabase
      .from("delivery_routes")
      .select(`
        id,
        company_id,
        active,

        delivery_route_clients (
          id,
          active
        )
      `),
  ]);

  // =========================
  // CLIENTES
  // =========================

 const clients =
  clientsResult.data?.filter(
    (client) =>
      client.client_companies?.some(
        (
          relation: ClientRelation
        ) =>
          canAccessCompany(
            relation.company_id
          )
      )
  ) ?? [];

 const activeClients =
  clients.filter(
    (client) =>
      (
        client.client_companies ??
        []
      ).some(
        (
          relation: ClientRelation
        ) =>
          canAccessCompany(
            relation.company_id
          ) &&
          relation.status ===
            "active"
      )
  ).length;

  // =========================
  // CONTRATOS
  // =========================

const contracts =
  contractsResult.data?.filter(
    (contract) =>
      canAccessCompany(
        contract.company_id
      )
  ) ?? [];

  const activeContracts =
    contracts.filter(
      (contract) =>
        contract.status ===
        "active"
    ).length;

  const expiringContracts =
    contracts.filter(
      (contract) =>
        contract.status ===
        "expiring"
    ).length;

  // =========================
  // FINANCEIRO
  // =========================

const financialEntries =
  (
    financialResult.data ??
    []
  ).filter(
    (entry) =>
      canAccessCompany(
        entry.company_id
      )
  ) as FinancialEntry[];

  const normalized =
    financialEntries.map(
      (entry) => ({
        ...entry,

        calculatedStatus:
          calculateStatus(
            entry,
            todayString
          ),
      })
    );

  const monthEntries =
    normalized.filter(
      (entry) =>
        entry.due_date >=
          monthStart &&
        entry.due_date <=
          monthEnd &&
        entry.calculatedStatus !==
          "cancelled"
    );

  const monthIncome =
    monthEntries
      .filter(
        (entry) =>
          entry.type ===
          "income"
      )
      .reduce(
        (total, entry) =>
          total +
          calculateTotal(entry),
        0
      );

  const monthExpense =
    monthEntries
      .filter(
        (entry) =>
          entry.type ===
          "expense"
      )
      .reduce(
        (total, entry) =>
          total +
          calculateTotal(entry),
        0
      );

  const monthResult =
    monthIncome -
    monthExpense;

  // =========================
  // ROTAS
  // =========================

const routes =
  routesResult.data?.filter(
    (route) =>
      canAccessCompany(
        route.company_id
      )
  ) ?? [];

  const activeRoutes =
    routes.filter(
      (route) => route.active
    ).length;

  const subscribersInRoutes =
    routes.reduce(
      (total, route) =>
        total +
        (
          route.delivery_route_clients ??
          []
        ).filter(
          (relation) =>
            relation.active
        ).length,
      0
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-[1500px]">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Relatórios
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {selectedCompanyId
              ? "Indicadores e relatórios da empresa selecionada."
              : "Indicadores consolidados das empresas do Grupo Pulso."}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Users}
            label="Clientes"
            value={String(
              clients.length
            )}
            description={`${activeClients} ativos`}
          />

          <MetricCard
            icon={FileText}
            label="Contratos ativos"
            value={String(
              activeContracts
            )}
            description={`${expiringContracts} a vencer`}
          />

          <MetricCard
            icon={Route}
            label="Rotas ativas"
            value={String(
              activeRoutes
            )}
            description={`${subscribersInRoutes} assinantes em rotas`}
          />

          <MetricCard
            icon={BarChart3}
            label="Resultado do mês"
            value={formatCurrency(
              monthResult
            )}
            description="Receitas menos despesas"
            tone={
              monthResult >= 0
                ? "green"
                : "red"
            }
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <FinancialCard
            icon={TrendingUp}
            label="Receitas do mês"
            value={monthIncome}
            type="income"
          />

          <FinancialCard
            icon={TrendingDown}
            label="Despesas do mês"
            value={monthExpense}
            type="expense"
          />

          <FinancialCard
            icon={CircleDollarSign}
            label="Resultado"
            value={monthResult}
            type={
              monthResult >= 0
                ? "income"
                : "expense"
            }
          />
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
          <ReportCard
            icon={Users}
            title="Clientes"
            description="Situação dos clientes, ativos, a vencer, vencidos e cancelados."
            href="/relatorios/clientes"
          />

          <ReportCard
            icon={FileText}
            title="Contratos e Assinaturas"
            description="Contratos ativos, vencimentos, recorrência e valores."
            href="/relatorios/contratos"
          />

          <ReportCard
            icon={CircleDollarSign}
            title="Financeiro"
            description="Receitas, despesas, contas em aberto, vencidos e fluxo."
            href="/relatorios/financeiro"
          />

          <ReportCard
            icon={Route}
            title="Rotas e Entregas"
            description="Rotas, entregadores e distribuição de assinantes."
            href="/rotas/relatorio"
          />
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
    | "red";
}) {
  const iconClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "red"
        ? "bg-red-50 text-red-600"
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
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function FinancialCard({
  icon: Icon,
  label,
  value,
  type,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  type: "income" | "expense";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        type === "income"
          ? "border-emerald-100 bg-emerald-50"
          : "border-red-100 bg-red-50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className={`text-sm ${
              type === "income"
                ? "text-emerald-700"
                : "text-red-700"
            }`}
          >
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-semibold ${
              type === "income"
                ? "text-emerald-800"
                : "text-red-800"
            }`}
          >
            {formatCurrency(
              value
            )}
          </p>
        </div>

        <Icon
          className={`h-5 w-5 ${
            type === "income"
              ? "text-emerald-600"
              : "text-red-600"
          }`}
        />
      </div>
    </div>
  );
}

function ReportCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-[#15704f]/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <Icon className="h-5 w-5 text-[#15704f]" />
          </div>

          <h2 className="mt-5 font-semibold text-slate-900 group-hover:text-[#15704f]">
            {title}
          </h2>

          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>

        <ArrowRight className="mt-1 h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#15704f]" />
      </div>
    </Link>
  );
}

function calculateTotal(
  entry: FinancialEntry
) {
  return (
    Number(entry.amount) +
    Number(entry.interest) +
    Number(entry.fine) -
    Number(entry.discount)
  );
}

function calculateStatus(
  entry: FinancialEntry,
  today: string
) {
  if (
    entry.status ===
    "cancelled"
  ) {
    return "cancelled";
  }

  const total =
    calculateTotal(entry);

  if (
    Number(
      entry.amount_paid
    ) >= total &&
    total > 0
  ) {
    return "paid";
  }

  if (
    Number(
      entry.amount_paid
    ) > 0
  ) {
    return "partial";
  }

  if (
    entry.due_date <
    today
  ) {
    return "overdue";
  }

  return "pending";
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

function formatDateForDatabase(
  date: Date
) {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}