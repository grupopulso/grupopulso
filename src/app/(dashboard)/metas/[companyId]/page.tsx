import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

import { loadBilledEntries } from "@/app/lib/billed-entries";

type PageProps = {
  params: Promise<{
    companyId: string;
  }>;
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

const ESTAFETA_COMPANY_SLUG = "o-estafeta";

export default async function MetaDetalhePage({
  params,
  searchParams,
}: PageProps) {
  const access =
    await requireModulePermission(
      "financial",
      "view"
    );

  const { companyId } = await params;

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

  const isAdmin =
    access.profile.role === "admin";

  if (
    !isAdmin &&
    !access.companyIds.includes(companyId)
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  const { data: company } =
    await supabase
      .from("companies")
      .select("id, name, color, slug")
      .eq("id", companyId)
      .eq("active", true)
      .maybeSingle();

  if (!company) {
    notFound();
  }

  const entries = (
    await loadBilledEntries(supabase, {
      companyIds: [company.id],
      companySlugById: new Map([
        [company.id, company.slug],
      ]),
      year,
      month,
      isAnnual,
    })
  ).sort(
    (a, b) =>
      a.competence.year * 12 +
        a.competence.month -
        (b.competence.year * 12 +
          b.competence.month) ||
      (a.clientName ?? "").localeCompare(
        b.clientName ?? "",
        "pt-BR"
      ) ||
      a.dueDate.localeCompare(b.dueDate)
  );

  const total = entries.reduce(
    (sum, entry) => sum + entry.amount,
    0
  );

  const { data: goalRows } =
    await supabase
      .from("company_goals")
      .select("target_amount")
      .eq("company_id", company.id)
      .eq("year", year)
      .gte("month", isAnnual ? 1 : month)
      .lte("month", isAnnual ? 12 : month);

  const target = goalRows?.length
    ? goalRows.reduce(
        (sum, goal) =>
          sum +
          Number(goal.target_amount ?? 0),
        0
      )
    : null;

  const periodLabel = isAnnual
    ? `Ano ${year}`
    : `${MONTH_LABELS[month - 1]} ${year}`;

  const backHref = isAnnual
    ? `/metas?periodo=ano&ano=${year}`
    : `/metas?ano=${year}&mes=${month}`;

  const isEstafeta =
    company.slug === ESTAFETA_COMPANY_SLUG;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para as metas
        </Link>

        <div className="mt-5 flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 rounded-full"
            style={{
              backgroundColor:
                company.color ?? "#94a3b8",
            }}
          />

          <h1 className="text-2xl font-semibold text-slate-900">
            {company.name}
          </h1>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Lançamentos que compõem o faturado de{" "}
          {periodLabel}.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Faturado"
            value={formatCurrency(total)}
          />

          <SummaryCard
            label="Meta"
            value={
              target !== null
                ? formatCurrency(target)
                : "Não definida"
            }
          />

          <SummaryCard
            label="Lançamentos"
            value={String(entries.length)}
          />
        </div>

        <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
          O faturado é contado por{" "}
          <strong>competência</strong>, não pelo vencimento.{" "}
          {getRuleText(isEstafeta)}
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Cliente</Th>
                  <Th>Contrato / lançamento</Th>
                  <Th>Competência</Th>
                  <Th>Vencimento</Th>
                  <Th align="right">Valor</Th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {entry.clientName ?? "—"}
                    </td>

                    <td className="px-5 py-4 text-sm">
                      <Link
                        href={`/financeiro/${entry.id}`}
                        className="font-medium text-slate-700 hover:text-[#15704f] hover:underline"
                      >
                        {entry.contractTitle
                          ? `${entry.contractTitle} — ${entry.description}`
                          : entry.description}
                      </Link>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {MONTH_LABELS[
                        entry.competence.month - 1
                      ].slice(0, 3)}
                      /{entry.competence.year}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatDate(entry.dueDate)}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(entry.amount)}
                    </td>
                  </tr>
                ))}

                {entries.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-sm text-slate-400"
                    >
                      Nenhum lançamento compõe o faturado deste
                      período.
                    </td>
                  </tr>
                )}
              </tbody>

              {entries.length > 0 && (
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-4 text-sm font-semibold text-slate-700"
                    >
                      Total faturado
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function getRuleText(isEstafeta: boolean) {
  return isEstafeta
    ? "Nesta empresa, contrato recorrente conta no mês de início do contrato mais as parcelas já decorridas até o vencimento; item único conta o valor inteiro no mês da venda."
    : "Nesta empresa, contrato recorrente conta no mês anterior ao vencimento de cada parcela (faturamento em atraso); item único conta cada parcela no mês do próprio vencimento.";
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        align === "right"
          ? "text-right"
          : ""
      }`}
    >
      {children}
    </th>
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: string) {
  const [year, month, day] =
    date.split("-");

  return `${day}/${month}/${year}`;
}
