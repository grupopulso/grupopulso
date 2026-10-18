import Link from "next/link";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  FileCheck2,
  Hourglass,
  Send,
} from "lucide-react";

import { fetchAllRows } from "@/app/lib/fetch-all";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  canAccessModule,
  requireFinancialEntryAccess,
} from "@/app/lib/permissions";
import {
  calculateEntryOpenAmount,
  calculateEntryTotal,
  getFinancialEntryStatus,
} from "@/app/lib/financial-entry-status";

import {
  ChargeActionBar,
  ChargeCheckbox,
  ChargeSelectionProvider,
  SelectAllCharges,
} from "./charge-selection";

type PageProps = {
  searchParams: Promise<{
    etapa?: string;
    prazo?: string;
    q?: string;
  }>;
};

type Stage =
  | "parado"
  | "cobrado"
  | "vencido"
  | "pago";

const STAGES: {
  value: Stage;
  label: string;
  description: string;
}[] = [
  {
    value: "parado",
    label: "Falta cobrar",
    description:
      "Em aberto e sem cobrança/boleto enviado — ninguém mexeu ainda.",
  },
  {
    value: "cobrado",
    label: "Cobrado, aguardando",
    description:
      "Cobrança enviada, ainda dentro do vencimento.",
  },
  {
    value: "vencido",
    label: "Vencido",
    description:
      "Passou do vencimento e não foi pago (todo ou parte).",
  },
  {
    value: "pago",
    label: "Pago",
    description:
      "Recebido — vencimentos dos últimos 60 dias.",
  },
];

const HORIZONS = [
  { value: "7", label: "Próximos 7 dias" },
  { value: "30", label: "Próximos 30 dias" },
  { value: "60", label: "Próximos 60 dias" },
  { value: "todos", label: "Todos os vencimentos" },
] as const;

/*
 * Andamento das cobranças: um mapa de cada conta a receber
 * — se já foi cobrada (boleto/cobrança enviado), se tem nota
 * fiscal, se foi paga — com destaque pro que está parado sem
 * ninguém ter cobrado. Usa os campos charge_sent /
 * invoice_issued do lançamento (os mesmos do formulário de
 * cada receita).
 */
