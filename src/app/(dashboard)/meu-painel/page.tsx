import Link from "next/link";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  FileText,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireAuthenticatedUser,
} from "@/app/lib/permissions";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_STYLES,
  getContractStatus,
} from "@/app/lib/contract-status";
import {
  calculateEntryOpenAmount,
  getFinancialEntryStatus,
} from "@/app/lib/financial-entry-status";

type NamedRef = {
  id: string;
  name: string | null;
};

function getFirst<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;
  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function todayString() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function daysBetween(
  fromISO: string,
  toISO: string
) {
  const from = new Date(
    `${fromISO}T12:00:00`
  ).getTime();
  const to = new Date(
    `${toISO}T12:00:00`
  ).getTime();
  return Math.round(
    (to - from) / (1000 * 60 * 60 * 24)
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function MeuPainelPage() {
  const access =
    await requireAuthenticatedUser();

  const userId = access.user.id;
  const today = todayString();

  const supabase = await createClient();

  /*
   * =========================
   * MEUS CONTRATOS
   * =========================
   */

  const { data: contractsRaw } =
    await supabase
      .from("contracts")
      .select(
        `
        id,
        title,
        start_date,
        end_date,
        value,
        status,
        auto_renew,
        legacy_subscription_number,
        notes,
        client:clients ( id, name ),
        company:companies ( id, name, color )
      `
      )
      .eq("responsible_user_id", userId);

  const myContracts = (
    contractsRaw ?? []
  ).map((contract) => {
    const computedStatus = getContractStatus({
      status: contract.status,
      start_date: contract.start_date,
      end_date: contract.end_date,
    });

    const alreadyRenewed = (
      contract.notes ?? ""
    ).includes("pelo contrato");

    return {
      id: contract.id,
      title: contract.title,
      value: Number(contract.value ?? 0),
      startDate: contract.start_date,
      endDate: contract.end_date,
      autoRenew: contract.auto_renew,
      isSubscription: Boolean(
        contract.legacy_subscription_number
      ),
      client: getFirst<NamedRef>(
        contract.client
      ),
      company: getFirst<NamedRef>(
        contract.company
      ),
      computedStatus,
      alreadyRenewed,
    };
  });

  const contractIds = myContracts.map(
    (contract) => contract.id
  );

  const activeContracts = myContracts.filter(
    (contract) =>
      contract.computedStatus === "active"
  );

  const expiringContracts = myContracts
    .filter(
      (contract) =>
        contract.computedStatus === "expiring"
    )
    .sort((a, b) =>
      String(a.endDate ?? "").localeCompare(
        String(b.endDate ?? "")
      )
    );

  const expiredContracts = myContracts
    .filter(
      (contract) =>
        contract.computedStatus === "expired"
    )
    .sort((a, b) =>
      String(b.endDate ?? "").localeCompare(
        String(a.endDate ?? "")
      )
    );

  const renewable = [
    ...expiringContracts,
    ...expiredContracts,
  ].filter(
    (contract) => !contract.alreadyRenewed
  );

  /*
   * =========================
   * COBRANÇAS ATRASADAS (dos meus contratos)
   * =========================
   */

  let overdueEntries: {
    id: string;
    contractId: string;
    contractTitle: string;
    clientName: string;
    dueDate: string;
    openAmount: number;
    daysLate: number;
  }[] = [];

  if (contractIds.length > 0) {
    const { data: entriesRaw } =
      await supabase
        .from("financial_entries")
        .select(
          `
          id,
          contract_id,
          description,
          due_date,
          amount,
          amount_paid,
          interest,
          fine,
          discount,
          status,
          client:clients ( id, name )
        `
        )
        .in("contract_id", contractIds)
        .eq("type", "income")
        .neq("status", "cancelled");

    const contractTitleById = new Map(
      myContracts.map((contract) => [
        contract.id,
        contract.title,
      ])
    );

    overdueEntries = (entriesRaw ?? [])
      .filter((entry) => {
        const computed =
          getFinancialEntryStatus({
            due_date: entry.due_date,
            amount: entry.amount,
            amount_paid: entry.amount_paid,
            interest: entry.interest,
            fine: entry.fine,
            discount: entry.discount,
            status: entry.status,
          });

        return (
          computed === "overdue" ||
          (computed === "partial" &&
            entry.due_date < today)
        );
      })
      .map((entry) => {
        const client = getFirst<NamedRef>(
          entry.client
        );

        return {
          id: entry.id,
          contractId: entry.contract_id,
          contractTitle:
            contractTitleById.get(
              entry.contract_id
            ) ??
            entry.description ??
            "Contrato",
          clientName:
            client?.name ?? "—",
          dueDate: entry.due_date,
          openAmount:
            calculateEntryOpenAmount({
              amount: entry.amount,
              amount_paid:
                entry.amount_paid,
              interest: entry.interest,
              fine: entry.fine,
              discount: entry.discount,
            }),
          daysLate: daysBetween(
            entry.due_date,
            today
          ),
        };
      })
      .sort(
        (a, b) => b.daysLate - a.daysLate
      );
  }

  const overdueTotal = overdueEntries.reduce(
    (total, entry) =>
      total + entry.openAmount,
    0
  );

  const overdueByClient = overdueEntries.reduce<
    Map<string, number>
  >((map, entry) => {
    map.set(
      entry.clientName,
      (map.get(entry.clientName) ?? 0) + 1
    );
    return map;
  }, new Map());

  /*
   * =========================
   * MINHAS VENDAS DE EDIÇÃO
   * =========================
   */

  const { data: salesRaw } = await supabase
    .from("edition_sales")
    .select(
      `
      id,
      status,
      total_amount,
      created_at,
      edition:newspaper_editions ( id, name ),
      client:clients ( id, name )
    `
    )
    .eq("seller_user_id", userId)
    .order("created_at", {
      ascending: false,
    });

  const mySales = (salesRaw ?? []).map(
    (sale) => ({
      id: sale.id,
      status: sale.status,
      total: Number(sale.total_amount ?? 0),
      createdAt: sale.created_at,
      edition: getFirst<NamedRef>(
        sale.edition
      ),
      client: getFirst<NamedRef>(
        sale.client
      ),
    })
  );

  const confirmedSalesTotal = mySales
    .filter(
      (sale) => sale.status === "confirmed"
    )
    .reduce(
      (total, sale) => total + sale.total,
      0
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <TrendingUp className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Meu painel
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Seus contratos e vendas — acompanhamento, renovações e cobranças em atraso.
            </p>
          </div>
        </div>

        {/* RESUMO */}

        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={FileText}
            label="Contratos ativos"
            value={String(
              activeContracts.length
            )}
          />

          <SummaryCard
            icon={CalendarClock}
            label="A vencer (30 dias)"
            value={String(
              expiringContracts.length
            )}
            tone={
              expiringContracts.length > 0
                ? "amber"
                : "default"
            }
          />

          <SummaryCard
            icon={AlertTriangle}
            label="Vencidos"
            value={String(
              expiredContracts.length
            )}
            tone={
              expiredContracts.length > 0
                ? "red"
                : "default"
            }
          />

          <SummaryCard
            icon={AlertTriangle}
            label="Cobranças em atraso"
            value={formatCurrency(
              overdueTotal
            )}
            hint={`${overdueEntries.length} parcela(s) · ${overdueByClient.size} cliente(s)`}
            tone={
              overdueTotal > 0
                ? "red"
                : "default"
            }
          />
        </div>

        {/* RENOVAÇÕES / A VENCER */}

        <Panel
          title="Para renovar / a vencer"
          subtitle="Contratos vencidos ou vencendo nos próximos 30 dias que ainda não foram renovados."
        >
          {renewable.length === 0 ? (
            <EmptyRow text="Nenhum contrato precisando de renovação agora." />
          ) : (
            <div className="divide-y divide-slate-100">
              {renewable.map((contract) => {
                const days = contract.endDate
                  ? daysBetween(
                      today,
                      contract.endDate
                    )
                  : null;

                return (
                  <div
                    key={contract.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/contratos/${contract.id}`}
                          className="text-sm font-semibold text-slate-900 hover:text-[#15704f]"
                        >
                          {contract.title}
                        </Link>

                        <StatusPill
                          status={
                            contract.computedStatus
                          }
                        />
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {contract.client
                          ?.name ?? "—"}
                        {" · "}
                        {contract.company
                          ?.name ?? "—"}
                        {" · vigência até "}
                        {formatDate(
                          contract.endDate
                        )}
                        {days !== null &&
                          (days >= 0
                            ? ` (faltam ${days} dias)`
                            : ` (venceu há ${Math.abs(
                                days
                              )} dias)`)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">
                        {formatCurrency(
                          contract.value
                        )}
                      </span>

                      <Link
                        href={`/contratos/${contract.id}/renovar`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#15704f] px-3 text-xs font-semibold text-white transition hover:bg-[#105c41]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Renovar
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* COBRANÇAS ATRASADAS */}

        <Panel
          title="Cobranças em atraso"
          subtitle="Parcelas vencidas dos contratos sob sua responsabilidade."
        >
          {overdueEntries.length === 0 ? (
            <EmptyRow text="Nenhuma cobrança em atraso. 👍" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-4">
                      Cliente
                    </th>
                    <th className="pb-2 pr-4">
                      Contrato
                    </th>
                    <th className="pb-2 pr-4">
                      Vencimento
                    </th>
                    <th className="pb-2 pr-4">
                      Atraso
                    </th>
                    <th className="pb-2 pr-4 text-right">
                      Em aberto
                    </th>
                    <th className="pb-2" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {overdueEntries.map(
                    (entry) => (
                      <tr key={entry.id}>
                        <td className="py-3 pr-4 font-medium text-slate-800">
                          {entry.clientName}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {
                            entry.contractTitle
                          }
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {formatDate(
                            entry.dueDate
                          )}
                        </td>
                        <td className="py-3 pr-4 font-semibold text-red-600">
                          {entry.daysLate}{" "}
                          dias
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-slate-900">
                          {formatCurrency(
                            entry.openAmount
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={`/financeiro/${entry.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#15704f] hover:underline"
                          >
                            Abrir
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* MEUS CONTRATOS */}

        <Panel
          title="Meus contratos"
          subtitle={`${myContracts.length} contrato(s) sob sua responsabilidade.`}
        >
          {myContracts.length === 0 ? (
            <EmptyRow text="Você ainda não é responsável por nenhum contrato." />
          ) : (
            <div className="divide-y divide-slate-100">
              {myContracts
                .slice()
                .sort((a, b) =>
                  String(
                    a.endDate ?? "9999"
                  ).localeCompare(
                    String(
                      b.endDate ?? "9999"
                    )
                  )
                )
                .map((contract) => (
                  <div
                    key={contract.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/contratos/${contract.id}`}
                          className="text-sm font-medium text-slate-800 hover:text-[#15704f]"
                        >
                          {contract.title}
                        </Link>

                        <StatusPill
                          status={
                            contract.computedStatus
                          }
                        />

                        {contract.isSubscription && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            assinatura
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {contract.client
                          ?.name ?? "—"}
                        {" · "}
                        {contract.company
                          ?.name ?? "—"}
                      </p>
                    </div>

                    <span className="text-sm font-semibold text-slate-700">
                      {formatCurrency(
                        contract.value
                      )}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Panel>

        {/* MINHAS VENDAS DE EDIÇÃO */}

        <Panel
          title="Minhas vendas de publicidade"
          subtitle={`${mySales.length} venda(s) · ${formatCurrency(
            confirmedSalesTotal
          )} confirmado.`}
        >
          {mySales.length === 0 ? (
            <EmptyRow text="Você ainda não registrou vendas de publicidade." />
          ) : (
            <div className="divide-y divide-slate-100">
              {mySales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      <ShoppingCart className="mr-1.5 inline h-3.5 w-3.5 text-slate-400" />
                      {sale.client?.name ??
                        "Cliente"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {sale.edition?.name ??
                        "Edição"}
                      {" · "}
                      {formatDate(
                        String(
                          sale.createdAt
                        ).slice(0, 10)
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <SaleStatusPill
                      status={sale.status}
                    />

                    <span className="text-sm font-semibold text-slate-700">
                      {formatCurrency(
                        sale.total
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "amber" | "red";
}) {
  const valueClass =
    tone === "red"
      ? "text-red-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-slate-900";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-semibold ${valueClass}`}
          >
            {value}
          </p>

          {hint && (
            <p className="mt-1 text-xs text-slate-400">
              {hint}
            </p>
          )}
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#15704f]/10 text-[#15704f]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-1 text-sm text-slate-500">
          {subtitle}
        </p>
      )}

      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="py-6 text-center text-sm text-slate-400">
      {text}
    </p>
  );
}

function StatusPill({
  status,
}: {
  status: keyof typeof CONTRACT_STATUS_LABELS;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CONTRACT_STATUS_STYLES[status]}`}
    >
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}

function SaleStatusPill({
  status,
}: {
  status: string;
}) {
  const map: Record<
    string,
    { label: string; className: string }
  > = {
    confirmed: {
      label: "Confirmada",
      className:
        "bg-emerald-50 text-emerald-700",
    },
    draft: {
      label: "Rascunho",
      className: "bg-slate-100 text-slate-500",
    },
    cancelled: {
      label: "Cancelada",
      className: "bg-red-50 text-red-600",
    },
  };

  const item = map[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  );
}
