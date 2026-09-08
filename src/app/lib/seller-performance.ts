/*
 * =====================================================
 * DESEMPENHO DE VENDEDOR (pra comparar com a meta)
 * =====================================================
 *
 * "Quanto o vendedor vendeu" usa a MESMA lógica de
 * competência do faturamento das empresas (ver
 * src/app/lib/competence-date.ts) — não a data em que a
 * venda/comissão foi registrada. Isso significa: parcela
 * de contrato recorrente conta no mês de competência (que
 * depende da empresa — início do contrato pro Estafeta,
 * vencimento em atraso pras outras), item único conta no
 * mês da venda.
 *
 * Pra saber QUEM vendeu cada lançamento financeiro (não
 * existe essa coluna direto em financial_entries):
 *   - lançamento de contrato (contract_id preenchido): o
 *     vendedor é quem gerou a comissão do contrato
 *     (contract_commissions.source_user_id — 1 linha por
 *     contrato, é o vendedor de origem).
 *   - lançamento de venda avulsa de edição (sem contrato):
 *     rastreia edition_sale_installments.financial_entry_id
 *     -> sale_id -> edition_sales.seller_user_id.
 */

import {
  competenceQueryRangeForYear,
  getEntryCompetenceMonth,
} from "@/app/lib/competence-date";

export type SellerCompetenceRecord = {
  userId: string;
  companyId: string;
  year: number;
  month: number;
  amount: number;
};

export async function fetchSellerCompetenceRecords(
  supabase: any,
  params: {
    userIds: string[];
    companyIds: string[];
    year: number;
  }
): Promise<
  SellerCompetenceRecord[]
> {
  if (
    params.userIds.length === 0 ||
    params.companyIds.length === 0
  ) {
    return [];
  }

  const dueRange =
    competenceQueryRangeForYear(
      params.year
    );

  const [
    companiesResult,
    contractCommissionsResult,
    salesResult,
    entriesResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, slug")
      .in("id", params.companyIds),

    supabase
      .from("contract_commissions")
      .select(
        "contract_id, source_user_id"
      )
      .in(
        "source_user_id",
        params.userIds
      ),

    supabase
      .from("edition_sales")
      .select(
        "id, seller_user_id"
      )
      .in(
        "seller_user_id",
        params.userIds
      ),

    supabase
      .from("financial_entries")
      .select(`
        id,
        company_id,
        due_date,
        competence_date,
        amount,
        status,
        contract_id,

        contract:contracts (
          billing_frequency,
          start_date
        )
      `)
      .eq("type", "income")
      .neq("status", "cancelled")
      .gte(
        "due_date",
        dueRange.start
      )
      .lte(
        "due_date",
        dueRange.end
      )
      .in(
        "company_id",
        params.companyIds
      ),
  ]);

  const slugByCompany = new Map<
    string,
    string | null
  >(
    (
      companiesResult.data ?? []
    ).map((company: any) => [
      company.id,
      company.slug,
    ])
  );

  const sellerByContract = new Map<
    string,
    string
  >(
    (
      contractCommissionsResult.data ??
      []
    ).map((row: any) => [
      row.contract_id,
      row.source_user_id,
    ])
  );

  const sellerBySale = new Map<
    string,
    string
  >(
    (
      salesResult.data ?? []
    ).map((sale: any) => [
      sale.id,
      sale.seller_user_id,
    ])
  );

  const saleIds = (
    salesResult.data ?? []
  ).map((sale: any) => sale.id);

  const sellerByEntry = new Map<
    string,
    string
  >();

  if (saleIds.length > 0) {
    const {
      data: installments,
    } = await supabase
      .from(
        "edition_sale_installments"
      )
      .select(
        "sale_id, financial_entry_id"
      )
      .in("sale_id", saleIds);

    for (const row of installments ??
      []) {
      if (
        !row.financial_entry_id
      ) {
        continue;
      }

      const seller =
        sellerBySale.get(
          row.sale_id
        );

      if (seller) {
        sellerByEntry.set(
          row.financial_entry_id,
          seller
        );
      }
    }
  }

  const records: SellerCompetenceRecord[] =
    [];

  for (const entry of entriesResult.data ??
    []) {
    const sellerUserId =
      entry.contract_id
        ? sellerByContract.get(
            entry.contract_id
          ) ?? null
        : sellerByEntry.get(
            entry.id
          ) ?? null;

    if (!sellerUserId) {
      continue;
    }

    const contract = getFirst(
      entry.contract
    );

    const competence =
      getEntryCompetenceMonth({
        dueDate: entry.due_date,
        competenceDate:
          entry.competence_date,
        billingFrequency:
          contract?.billing_frequency ??
          null,
        contractStartDate:
          contract?.start_date ??
          null,
        companySlug:
          slugByCompany.get(
            entry.company_id
          ) ?? null,
      });

    if (
      !competence ||
      competence.year !==
        params.year
    ) {
      continue;
    }

    records.push({
      userId: sellerUserId,
      companyId: entry.company_id,
      year: competence.year,
      month: competence.month,
      amount: Number(
        entry.amount ?? 0
      ),
    });
  }

  return records;
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
    ? (value[0] ?? null)
    : value;
}