export default async function ChargesProgressPage({
  searchParams,
}: PageProps) {
  const access =
    await requireFinancialEntryAccess(
      "income",
      "view"
    );

  const canEdit =
    access.profile.role === "admin" ||
    ["financial", "accounts_receivable", "receipts"].some(
      (module) =>
        canAccessModule(access, module, "edit")
    );

  const {
    etapa: stageParam,
    prazo: horizonParam,
    q: qParam,
  } = await searchParams;

  const stage: Stage =
    STAGES.some((item) => item.value === stageParam)
      ? (stageParam as Stage)
      : "parado";

  const horizon =
    HORIZONS.find((item) => item.value === horizonParam)
      ?.value ?? "30";

  const search = (qParam ?? "").trim();

  const today = toDateOnly(new Date());

  const horizonEnd =
    horizon === "todos"
      ? null
      : addDays(today, Number(horizon));

  const paidFrom = addDays(today, -60);

  const in7Days = addDays(today, 7);

  /*
   * Service role: mesmo motivo de Contas a Receber (RLS de
   * financial_entries só libera o módulo geral "financial").
   * Escopo de empresa aplicado na consulta.
   */
  const adminDb = createAdminClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const buildPage = (from: number, to: number) => {
    let query = adminDb
      .from("financial_entries")
      .select(`
        id,
        company_id,
        contract_id,
        description,
        due_date,
        amount,
        amount_paid,
        interest,
        fine,
        discount,
        status,
        invoice_issued,
        invoice_issued_at,
        charge_sent,
        charge_sent_at,

        client:clients (
          id,
          name
        ),

        company:companies (
          id,
          name,
          color
        )
      `)
      .eq("type", "income")
      .neq("status", "cancelled");

    if (selectedCompanyId) {
      query = query.eq(
        "company_id",
        selectedCompanyId
      );
    } else if (access.profile.role !== "admin") {
      query = query.in(
        "company_id",
        access.companyIds.length > 0
          ? access.companyIds
          : ["00000000-0000-0000-0000-000000000000"]
      );
    }

    if (horizonEnd) {
      query = query.lte("due_date", horizonEnd);
    }

    return query
      .order("due_date", { ascending: true })
      .order("id")
      .range(from, to);
  };

  const { data: rows, error } =
    await fetchAllRows(buildPage);

  if (error) {
    console.error(
      "Erro ao carregar andamento das cobranças:",
      error
    );
  }

  /*
   * =========================
   * CLASSIFICAÇÃO
   * =========================
   */

  const entries = (rows ?? []).map((row) => {
    const calculatedStatus =
      getFinancialEntryStatus(row);

    const total = calculateEntryTotal(row);

    const open = calculateEntryOpenAmount(row);

    const overdue =
      calculatedStatus !== "paid" &&
      row.due_date < today;

    const entryStage: Stage | null =
      calculatedStatus === "paid"
        ? row.due_date >= paidFrom
          ? "pago"
          : null
        : overdue
          ? "vencido"
          : row.charge_sent
            ? "cobrado"
            : "parado";

    return {
      ...row,
      client: getFirst(row.client),
      company: getFirst(row.company),
      total,
      open,
      stage: entryStage,
    };
  });

  const stageEntries = (value: Stage) =>
    entries.filter((entry) => entry.stage === value);

  const summaries = STAGES.map((item) => {
    const list = stageEntries(item.value);

    return {
      ...item,
      count: list.length,
      amount: roundMoney(
        list.reduce(
          (sum, entry) =>
            sum +
            (item.value === "pago"
              ? entry.total
              : entry.open),
          0
        )
      ),
    };
  });

  const stalledSoon = stageEntries("parado").filter(
    (entry) => entry.due_date <= in7Days
  );

  const overdueWithoutCharge = stageEntries(
    "vencido"
  ).filter((entry) => !entry.charge_sent);

  const openWithoutInvoice = entries.filter(
    (entry) =>
      entry.stage !== "pago" &&
      entry.stage !== null &&
      !entry.invoice_issued
  );

  const normalizedSearch = normalize(search);

  const visible = stageEntries(stage)
    .filter((entry) =>
      normalizedSearch
        ? normalize(
            `${entry.client?.name ?? ""} ${entry.description}`
          ).includes(normalizedSearch)
        : true
    )
    .sort((a, b) =>
      stage === "pago"
        ? b.due_date.localeCompare(a.due_date)
        : a.due_date.localeCompare(b.due_date)
    );

  const visibleIds = visible.map((entry) => entry.id);

  const currentStage = STAGES.find(
    (item) => item.value === stage
  )!;

  const buildHref = (params: {
    etapa?: Stage;
    prazo?: string;
  }) => {
    const query = new URLSearchParams();

    query.set("etapa", params.etapa ?? stage);
    query.set("prazo", params.prazo ?? horizon);

    if (search) {
      query.set("q", search);
    }

    return `/financeiro/cobrancas?${query.toString()}`;
  };

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/financeiro"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o financeiro
        </Link>

        <div className="mt-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Andamento das cobranças
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              O que falta cobrar, o que já foi cobrado, o que
              venceu e o que já foi pago.
            </p>
          </div>

          <form className="flex flex-wrap items-center gap-3">
            <input
              type="hidden"
              name="etapa"
              value={stage}
            />

            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Buscar cliente ou descrição"
              className="h-11 w-64 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#15704f]"
            />

            <select
              name="prazo"
              defaultValue={horizon}
              aria-label="Vencimentos considerados"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#15704f]"
            >
              {HORIZONS.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Filtrar
            </button>
          </form>
        </div>

        {/* ETAPAS */}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaries.map((item) => (
            <StageCard
              key={item.value}
              href={buildHref({ etapa: item.value })}
              active={item.value === stage}
              stage={item.value}
              label={item.label}
              count={item.count}
              amount={item.amount}
            />
          ))}
        </div>

        {/* ALERTAS */}

        {(stalledSoon.length > 0 ||
          overdueWithoutCharge.length > 0 ||
          openWithoutInvoice.length > 0) && (
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {stalledSoon.length > 0 && (
              <AlertCard
                href={buildHref({ etapa: "parado" })}
                tone="warning"
                text={`${stalledSoon.length} ${
                  stalledSoon.length === 1
                    ? "conta vence"
                    : "contas vencem"
                } em até 7 dias e ainda não ${
                  stalledSoon.length === 1
                    ? "foi cobrada"
                    : "foram cobradas"
                }.`}
              />
            )}

            {overdueWithoutCharge.length > 0 && (
              <AlertCard
                href={buildHref({ etapa: "vencido" })}
                tone="danger"
                text={`${overdueWithoutCharge.length} ${
                  overdueWithoutCharge.length === 1
                    ? "conta vencida nunca foi cobrada"
                    : "contas vencidas nunca foram cobradas"
                } (sem cobrança enviada).`}
              />
            )}

            {openWithoutInvoice.length > 0 && (
              <AlertCard
                href={buildHref({ etapa: stage })}
                tone="neutral"
                text={`${openWithoutInvoice.length} ${
                  openWithoutInvoice.length === 1
                    ? "conta em aberto está"
                    : "contas em aberto estão"
                } sem nota fiscal marcada.`}
              />
            )}
          </div>
        )}

        {/* LISTA */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="font-semibold text-slate-900">
              {currentStage.label}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {currentStage.description}
              {canEdit &&
                stage !== "pago" &&
                " Marque os itens para registrar a cobrança enviada ou a nota fiscal de uma vez."}
            </p>
          </div>

          <ChargeSelectionProvider>
            <ChargeActionBar canEdit={canEdit} />

            {visible.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {canEdit && (
                        <th className="w-10 py-3 pl-6">
                          <SelectAllCharges
                            ids={visibleIds}
                          />
                        </th>
                      )}

                      <TableHeader>Cliente</TableHeader>
                      <TableHeader>Descrição</TableHeader>
                      <TableHeader>Empresa</TableHeader>
                      <TableHeader>Vencimento</TableHeader>
                      <TableHeader>
                        {stage === "pago"
                          ? "Valor"
                          : "Em aberto"}
                      </TableHeader>
                      <TableHeader>Cobrança</TableHeader>
                      <TableHeader>Nota fiscal</TableHeader>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {visible.map((entry) => (
                      <tr
                        key={entry.id}
                        className="transition hover:bg-slate-50"
                      >
                        {canEdit && (
                          <td className="w-10 py-4 pl-6">
                            <ChargeCheckbox
                              id={entry.id}
                              label={entry.description}
                            />
                          </td>
                        )}

                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {entry.client ? (
                            <Link
                              href={`/clientes/${entry.client.id}`}
                              className="hover:text-[#15704f]"
                            >
                              {entry.client.name}
                            </Link>
                          ) : (
                            <span className="text-slate-400">
                              —
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <Link
                            href={`/financeiro/${entry.id}`}
                            className="text-sm text-slate-700 hover:text-[#15704f]"
                          >
                            {entry.description}
                          </Link>

                          {entry.contract_id && (
                            <Link
                              href={`/contratos/${entry.contract_id}`}
                              className="mt-0.5 block text-xs text-slate-400 hover:text-[#15704f]"
                            >
                              Ver contrato
                            </Link>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  entry.company?.color ??
                                  "#94a3b8",
                              }}
                            />

                            <span className="text-sm text-slate-600">
                              {entry.company?.name ?? "—"}
                            </span>
                          </div>
                        </td>

                        <td
                          className={`px-5 py-4 text-sm ${
                            entry.stage === "vencido"
                              ? "font-medium text-red-600"
                              : entry.stage === "parado" &&
                                  entry.due_date <= in7Days
                                ? "font-medium text-amber-700"
                                : "text-slate-600"
                          }`}
                        >
                          {formatDate(entry.due_date)}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            stage === "pago"
                              ? entry.total
                              : entry.open
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <DocBadge
                            done={Boolean(entry.charge_sent)}
                            date={entry.charge_sent_at}
                            doneLabel="Enviada"
                            pendingLabel="Não enviada"
                          />
                        </td>

                        <td className="px-5 py-4">
                          <DocBadge
                            done={Boolean(entry.invoice_issued)}
                            date={entry.invoice_issued_at}
                            doneLabel="Emitida"
                            pendingLabel="Sem NF"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-6 py-14 text-center text-sm text-slate-400">
                {search
                  ? "Nada encontrado para essa busca."
                  : stage === "parado"
                    ? "Nada parado — tudo o que vence no período já foi cobrado."
                    : "Nenhum lançamento nesta etapa."}
              </p>
            )}
          </ChargeSelectionProvider>
        </section>
      </div>
    </main>
  );
}

/*
 * =========================
 * COMPONENTES
 * =========================
 */

function StageCard({
  href,
  active,
  stage,
  label,
  count,
  amount,
}: {
  href: string;
  active: boolean;
  stage: Stage;
  label: string;
  count: number;
  amount: number;
}) {
  const styles = {
    parado: {
      icon: CircleDot,
      color: "text-amber-600",
      ring: "ring-amber-300",
    },
    cobrado: {
      icon: Hourglass,
      color: "text-blue-600",
      ring: "ring-blue-300",
    },
    vencido: {
      icon: AlertTriangle,
      color: "text-red-600",
      ring: "ring-red-300",
    },
    pago: {
      icon: CheckCircle2,
      color: "text-emerald-600",
      ring: "ring-emerald-300",
    },
  }[stage];

  const Icon = styles.icon;

  return (
    <Link
      href={href}
      className={`block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 ${
        active ? `ring-2 ${styles.ring}` : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {count}
          </p>

          <p className={`mt-1 text-sm font-medium ${styles.color}`}>
            {formatCurrency(amount)}
          </p>
        </div>

        <Icon className={`h-6 w-6 ${styles.color}`} />
      </div>
    </Link>
  );
}

function AlertCard({
  href,
  tone,
  text,
}: {
  href: string;
  tone: "warning" | "danger" | "neutral";
  text: string;
}) {
  const style = {
    warning:
      "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral:
      "border-slate-200 bg-white text-slate-600",
  }[tone];

  return (
    <Link
      href={href}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm transition hover:opacity-90 ${style}`}
    >
      {tone === "neutral" ? (
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : tone === "danger" ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Send className="mt-0.5 h-4 w-4 shrink-0" />
      )}

      <span>{text}</span>
    </Link>
  );
}

function DocBadge({
  done,
  date,
  doneLabel,
  pendingLabel,
}: {
  done: boolean;
  date: string | null;
  doneLabel: string;
  pendingLabel: string;
}) {
  if (!done) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
        {pendingLabel}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        {doneLabel}
      </span>

      {date && (
        <span className="mt-0.5 text-[11px] text-slate-400">
          {formatDate(date)}
        </span>
      )}
    </span>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
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
    ? value[0] ?? null
    : value;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function toDateOnly(date: Date) {
  // Hoje no fuso de Brasília (o servidor roda em UTC).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00Z`);

  parsed.setUTCDate(parsed.getUTCDate() + days);

  return parsed.toISOString().slice(0, 10);
}

function formatDate(date: string | null) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(
    `${date.slice(0, 10)}T12:00:00`
  );

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR").format(
    parsed
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function roundMoney(value: number) {
  return (
    Math.round((value + Number.EPSILON) * 100) / 100
  );
}
