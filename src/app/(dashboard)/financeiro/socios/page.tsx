import Link from "next/link";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Users,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireModulePermission,
} from "@/app/lib/permissions";
import {
  calculatePartnerBalance,
  calculateProfitSplit,
  getMonthRange,
} from "@/app/lib/partner-shares";

import {
  createPartnerWithdrawal,
  saveCompanyPartner,
} from "./actions";

import DeleteWithdrawalButton from "@/app/components/delete-withdrawal-button";
import TogglePartnerButton from "@/app/components/toggle-partner-button";

/*
 * A divisão de lucro (25% caixa / 75% sócios) hoje só existe para
 * a Agência Atthus e a Pottencializa — regra combinada com o
 * cliente em 27/08. Os IDs foram confirmados por consulta direta
 * ao banco.
 */
const PARTNER_COMPANIES = [
  {
    id: "a500a41f-9d6b-4cd6-af06-5920a0631dc1",
    name: "Agência Atthus",
  },
  {
    id: "9d08d74c-c5fe-48c9-b0c5-382cea273d99",
    name: "Pottencializa",
  },
];

const ERROR_MESSAGES: Record<
  string,
  string
> = {
  campos:
    "Preencha todos os campos do adiantamento corretamente.",
  socio:
    "Selecione um sócio ativo dessa empresa.",
  empresa:
    "Empresa inválida para divisão de sócios.",
  salvar:
    "Não foi possível salvar o adiantamento.",
  "socio-campos":
    "Informe o sócio e um percentual entre 0 e 100.",
  "socio-salvar":
    "Não foi possível salvar o sócio.",
};

type PageProps = {
  searchParams: Promise<{
    mes?: string;
    error?: string;
  }>;
};

