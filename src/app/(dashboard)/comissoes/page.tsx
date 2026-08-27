import Link from "next/link";

import {
  BadgePercent,
  CircleDollarSign,
  Clock3,
  FileText,
  HandCoins,
  Hourglass,
  ShoppingCart,
  UserRound,
  WalletCards,
} from "lucide-react";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import {
  canAccessModule,
} from "@/app/lib/permissions";

import PayCommissionButton from "./pay-commission-button";

type Profile = {
  id: string;
  name: string | null;
};

type CommissionPayment = {
  id: string;
  commission_id: string;
  financial_entry_id: string;
  amount: number | string;
  amount_applied: number | string;
  status: string;
  created_at: string;
};

type UnifiedCommission = {
  id: string;

  originType:
    | "sale"
    | "contract";

  beneficiaryUserId:
    string;

  sourceUserId:
    string;

  percentage:
    number;

  baseAmount:
    number;

  amount:
    number;

  amountReleased:
    number;

  amountPaid:
    number;

  status:
    string;

  createdAt:
    string;

  saleId?:
    string;

  editionId?:
    string;

  editionName?:
    string;

  editionNumber?:
    string | null;

  contractId?:
    string;

  contractTitle?:
    string;

  clientName?:
    string;
};

type PageProps = {
  searchParams: Promise<{
    q?: string;
    origem?: string;
    status?: string;
    vendedor?: string;
    de?: string;
    ate?: string;
  }>;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const STATUS_FILTERS = [
  { value: "all", label: "Todos os status" },
  { value: "pending", label: "Pendente" },
  { value: "generated", label: "Liberada" },
  { value: "paid", label: "Paga" },
  { value: "cancelled", label: "Cancelada" },
];

export default async function CommissionsPage({
  searchParams,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const {
    q: qParam,
    origem: origemParam,
    status: statusParam,
    vendedor: vendedorParam,
    de: deParam,
    ate: ateParam,
  } = await searchParams;

  const searchTerm =
    (qParam ?? "").trim();

  const originFilter =
    origemParam === "sale" ||
    origemParam === "contract"
      ? origemParam
      : "all";

  const statusFilter =
    STATUS_FILTERS.some(
      (option) =>
        option.value === statusParam
    )
      ? (statusParam as string)
      : "all";

  const beneficiaryFilter =
    (vendedorParam ?? "").trim();

  const dateFrom =
    deParam && DATE_ONLY.test(deParam)
      ? deParam
      : "";

  const dateTo =
    ateParam && DATE_ONLY.test(ateParam)
      ? ateParam
      : "";

  const supabase =
    await createClient();

  /*
   * O papel "seller" não existe mais na constraint de
   * user_profiles.role (só admin/manager/finance/
   * operations/viewer) — a checagem antiga nunca
   * escondia o botão de ninguém. Usamos a mesma
   * permissão que agora protege a Server Action
   * (financial.edit) para decidir o que mostrar,
   * mantendo interface e Server Action consistentes.
   */
  const canManageCommissions =
    canAccessModule(
      access,
      "financial",
      "edit"
    );

  /*
   * =====================================================
   * COMISSÕES DE VENDAS
   * =====================================================
   */

  let saleQuery =
    supabase
      .from(
        "sale_commissions"
      )
      .select(`
        id,
        sale_id,
        beneficiary_user_id,
        source_seller_user_id,
        commission_type,
        percentage,
        base_amount,
        amount,
        amount_released,
        amount_paid,
        status,
        created_at,

        sale:edition_sales (
          id,
          edition_id,
          total_amount,

          client:clients (
            id,
            name
          ),

          edition:newspaper_editions (
            id,
            name,
            edition_number
          )
        )
      `)
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      );

  if (
    access.profile.role ===
    "seller"
  ) {
    saleQuery =
      saleQuery.eq(
        "beneficiary_user_id",
        access.user.id
      );
  }

  const {
    data: saleCommissions,
    error:
      saleCommissionsError,
  } =
    await saleQuery;

  if (
    saleCommissionsError
  ) {
    console.error(
      "Erro ao carregar comissões de vendas:",
      saleCommissionsError
    );
  }

  /*
   * =====================================================
   * COMISSÕES DE CONTRATOS
   * =====================================================
   */

  let contractQuery =
    supabase
      .from(
        "contract_commissions"
      )
      .select(`
        id,
        contract_id,
        beneficiary_user_id,
        source_user_id,
        percentage,
        base_amount,
        amount,
        amount_released,
        amount_paid,
        status,
        created_at,

        contract:contracts!inner (
          id,
          title,
          value,
          company_id,

          client:clients (
            id,
            name
          )
        )
      `)
      /*
       * contract_commissions não tem company_id próprio —
       * o join com !inner + este filtro é o que impede
       * que comissões de contratos da Agência Atthus/
       * Pottencializa apareçam para quem só tem vínculo
       * com o O Estafeta.
       */
      .eq(
        "contract.company_id",
        access.estafetaCompany.id
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      );

  if (
    access.profile.role ===
    "seller"
  ) {
    contractQuery =
      contractQuery.eq(
        "beneficiary_user_id",
        access.user.id
      );
  }

  const {
    data: contractCommissions,
    error:
      contractCommissionsError,
  } =
    await contractQuery;

  if (
    contractCommissionsError
  ) {
    console.error(
      "Erro ao carregar comissões de contratos:",
      contractCommissionsError
    );
  }

  /*
   * =====================================================
   * UNIFICAR COMISSÕES
   * =====================================================
   */

  const unifiedCommissions:
    UnifiedCommission[] =
    [];

  for (
    const commission of
      saleCommissions ??
      []
  ) {
    const sale =
      getFirst(
        commission.sale
      );

    const edition =
      getFirst(
        sale?.edition
      );

    const client =
      getFirst(
        sale?.client
      );

    unifiedCommissions.push({
      id:
        commission.id,

      originType:
        "sale",

      beneficiaryUserId:
        commission
          .beneficiary_user_id,

      sourceUserId:
        commission
          .source_seller_user_id,

      percentage:
        Number(
          commission.percentage ??
            0
        ),

      baseAmount:
        Number(
          commission.base_amount ??
            0
        ),

      amount:
        Number(
          commission.amount ??
            0
        ),

      amountReleased:
        Number(
          commission
            .amount_released ??
            0
        ),

      amountPaid:
        Number(
          commission
            .amount_paid ??
            0
        ),

      status:
        commission.status,

      createdAt:
        commission.created_at,

      saleId:
        sale?.id,

      editionId:
        edition?.id,

      editionName:
        edition?.name,

      editionNumber:
        edition
          ?.edition_number ??
        null,

      clientName:
        client?.name,
    });
  }

  for (
    const commission of
      contractCommissions ??
      []
  ) {
    const contract =
      getFirst(
        commission.contract
      );

    const client =
      getFirst(
        contract?.client
      );

    unifiedCommissions.push({
      id:
        commission.id,

      originType:
        "contract",

      beneficiaryUserId:
        commission
          .beneficiary_user_id,

      sourceUserId:
        commission
          .source_user_id,

      percentage:
        Number(
          commission.percentage ??
            0
        ),

      baseAmount:
        Number(
          commission.base_amount ??
            0
        ),

      amount:
        Number(
          commission.amount ??
            0
        ),

      amountReleased:
        Number(
          commission
            .amount_released ??
            0
        ),

      amountPaid:
        Number(
          commission
            .amount_paid ??
            0
        ),

      status:
        commission.status,

      createdAt:
        commission.created_at,

      contractId:
        contract?.id,

      contractTitle:
        contract?.title,

      clientName:
        client?.name,
    });
  }

  unifiedCommissions.sort(
    (
      a,
      b
    ) =>
      new Date(
        b.createdAt
      ).getTime() -
      new Date(
        a.createdAt
      ).getTime()
  );

  /*
   * =====================================================
   * FILTROS
   * =====================================================
   */

  const normalizedSearch =
    searchTerm.toLocaleLowerCase(
      "pt-BR"
    );

  const filteredCommissions =
    unifiedCommissions.filter(
      (commission) => {
        if (
          originFilter !== "all" &&
          commission.originType !==
            originFilter
        ) {
          return false;
        }

        if (
          statusFilter !== "all" &&
          commission.status !==
            statusFilter
        ) {
          return false;
        }

        if (
          beneficiaryFilter &&
          commission.beneficiaryUserId !==
            beneficiaryFilter
        ) {
          return false;
        }

        if (dateFrom) {
          const created =
            commission.createdAt.slice(
              0,
              10
            );

          if (created < dateFrom) {
            return false;
          }
        }

        if (dateTo) {
          const created =
            commission.createdAt.slice(
              0,
              10
            );

          if (created > dateTo) {
            return false;
          }
        }

        if (normalizedSearch) {
          const haystack = [
            commission.clientName ?? "",
            commission.contractTitle ??
              "",
            commission.editionName ?? "",
          ]
            .join(" ")
            .toLocaleLowerCase("pt-BR");

          if (
            !haystack.includes(
              normalizedSearch
            )
          ) {
            return false;
          }
        }

        return true;
      }
    );

  const hasActiveFilters =
    Boolean(
      searchTerm ||
        originFilter !== "all" ||
        statusFilter !== "all" ||
        beneficiaryFilter ||
        dateFrom ||
        dateTo
    );

  /*
   * =====================================================
   * PERFIS
   * =====================================================
   */

  const profileIds =
    [
      ...new Set(
        unifiedCommissions.flatMap(
          (
            commission
          ) => [
            commission
              .beneficiaryUserId,

            commission
              .sourceUserId,
          ]
        )
      ),
    ];

  let profiles:
    Profile[] =
    [];

  if (
    profileIds.length >
    0
  ) {
    const {
      data:
        profileRows,
      error:
        profilesError,
    } =
      await supabase
        .from(
          "user_profiles"
        )
        .select(`
          id,
          name
        `)
        .in(
          "id",
          profileIds
        );

    if (
      profilesError
    ) {
      console.error(
        "Erro ao carregar perfis:",
        profilesError
      );
    }

    profiles =
      profileRows ??
      [];
  }

  const profilesById =
    new Map(
      profiles.map(
        (
          profile
        ) => [
          profile.id,
          profile,
        ]
      )
    );

  /*
   * =====================================================
   * IDS DAS COMISSÕES
   * =====================================================
   */

  const saleCommissionIds =
    unifiedCommissions
      .filter(
        (
          commission
        ) =>
          commission.originType ===
          "sale"
      )
      .map(
        (
          commission
        ) =>
          commission.id
      );

  const contractCommissionIds =
    unifiedCommissions
      .filter(
        (
          commission
        ) =>
          commission.originType ===
          "contract"
      )
      .map(
        (
          commission
        ) =>
          commission.id
      );

  /*
   * =====================================================
   * PAGAMENTOS DE COMISSÕES DE VENDA
   * =====================================================
   */

  let saleCommissionPayments:
    CommissionPayment[] =
    [];

  if (
    saleCommissionIds.length >
    0
  ) {
    const {
      data:
        paymentRows,
      error:
        paymentRowsError,
    } =
      await supabase
        .from(
          "commission_payments"
        )
        .select(`
          id,
          commission_id,
          financial_entry_id,
          amount,
          amount_applied,
          status,
          created_at
        `)
        .in(
          "commission_id",
          saleCommissionIds
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (
      paymentRowsError
    ) {
      console.error(
        "Erro ao carregar pagamentos de comissões de venda:",
        paymentRowsError
      );
    }

    saleCommissionPayments =
      paymentRows ??
      [];
  }

  /*
   * =====================================================
   * PAGAMENTOS DE COMISSÕES DE CONTRATO
   * =====================================================
   */

  let contractCommissionPayments:
    CommissionPayment[] =
    [];

  if (
    contractCommissionIds.length >
    0
  ) {
    const {
      data:
        paymentRows,
      error:
        paymentRowsError,
    } =
      await supabase
        .from(
          "contract_commission_payments"
        )
        .select(`
          id,
          commission_id,
          financial_entry_id,
          amount,
          amount_applied,
          status,
          created_at
        `)
        .in(
          "commission_id",
          contractCommissionIds
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (
      paymentRowsError
    ) {
      console.error(
        "Erro ao carregar pagamentos de comissões de contrato:",
        paymentRowsError
      );
    }

    contractCommissionPayments =
      paymentRows ??
      [];
  }

  /*
   * =====================================================
   * MAPAS DE PAGAMENTOS
   * =====================================================
   */

  const salePaymentsByCommission =
    new Map<
      string,
      CommissionPayment[]
    >();

  for (
    const payment of
      saleCommissionPayments
  ) {
    const current =
      salePaymentsByCommission.get(
        payment.commission_id
      ) ?? [];

    current.push(
      payment
    );

    salePaymentsByCommission.set(
      payment.commission_id,
      current
    );
  }

  const contractPaymentsByCommission =
    new Map<
      string,
      CommissionPayment[]
    >();

  for (
    const payment of
      contractCommissionPayments
  ) {
    const current =
      contractPaymentsByCommission.get(
        payment.commission_id
      ) ?? [];

    current.push(
      payment
    );

    contractPaymentsByCommission.set(
      payment.commission_id,
      current
    );
  }

  /*
   * =====================================================
   * HELPER LOCAL PARA PEGAR PAGAMENTOS
   * =====================================================
   */

  function getCommissionPayments(
    commission:
      UnifiedCommission
  ) {
    if (
      commission.originType ===
      "sale"
    ) {
      return (
        salePaymentsByCommission.get(
          commission.id
        ) ?? []
      );
    }

    return (
      contractPaymentsByCommission.get(
        commission.id
      ) ?? []
    );
  }

  /*
   * =====================================================
   * ATIVAS
   * =====================================================
   */

  const activeCommissions =
    filteredCommissions.filter(
      (
        commission
      ) =>
        commission.status !==
        "cancelled"
    );

  /*
   * =====================================================
   * TOTAL DAS ORIGENS
   * =====================================================
   */

  const origins =
    new Map<
      string,
      number
    >();

  for (
    const commission of
      activeCommissions
  ) {
    const originKey =
      commission.originType ===
      "sale"
        ? `sale:${commission.saleId}`
        : `contract:${commission.contractId}`;

    if (
      !origins.has(
        originKey
      )
    ) {
      origins.set(
        originKey,
        commission.baseAmount
      );
    }
  }

  const totalOriginValue =
    roundMoney(
      Array.from(
        origins.values()
      ).reduce(
        (
          total,
          value
        ) =>
          total +
          value,
        0
      )
    );

  /*
   * =====================================================
   * TOTAIS
   * =====================================================
   */

  const totalExpected =
    roundMoney(
      activeCommissions.reduce(
        (
          total,
          commission
        ) =>
          total +
          commission.amount,
        0
      )
    );

  const totalReleased =
    roundMoney(
      activeCommissions.reduce(
        (
          total,
          commission
        ) =>
          total +
          commission.amountReleased,
        0
      )
    );

  const totalPaid =
    roundMoney(
      activeCommissions.reduce(
        (
          total,
          commission
        ) =>
          total +
          commission.amountPaid,
        0
      )
    );

  const totalCommitted =
    roundMoney(
      activeCommissions.reduce(
        (
          total,
          commission
        ) => {
          const payments =
            getCommissionPayments(
              commission
            );

          return (
            total +
            calculateCommitted(
              payments
            )
          );
        },
        0
      )
    );

  const totalAvailable =
    Math.max(
      roundMoney(
        totalReleased -
          totalPaid -
          totalCommitted
      ),
      0
    );

  const totalPendingRelease =
    Math.max(
      roundMoney(
        totalExpected -
          totalReleased
      ),
      0
    );

  /*
   * =====================================================
   * POR BENEFICIÁRIO
   * =====================================================
   */

  const beneficiaryMap =
    new Map<
      string,
      {
        userId: string;

        origins:
          Set<string>;

        totalOriginValue:
          number;

        expected:
          number;

        released:
          number;

        paid:
          number;

        committed:
          number;
      }
    >();

  for (
    const commission of
      activeCommissions
  ) {
    const userId =
      commission
        .beneficiaryUserId;

    const current =
      beneficiaryMap.get(
        userId
      ) ?? {
        userId,

        origins:
          new Set<string>(),

        totalOriginValue:
          0,

        expected:
          0,

        released:
          0,

        paid:
          0,

        committed:
          0,
      };

    const originKey =
      commission.originType ===
      "sale"
        ? `sale:${commission.saleId}`
        : `contract:${commission.contractId}`;

    if (
      !current.origins.has(
        originKey
      )
    ) {
      current.origins.add(
        originKey
      );

      current.totalOriginValue =
        roundMoney(
          current.totalOriginValue +
            commission.baseAmount
        );
    }

    current.expected =
      roundMoney(
        current.expected +
          commission.amount
      );

    current.released =
      roundMoney(
        current.released +
          commission.amountReleased
      );

    current.paid =
      roundMoney(
        current.paid +
          commission.amountPaid
      );

    const payments =
      getCommissionPayments(
        commission
      );

    current.committed =
      roundMoney(
        current.committed +
          calculateCommitted(
            payments
          )
      );

    beneficiaryMap.set(
      userId,
      current
    );
  }

  const beneficiarySummaries =
    Array.from(
      beneficiaryMap.values()
    )
      .map(
        (
          item
        ) => {
          const profile =
            profilesById.get(
              item.userId
            );

          return {
            ...item,

            name:
              profile?.name ??
              "Usuário",

            available:
              Math.max(
                roundMoney(
                  item.released -
                    item.paid -
                    item.committed
                ),
                0
              ),

            pendingRelease:
              Math.max(
                roundMoney(
                  item.expected -
                    item.released
                ),
                0
              ),
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.expected -
          a.expected
      );

  const beneficiaryOptions =
    Array.from(
      new Set(
        unifiedCommissions.map(
          (commission) =>
            commission.beneficiaryUserId
        )
      )
    )
      .map((userId) => ({
        id: userId,
        name:
          profilesById.get(userId)
            ?.name ?? "Usuário",
      }))
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          "pt-BR"
        )
      );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-[1650px]">

        {/* CABEÇALHO */}

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
              <BadgePercent className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Comissões
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Comissões geradas por vendas de publicidade e contratos.
              </p>
            </div>
          </div>

          {!canManageCommissions && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium text-slate-500">
                Visualizando somente suas comissões
              </p>
            </div>
          )}
        </div>

        {/* FILTROS */}

        <form
          method="get"
          className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-6"
        >
          <input
            type="search"
            name="q"
            defaultValue={searchTerm}
            placeholder="Cliente, contrato ou edição..."
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-[#15704f] xl:col-span-2"
          />

          <select
            name="origem"
            defaultValue={originFilter}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
          >
            <option value="all">
              Todas as origens
            </option>
            <option value="sale">
              Vendas
            </option>
            <option value="contract">
              Contratos
            </option>
          </select>

          <select
            name="status"
            defaultValue={statusFilter}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
          >
            {STATUS_FILTERS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>

          {canManageCommissions && (
            <select
              name="vendedor"
              defaultValue={
                beneficiaryFilter
              }
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
            >
              <option value="">
                Todos os beneficiários
              </option>

              {beneficiaryOptions.map(
                (option) => (
                  <option
                    key={option.id}
                    value={option.id}
                  >
                    {option.name}
                  </option>
                )
              )}
            </select>
          )}

          <div className="flex items-center gap-2">
            <input
              type="date"
              name="de"
              defaultValue={dateFrom}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
            />

            <span className="text-xs text-slate-400">
              até
            </span>

            <input
              type="date"
              name="ate"
              defaultValue={dateTo}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
            />
          </div>

          <div className="flex items-center gap-3 xl:col-span-6">
            <button
              type="submit"
              className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Filtrar
            </button>

            {hasActiveFilters && (
              <Link
                href="/comissoes"
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Limpar filtros
              </Link>
            )}

            <span className="ml-auto text-xs text-slate-400">
              {filteredCommissions.length}{" "}
              de{" "}
              {unifiedCommissions.length}{" "}
              comissões
            </span>
          </div>
        </form>

        {/* INDICADORES */}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <SummaryCard
            icon={
              ShoppingCart
            }
            label="Valor das origens"
            value={formatCurrency(
              totalOriginValue
            )}
          />

          <SummaryCard
            icon={
              BadgePercent
            }
            label="Prevista"
            value={formatCurrency(
              totalExpected
            )}
          />

          <SummaryCard
            icon={
              WalletCards
            }
            label="Liberada"
            value={formatCurrency(
              totalReleased
            )}
          />

          <SummaryCard
            icon={
              Hourglass
            }
            label="Em pagamento"
            value={formatCurrency(
              totalCommitted
            )}
          />

          <SummaryCard
            icon={
              HandCoins
            }
            label="Paga"
            value={formatCurrency(
              totalPaid
            )}
          />

          <SummaryCard
            icon={
              CircleDollarSign
            }
            label="Disponível"
            value={formatCurrency(
              totalAvailable
            )}
          />

          <SummaryCard
            icon={
              Clock3
            }
            label="A liberar"
            value={formatCurrency(
              totalPendingRelease
            )}
          />
        </div>

        {/* POR BENEFICIÁRIO */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-[#15704f]" />

              <h2 className="font-semibold text-slate-900">
                Por beneficiário
              </h2>
            </div>
          </div>

          {beneficiarySummaries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>
                      Beneficiário
                    </TableHeader>

                    <TableHeader>
                      Origens
                    </TableHeader>

                    <TableHeader>
                      Valor
                    </TableHeader>

                    <TableHeader>
                      Prevista
                    </TableHeader>

                    <TableHeader>
                      Liberada
                    </TableHeader>

                    <TableHeader>
                      Em pagamento
                    </TableHeader>

                    <TableHeader>
                      Paga
                    </TableHeader>

                    <TableHeader>
                      Disponível
                    </TableHeader>

                    <TableHeader>
                      A liberar
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {beneficiarySummaries.map(
                    (
                      item
                    ) => (
                      <tr
                        key={
                          item.userId
                        }
                      >
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                          {
                            item.name
                          }
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-700">
                          {
                            item.origins
                              .size
                          }
                        </td>

                        <td className="px-6 py-4 text-sm font-medium">
                          {formatCurrency(
                            item.totalOriginValue
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm font-semibold">
                          {formatCurrency(
                            item.expected
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm font-semibold text-blue-700">
                          {formatCurrency(
                            item.released
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm font-semibold text-amber-700">
                          {formatCurrency(
                            item.committed
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm font-semibold text-emerald-700">
                          {formatCurrency(
                            item.paid
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm font-semibold text-[#15704f]">
                          {formatCurrency(
                            item.available
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          {formatCurrency(
                            item.pendingRelease
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              text="Nenhuma comissão encontrada."
            />
          )}
        </section>

        {/* HISTÓRICO */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="font-semibold text-slate-900">
              Histórico de comissões
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Vendas e contratos em um único histórico.
            </p>
          </div>

          {filteredCommissions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>
                      Beneficiário
                    </TableHeader>

                    <TableHeader>
                      Origem
                    </TableHeader>

                    <TableHeader>
                      Referência
                    </TableHeader>

                    <TableHeader>
                      Cliente
                    </TableHeader>

                    <TableHeader>
                      %
                    </TableHeader>

                    <TableHeader>
                      Prevista
                    </TableHeader>

                    <TableHeader>
                      Liberada
                    </TableHeader>

                    <TableHeader>
                      Em pagamento
                    </TableHeader>

                    <TableHeader>
                      Paga
                    </TableHeader>

                    <TableHeader>
                      Disponível
                    </TableHeader>

                    <TableHeader>
                      A liberar
                    </TableHeader>

                    <TableHeader>
                      Status
                    </TableHeader>

                    <TableHeader>
                      Ação
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredCommissions.map(
                    (
                      commission
                    ) => {
                      const beneficiary =
                        profilesById.get(
                          commission
                            .beneficiaryUserId
                        );

                      const payments =
                        getCommissionPayments(
                          commission
                        );

                      const committed =
                        calculateCommitted(
                          payments
                        );

                      const available =
                        Math.max(
                          roundMoney(
                            commission.amountReleased -
                              commission.amountPaid -
                              committed
                          ),
                          0
                        );

                      const pendingRelease =
                        Math.max(
                          roundMoney(
                            commission.amount -
                              commission.amountReleased
                          ),
                          0
                        );

                      return (
                        <tr
                          key={`${commission.originType}-${commission.id}`}
                          className={
                            commission.status ===
                            "cancelled"
                              ? "opacity-60"
                              : ""
                          }
                        >
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                            {beneficiary
                              ?.name ??
                              "Usuário"}
                          </td>

                          <td className="px-6 py-4">
                            <OriginBadge
                              type={
                                commission.originType
                              }
                            />
                          </td>

                          <td className="px-6 py-4">
                            {commission.originType ===
                            "sale" ? (
                              <>
                                <p className="text-sm font-medium text-slate-800">
                                  {commission.editionName ??
                                    "Venda"}
                                </p>

                                {commission.editionNumber && (
                                  <p className="mt-1 text-xs text-slate-400">
                                    Nº{" "}
                                    {
                                      commission.editionNumber
                                    }
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm font-medium text-slate-800">
                                {commission.contractTitle ??
                                  "Contrato"}
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-700">
                            {commission.clientName ??
                              "—"}
                          </td>

                          <td className="px-6 py-4 text-sm">
                            {formatPercentage(
                              commission.percentage
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold">
                            {formatCurrency(
                              commission.amount
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold text-blue-700">
                            {formatCurrency(
                              commission.amountReleased
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold text-amber-700">
                            {formatCurrency(
                              committed
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold text-emerald-700">
                            {formatCurrency(
                              commission.amountPaid
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold text-[#15704f]">
                            {formatCurrency(
                              available
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm">
                            {formatCurrency(
                              pendingRelease
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <CommissionStatusBadge
                              status={
                                commission.status
                              }
                              expected={
                                commission.amount
                              }
                              released={
                                commission.amountReleased
                              }
                              paid={
                                commission.amountPaid
                              }
                            />
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex min-w-[150px] flex-col items-start gap-2">
                              {canManageCommissions &&
                                commission.status !==
                                  "cancelled" &&
                                available >
                                  0 && (
                                  <PayCommissionButton
                                    commissionId={
                                      commission.id
                                    }
                                    originType={
                                      commission.originType
                                    }
                                    availableAmount={
                                      available
                                    }
                                  />
                                )}

                              {commission.originType ===
                                "sale" &&
                              commission.saleId &&
                              commission.editionId ? (
                                <Link
                                  href={`/edicoes/${commission.editionId}/vendas/${commission.saleId}`}
                                  className="text-sm font-semibold text-[#15704f] hover:underline"
                                >
                                  Ver venda
                                </Link>
                              ) : commission.originType ===
                                  "contract" &&
                                commission.contractId ? (
                                <Link
                                  href={`/contratos/${commission.contractId}`}
                                  className="text-sm font-semibold text-[#15704f] hover:underline"
                                >
                                  Ver contrato
                                </Link>
                              ) : (
                                "—"
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              text={
                hasActiveFilters
                  ? "Nenhuma comissão para os filtros selecionados."
                  : "Ainda não existem comissões."
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}

/*
 * =====================================================
 * BADGE DA ORIGEM
 * =====================================================
 */

function OriginBadge({
  type,
}: {
  type:
    | "sale"
    | "contract";
}) {
  if (
    type ===
    "contract"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
        <FileText className="h-3 w-3" />

        Contrato
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
      <ShoppingCart className="h-3 w-3" />

      Venda
    </span>
  );
}

/*
 * =====================================================
 * STATUS
 * =====================================================
 */

function CommissionStatusBadge({
  status,
  expected,
  released,
  paid,
}: {
  status: string;

  expected: number;

  released: number;

  paid: number;
}) {
  if (
    status ===
    "cancelled"
  ) {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
        Cancelada
      </span>
    );
  }

  if (
    expected >
      0 &&
    paid >=
      expected
  ) {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Paga
      </span>
    );
  }

  if (
    paid >
    0
  ) {
    return (
      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
        Paga parcialmente
      </span>
    );
  }

  if (
    expected >
      0 &&
    released >=
      expected
  ) {
    return (
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
        Liberada
      </span>
    );
  }

  if (
    released >
    0
  ) {
    return (
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
        Liberada parcialmente
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      Pendente
    </span>
  );
}

/*
 * =====================================================
 * CARD
 * =====================================================
 */

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon:
    React.ElementType;

  label: string;

  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-[#15704f]">
        <Icon className="h-4 w-4" />
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

/*
 * =====================================================
 * TABELA
 * =====================================================
 */

function TableHeader({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <th className="whitespace-nowrap px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <BadgePercent className="mx-auto h-7 w-7 text-slate-300" />

      <p className="mt-3 text-sm text-slate-500">
        {text}
      </p>
    </div>
  );
}

/*
 * =====================================================
 * VALOR EM PAGAMENTO
 * =====================================================
 */

function calculateCommitted(
  payments:
    CommissionPayment[]
) {
  return roundMoney(
    payments.reduce(
      (
        total,
        payment
      ) => {
        if (
          payment.status ===
          "cancelled"
        ) {
          return total;
        }

        return (
          total +
          Math.max(
            Number(
              payment.amount ??
                0
            ) -
              Number(
                payment
                  .amount_applied ??
                  0
              ),
            0
          )
        );
      },
      0
    )
  );
}

/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

function getFirst<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (
    !value
  ) {
    return null;
  }

  return Array.isArray(
    value
  )
    ? value[0] ??
        null
    : value;
}

function roundMoney(
  value: number
) {
  return (
    Math.round(
      (
        Number(
          value
        ) +
        Number.EPSILON
      ) *
        100
    ) /
    100
  );
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",
    }
  ).format(
    value
  );
}

function formatPercentage(
  value: number
) {
  return (
    new Intl.NumberFormat(
      "pt-BR",
      {
        maximumFractionDigits:
          2,
      }
    ).format(
      value
    ) + "%"
  );
}