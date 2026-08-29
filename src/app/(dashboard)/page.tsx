import DashboardClient from "@/app/components/dashboard-client";

import { createClient } from "@/app/lib/supabase/server";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  getMostUrgentContractStatus,
  normalizeStoredStatus,
} from "@/app/lib/contract-status";

type Company = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
};

type ClientCompany = {
  client_id: string;
  company_id: string;
  status: string;
};

type ContractStatusRow = {
  client_id: string;
  company_id: string;
  status: string;
  start_date: string;
  end_date: string | null;
};

type FinancialEntry = {
  id: string;
  company_id: string;
  type: string;
  due_date: string;
  amount: number | string;
  amount_paid: number | string;
  interest: number | string;
  fine: number | string;
  discount: number | string;
  status: string;
};

type Transaction = {
  id: string;
  amount: number | string;
  transaction_date: string;

  financial_entry:
    | {
        id: string;
        company_id: string;
        type: string;
      }
    | {
        id: string;
        company_id: string;
        type: string;
      }[]
    | null;
};

export type DashboardMetrics = {
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

export default async function HomePage() {
  const access =
    await requireModulePermission(
      "dashboard",
      "view"
    );

  const supabase =
    await createClient();

  const user =
    access.user;

  /*
   * ==========================
   * EMPRESAS PERMITIDAS
   * ==========================
   */

  let companies: Company[] = [];

  if (
    access.profile.role ===
    "admin"
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("companies")
      .select(`
        id,
        name,
        slug,
        color
      `)
      .eq("active", true)
      .order("name");

    if (error) {
      console.error(
        "Erro ao carregar empresas:",
        JSON.stringify(
          error,
          null,
          2
        )
      );
    }

    companies =
      (data ?? []) as Company[];
  } else {
    const {
      data,
      error,
    } = await supabase
      .from("user_companies")
      .select(`
        company:companies (
          id,
          name,
          slug,
          color
        )
      `)
      .eq(
        "user_id",
        user.id
      );

    if (error) {
      console.error(
        "Erro ao carregar empresas do usuário:",
        JSON.stringify(
          error,
          null,
          2
        )
      );
    }

    companies =
      (
        data?.flatMap(
          (relation) =>
            relation.company ??
            []
        ) ?? []
      ) as Company[];
  }

  const allowedCompanyIds =
    companies.map(
      (company) =>
        company.id
    );

  /*
   * ==========================
   * CLIENTES / SITUAÇÕES
   * ==========================
   */

  let clientCompaniesQuery =
    supabase
      .from(
        "client_companies"
      )
      .select(`
        client_id,
        company_id,
        status
      `);

  if (
    allowedCompanyIds.length
  ) {
    clientCompaniesQuery =
      clientCompaniesQuery.in(
        "company_id",
        allowedCompanyIds
      );
  }

  const {
    data: clientCompaniesData,
    error: clientCompaniesError,
  } =
    await clientCompaniesQuery;

  if (
    clientCompaniesError
  ) {
    console.error(
      "Erro ao carregar vínculos de clientes:",
      JSON.stringify(
        clientCompaniesError,
        null,
        2
      )
    );
  }

  const clientCompanies =
    (clientCompaniesData ??
      []) as ClientCompany[];

  /*
   * ==========================
   * CONTRATOS (para calcular o
   * status real dos vínculos)
   * ==========================
   */

  let contractsStatusQuery =
    supabase
      .from(
        "contracts"
      )
      .select(`
        client_id,
        company_id,
        status,
        start_date,
        end_date
      `);

  if (
    allowedCompanyIds.length
  ) {
    contractsStatusQuery =
      contractsStatusQuery.in(
        "company_id",
        allowedCompanyIds
      );
  }

  const {
    data: contractsStatusData,
    error: contractsStatusError,
  } =
    await contractsStatusQuery;

  if (
    contractsStatusError
  ) {
    console.error(
      "Erro ao carregar contratos para status dos vínculos:",
      JSON.stringify(
        contractsStatusError,
        null,
        2
      )
    );
  }

  const contractsForStatus =
    (contractsStatusData ??
      []) as ContractStatusRow[];

  /*
   * ==========================
   * LANÇAMENTOS FINANCEIROS
   * ==========================
   */

  let entriesQuery =
    supabase
      .from(
        "financial_entries"
      )
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
      `);

  if (
    allowedCompanyIds.length
  ) {
    entriesQuery =
      entriesQuery.in(
        "company_id",
        allowedCompanyIds
      );
  }

  const {
    data: entriesData,
    error: entriesError,
  } =
    await entriesQuery;

  if (entriesError) {
    console.error(
      "Erro ao carregar financeiro:",
      JSON.stringify(
        entriesError,
        null,
        2
      )
    );
  }

  const entries =
    (entriesData ??
      []) as FinancialEntry[];

  /*
   * ==========================
   * TRANSAÇÕES REALIZADAS
   * ==========================
   */

  const now =
    new Date();

  const monthStart =
    toDatabaseDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )
    );

  const monthEnd =
    toDatabaseDate(
      new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      )
    );

  const {
    data: transactionsData,
    error: transactionsError,
  } = await supabase
    .from(
      "financial_transactions"
    )
    .select(`
      id,
      amount,
      transaction_date,

      financial_entry:financial_entries (
        id,
        company_id,
        type
      )
    `)
    .gte(
      "transaction_date",
      monthStart
    )
    .lte(
      "transaction_date",
      monthEnd
    );

  if (
    transactionsError
  ) {
    console.error(
      "Erro ao carregar movimentações:",
      JSON.stringify(
        transactionsError,
        null,
        2
      )
    );
  }

  const transactions =
    (transactionsData ??
      []) as Transaction[];

  /*
   * Remove transações de empresas
   * que o usuário não pode acessar.
   */
  const allowedTransactions =
    transactions.filter(
      (transaction) => {
        const entry =
          getFirst(
            transaction.financial_entry
          );

        if (!entry) {
          return false;
        }

        if (
          access.profile.role ===
          "admin"
        ) {
          return true;
        }

        return allowedCompanyIds.includes(
          entry.company_id
        );
      }
    );

  /*
   * ==========================
   * MÉTRICA CONSOLIDADA
   * ==========================
   */

  const consolidatedMetrics =
    calculateMetrics({
      companyId: null,
      clientCompanies,
      contracts:
        contractsForStatus,
      entries,
      transactions:
        allowedTransactions,
    });

  /*
   * ==========================
   * MÉTRICAS POR EMPRESA
   * ==========================
   */

  /*
   * ==========================
   * METAS DO MÊS (por empresa)
   * ==========================
   */

  const goalYear = now.getFullYear();
  const goalMonth = now.getMonth() + 1;

  let goalsByCompany: {
    companyId: string;
    companyName: string;
    color: string | null;
    target: number | null;
    billed: number;
  }[] = [];

  if (allowedCompanyIds.length > 0) {
    const { data: goalRows } =
      await supabase
        .from("company_goals")
        .select(
          "company_id, target_amount"
        )
        .eq("year", goalYear)
        .eq("month", goalMonth)
        .in(
          "company_id",
          allowedCompanyIds
        );

    const targetByCompany = new Map<
      string,
      number
    >();

    for (const row of goalRows ?? []) {
      targetByCompany.set(
        row.company_id,
        Number(row.target_amount ?? 0)
      );
    }

    goalsByCompany = companies.map(
      (company) => {
        const billed = entries
          .filter(
            (entry) =>
              entry.company_id ===
                company.id &&
              entry.type === "income" &&
              entry.status !==
                "cancelled" &&
              entry.due_date >=
                monthStart &&
              entry.due_date <= monthEnd
          )
          .reduce(
            (total, entry) =>
              total +
              Number(entry.amount ?? 0),
            0
          );

        return {
          companyId: company.id,
          companyName: company.name,
          color: company.color,
          target:
            targetByCompany.get(
              company.id
            ) ?? null,
          billed,
        };
      }
    );
  }

  const metricsByCompany =
    companies.map(
      (company) =>
        calculateMetrics({
          companyId:
            company.id,

          clientCompanies:
            clientCompanies.filter(
              (relation) =>
                relation.company_id ===
                company.id
            ),

          contracts:
            contractsForStatus.filter(
              (contract) =>
                contract.company_id ===
                company.id
            ),

          entries:
            entries.filter(
              (entry) =>
                entry.company_id ===
                company.id
            ),

          transactions:
            allowedTransactions.filter(
              (transaction) => {
                const entry =
                  getFirst(
                    transaction.financial_entry
                  );

                return (
                  entry?.company_id ===
                  company.id
                );
              }
            ),
        })
    );

  return (
    <DashboardClient
      user={{
        id:
          user.id,

        email:
          user.email ?? "",

        fullName:
          access.profile.name ??
          user.email ??
          "Usuário",

        role:
          access.profile.role,
      }}
      companies={
        companies
      }
      consolidatedMetrics={
        consolidatedMetrics
      }
      metricsByCompany={
        metricsByCompany
      }
      goalsByCompany={
        goalsByCompany
      }
    />
  );
}

/*
 * ==========================
 * CALCULA INDICADORES
 * ==========================
 */

function calculateMetrics({
  companyId,
  clientCompanies,
  contracts,
  entries,
  transactions,
}: {
  companyId:
    | string
    | null;

  clientCompanies:
    ClientCompany[];

  contracts:
    ContractStatusRow[];

  entries:
    FinancialEntry[];

  transactions:
    Transaction[];
}): DashboardMetrics {
  const today =
    toDatabaseDate(
      new Date()
    );

  /*
   * CLIENTES
   *
   * O status de cada vínculo é calculado a partir dos contratos reais
   * do cliente naquela empresa (mesma regra de contract-status.ts).
   * Quando não existe nenhum contrato formal para o vínculo, cai no
   * valor gravado em client_companies.status como último recurso.
   */

  const clientCompaniesWithStatus =
    clientCompanies.map(
      (relation) => ({
        ...relation,

        effectiveStatus:
          getMostUrgentContractStatus(
            contracts.filter(
              (contract) =>
                contract.client_id ===
                  relation.client_id &&
                contract.company_id ===
                  relation.company_id
            )
          ) ??
          normalizeStoredStatus(
            relation.status
          ),
      })
    );

  const activeClients =
    clientCompaniesWithStatus.filter(
      (relation) =>
        relation.effectiveStatus ===
        "active"
    ).length;

  const active =
    activeClients;

  const expiring =
    clientCompaniesWithStatus.filter(
      (relation) =>
        relation.effectiveStatus ===
        "expiring"
    ).length;

  const expired =
    clientCompaniesWithStatus.filter(
      (relation) =>
        relation.effectiveStatus ===
        "expired"
    ).length;

  const cancelled =
    clientCompaniesWithStatus.filter(
      (relation) =>
        relation.effectiveStatus ===
        "cancelled"
    ).length;

  /*
   * CONTAS EM ABERTO
   */

  const validEntries =
    entries.filter(
      (entry) =>
        entry.status !==
        "cancelled"
    );

  const receivableOpen =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
          "income"
      )
      .reduce(
        (total, entry) =>
          total +
          calculateOpenAmount(
            entry
          ),
        0
      );

  const payableOpen =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
          "expense"
      )
      .reduce(
        (total, entry) =>
          total +
          calculateOpenAmount(
            entry
          ),
        0
      );

  /*
   * VENCIDOS
   */

  const receivableOverdue =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
            "income" &&
          entry.due_date <
            today &&
          calculateOpenAmount(
            entry
          ) > 0
      )
      .reduce(
        (total, entry) =>
          total +
          calculateOpenAmount(
            entry
          ),
        0
      );

  const payableOverdue =
    validEntries
      .filter(
        (entry) =>
          entry.type ===
            "expense" &&
          entry.due_date <
            today &&
          calculateOpenAmount(
            entry
          ) > 0
      )
      .reduce(
        (total, entry) =>
          total +
          calculateOpenAmount(
            entry
          ),
        0
      );

  /*
   * REALIZADO NO MÊS
   */

  const receivedMonth =
    transactions.reduce(
      (total, transaction) => {
        const entry =
          getFirst(
            transaction.financial_entry
          );

        if (
          entry?.type !==
          "income"
        ) {
          return total;
        }

        return (
          total +
          Number(
            transaction.amount
          )
        );
      },
      0
    );

  const paidMonth =
    transactions.reduce(
      (total, transaction) => {
        const entry =
          getFirst(
            transaction.financial_entry
          );

        if (
          entry?.type !==
          "expense"
        ) {
          return total;
        }

        return (
          total +
          Number(
            transaction.amount
          )
        );
      },
      0
    );

  return {
    companyId,

    activeClients,

    receivedMonth,

    paidMonth,

    monthResult:
      receivedMonth -
      paidMonth,

    receivableOpen,

    payableOpen,

    receivableOverdue,

    payableOverdue,

    active,

    expiring,

    expired,

    cancelled,
  };
}

/*
 * VALOR TOTAL DA CONTA
 */
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

/*
 * SALDO AINDA NÃO PAGO/RECEBIDO
 */
function calculateOpenAmount(
  entry: FinancialEntry
) {
  return Math.max(
    calculateTotal(entry) -
      Number(
        entry.amount_paid
      ),
    0
  );
}

function getFirst<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function toDatabaseDate(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}