export default async function SociosFinanceiroPage({
  searchParams,
}: PageProps) {
  await requireModulePermission(
    "financial",
    "view"
  );

  const { mes, error } =
    await searchParams;

  const month = getMonthRange(mes);

  const supabase = await createClient();

  const { data: allProfiles } =
    await supabase
      .from("user_profiles")
      .select("id, name")
      .eq("active", true)
      .order("name");

  const profiles = allProfiles ?? [];

  const companiesData = await Promise.all(
    PARTNER_COMPANIES.map(async (company) => {
      const [
        partnersResult,
        entriesResult,
        withdrawalsResult,
      ] = await Promise.all([
        supabase
          .from("company_partners")
          .select(`
            id,
            user_id,
            percentage,
            active,
            partner:user_profiles (
              id,
              name
            )
          `)
          .eq("company_id", company.id)
          .order("created_at"),

        supabase
          .from("financial_entries")
          .select("id, type, amount_paid")
          .eq("company_id", company.id)
          .gte("due_date", month.start)
          .lte("due_date", month.end),

        supabase
          .from("partner_withdrawals")
          .select(`
            id,
            user_id,
            amount,
            withdrawal_date,
            notes,
            financial_entry_id,
            partner:user_profiles (
              id,
              name
            )
          `)
          .eq("company_id", company.id)
          .gte("withdrawal_date", month.start)
          .lte("withdrawal_date", month.end)
          .order("withdrawal_date", {
            ascending: false,
          }),
      ]);

      const partners = (
        partnersResult.data ?? []
      ).map((partner) => ({
        ...partner,
        partner: getFirst(partner.partner),
      }));

      const withdrawals = (
        withdrawalsResult.data ?? []
      ).map((withdrawal) => ({
        ...withdrawal,
        partner: getFirst(
          withdrawal.partner
        ),
      }));

      const withdrawalEntryIds = new Set(
        withdrawals
          .map(
            (withdrawal) =>
              withdrawal.financial_entry_id
          )
          .filter(Boolean)
      );

      const entries =
        entriesResult.data ?? [];

      const received = entries
        .filter(
          (entry) => entry.type === "income"
        )
        .reduce(
          (total, entry) =>
            total + Number(entry.amount_paid ?? 0),
          0
        );

      const paid = entries
        .filter(
          (entry) =>
            entry.type === "expense" &&
            !withdrawalEntryIds.has(entry.id)
        )
        .reduce(
          (total, entry) =>
            total + Number(entry.amount_paid ?? 0),
          0
        );

      const { profit, reserve, partnersPool } =
        calculateProfitSplit(received, paid);

      /*
       * Os 75% dos sócios são sempre divididos em
       * partes iguais entre os sócios ATIVOS — não
       * existe percentual customizado (regra combinada
       * com o cliente em 27/08). Um sócio inativo não
       * participa da divisão do mês, mas continua
       * aparecendo na lista (e no saldo, se tiver
       * adiantamento pendente daquele mês).
       */
      const activePartnersCount = partners.filter(
        (partner) => partner.active
      ).length;

      const equalPercentage =
        activePartnersCount > 0
          ? 100 / activePartnersCount
          : 0;

      const partnerRows = partners.map(
        (partner) => {
          const withdrawalsTotal = withdrawals
            .filter(
              (withdrawal) =>
                withdrawal.user_id ===
                partner.user_id
            )
            .reduce(
              (total, withdrawal) =>
                total +
                Number(withdrawal.amount ?? 0),
              0
            );

          const percentageForCalc =
            partner.active
              ? equalPercentage
              : 0;

          const { gross, balance } =
            calculatePartnerBalance(
              partnersPool,
              percentageForCalc,
              withdrawalsTotal
            );

          return {
            ...partner,
            percentageForCalc,
            withdrawalsTotal,
            gross,
            balance,
          };
        }
      );

      const activePartnerIds = new Set(
        partners.map(
          (partner) => partner.user_id
        )
      );

      const availableProfiles = profiles.filter(
        (profile) =>
          !activePartnerIds.has(profile.id)
      );

      return {
        company,
        received,
        paid,
        profit,
        reserve,
        partnersPool,
        partners: partnerRows,
        withdrawals,
        availableProfiles,
      };
    })
  );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/financeiro"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao financeiro
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
              <HandCoins className="h-5 w-5 text-[#15704f]" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Sócios
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Divisão de lucro (25% caixa / 75% sócios) e controle de adiantamentos — Agência Atthus e Pottencializa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
            <Link
              href={`/financeiro/socios?mes=${month.previousKey}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            <span className="min-w-[140px] px-2 text-center text-sm font-semibold capitalize text-slate-700">
              {month.label}
            </span>

            <Link
              href={`/financeiro/socios?mes=${month.nextKey}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {ERROR_MESSAGES[error] ??
              "Ocorreu um erro."}
          </div>
        )}

        <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {companiesData.map((data) => (
            <CompanyPartnerCard
              key={data.company.id}
              month={month}
              data={data}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function CompanyPartnerCard({
  month,
  data,
}: {
  month: ReturnType<typeof getMonthRange>;
  data: Awaited<
    ReturnType<
      typeof buildCompanyDataForType
    >
  >;
}) {
  const {
    company,
    received,
    paid,
    profit,
    reserve,
    partnersPool,
    partners,
    withdrawals,
    availableProfiles,
  } = data;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-6">
        <h2 className="font-semibold text-slate-900">
          {company.name}
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryBox
            label="Recebido"
            value={formatCurrency(received)}
          />

          <SummaryBox
            label="Pago"
            value={formatCurrency(paid)}
          />

          <SummaryBox
            label="Lucro"
            value={formatCurrency(profit)}
            highlight
          />

          <SummaryBox
            label="Reserva (25%)"
            value={formatCurrency(reserve)}
          />
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Total para os sócios (75%): {" "}
          <strong className="font-semibold text-slate-600">
            {formatCurrency(partnersPool)}
          </strong>
          . "Pago" não inclui os adiantamentos de sócios do mês — eles não reduzem o lucro a dividir.
        </p>
      </div>

      <div className="border-b border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-700">
          Saldo por sócio
        </h3>

        <div className="mt-4 space-y-3">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="rounded-xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {partner.partner?.name ??
                      "Sócio removido"}
                  </p>

                  <p className="text-xs text-slate-400">
                    {partner.active
                      ? `${partner.percentageForCalc.toLocaleString(
                          "pt-BR",
                          {
                            maximumFractionDigits: 2,
                          }
                        )}% dos 75% dos sócios (= ${(
                          partner.percentageForCalc *
                          0.75
                        ).toLocaleString("pt-BR", {
                          maximumFractionDigits: 2,
                        })}% do lucro total)`
                      : "Inativo — sem participação no mês"}
                  </p>
                </div>

                <TogglePartnerButton
                  partnerId={partner.id}
                  active={partner.active}
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">
                    Bruto
                  </p>
                  <p className="font-semibold text-slate-700">
                    {formatCurrency(
                      partner.gross
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Adiantado
                  </p>
                  <p className="font-semibold text-slate-700">
                    {formatCurrency(
                      partner.withdrawalsTotal
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Saldo
                  </p>
                  <p
                    className={`font-semibold ${
                      partner.balance < 0
                        ? "text-red-600"
                        : "text-emerald-700"
                    }`}
                  >
                    {formatCurrency(
                      partner.balance
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {!partners.length && (
            <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">
              Nenhum sócio cadastrado para essa empresa.
            </p>
          )}
        </div>

        {availableProfiles.length > 0 && (
          <form
            action={saveCompanyPartner}
            className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-slate-200 p-4"
          >
            <input
              type="hidden"
              name="company_id"
              value={company.id}
            />

            <input
              type="hidden"
              name="mes"
              value={month.key}
            />

            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Adicionar sócio
              </label>

              <select
                name="user_id"
                required
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#15704f]"
              >
                <option value="">
                  Selecione...
                </option>

                {availableProfiles.map(
                  (profile) => (
                    <option
                      key={profile.id}
                      value={profile.id}
                    >
                      {profile.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <button
              type="submit"
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Adicionar
            </button>
          </form>
        )}
      </div>

      <div className="p-6">
        <h3 className="text-sm font-semibold text-slate-700">
          Adiantamentos do mês
        </h3>

        <form
          action={createPartnerWithdrawal}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4"
        >
          <input
            type="hidden"
            name="company_id"
            value={company.id}
          />

          <input
            type="hidden"
            name="mes"
            value={month.key}
          />

          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Sócio
            </label>

            <select
              name="user_id"
              required
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#15704f]"
            >
              <option value="">
                Selecione...
              </option>

              {partners
                .filter(
                  (partner) => partner.active
                )
                .map((partner) => (
                  <option
                    key={partner.id}
                    value={partner.user_id}
                  >
                    {partner.partner?.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="w-32">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Valor
            </label>

            <input
              type="text"
              name="amount"
              required
              placeholder="0,00"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#15704f]"
            />
          </div>

          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Data
            </label>

            <input
              type="date"
              name="withdrawal_date"
              required
              defaultValue={month.start}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#15704f]"
            />
          </div>

          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Observação
            </label>

            <input
              type="text"
              name="notes"
              placeholder="Opcional"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#15704f]"
            />
          </div>

          <button
            type="submit"
            className="h-10 rounded-lg bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            Registrar
          </button>
        </form>

        <div className="mt-4 divide-y divide-slate-100">
          {withdrawals.map((withdrawal) => (
            <div
              key={withdrawal.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {withdrawal.partner?.name ??
                    "Sócio removido"}
                </p>

                <p className="text-xs text-slate-400">
                  {formatDate(
                    withdrawal.withdrawal_date
                  )}
                  {withdrawal.notes
                    ? ` · ${withdrawal.notes}`
                    : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-700">
                  {formatCurrency(
                    Number(withdrawal.amount)
                  )}
                </span>

                <DeleteWithdrawalButton
                  withdrawalId={withdrawal.id}
                  partnerName={
                    withdrawal.partner?.name ??
                    "sócio"
                  }
                  amountLabel={formatCurrency(
                    Number(withdrawal.amount)
                  )}
                />
              </div>
            </div>
          ))}

          {!withdrawals.length && (
            <p className="py-6 text-center text-sm text-slate-400">
              Nenhum adiantamento registrado neste mês.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/*
 * Só existe para o TypeScript inferir o tipo de retorno do bloco
 * montado por empresa dentro do Promise.all acima — nunca é
 * chamada de verdade.
 */
async function buildCompanyDataForType() {
  return {
    company: { id: "", name: "" },
    received: 0,
    paid: 0,
    profit: 0,
    reserve: 0,
    partnersPool: 0,
    partners: [
      {
        id: "",
        user_id: "",
        percentage: 0,
        active: true,
        partner: {
          id: "",
          name: "",
        } as {
          id: string;
          name: string;
        } | null,
        percentageForCalc: 0,
        withdrawalsTotal: 0,
        gross: 0,
        balance: 0,
      },
    ],
    withdrawals: [
      {
        id: "",
        user_id: "",
        amount: 0,
        withdrawal_date: "",
        notes: null as string | null,
        financial_entry_id: null as
          | string
          | null,
        partner: {
          id: "",
          name: "",
        } as {
          id: string;
          name: string;
        } | null,
      },
    ],
    availableProfiles: [
      {
        id: "",
        name: "",
      },
    ],
  };
}

function SummaryBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-semibold ${
          highlight
            ? "text-[#15704f]"
            : "text-slate-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

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

function formatCurrency(
  value: number | null
) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(
    "pt-BR"
  ).format(new Date(`${date}T12:00:00`));
}
