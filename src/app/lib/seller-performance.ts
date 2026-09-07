/*
 * =====================================================
 * DESEMPENHO DE VENDEDOR (pra comparar com a meta)
 * =====================================================
 *
 * "Quanto o vendedor vendeu" = valor total das vendas de
 * edição + contratos em que ele é o vendedor de origem
 * (base_amount das comissões, não o valor da comissão em
 * si) — mede o que ele vendeu pra empresa, não o que ele
 * ganhou de comissão.
 *
 * Usa sale_commissions.commission_type = "seller" (não
 * "override") pra contar cada venda avulsa uma única vez —
 * uma venda com override gera uma linha extra com o mesmo
 * base_amount pra outro beneficiário, que não deve entrar
 * na conta de quem vendeu. contract_commissions não tem
 * essa distinção (1 linha por contrato, sempre o vendedor).
 *
 * Período é por `created_at` (quando a venda/comissão foi
 * registrada), o mesmo critério já usado em "Meu painel" —
 * não usa a competência (due_date/start_date) do
 * faturamento, que é uma conta contábil separada.
 */

export type SellerSaleRecord = {
  userId: string;
  companyId: string;
  amount: number;
  createdAt: string;
};

export async function fetchSellerSaleRecords(
  supabase: any,
  params: {
    userIds: string[];
    companyIds: string[];
    periodStart: string;
    periodEndExclusive: string;
  }
): Promise<SellerSaleRecord[]> {
  if (
    params.userIds.length === 0 ||
    params.companyIds.length === 0
  ) {
    return [];
  }

  const [
    salesResult,
    contractsResult,
  ] = await Promise.all([
    supabase
      .from("sale_commissions")
      .select(`
        base_amount,
        source_seller_user_id,
        commission_type,
        status,
        created_at,

        sale:edition_sales (
          company_id
        )
      `)
      .eq(
        "commission_type",
        "seller"
      )
      .neq(
        "status",
        "cancelled"
      )
      .in(
        "source_seller_user_id",
        params.userIds
      )
      .gte(
        "created_at",
        params.periodStart
      )
      .lt(
        "created_at",
        params.periodEndExclusive
      ),

    supabase
      .from("contract_commissions")
      .select(`
        base_amount,
        source_user_id,
        status,
        created_at,

        contract:contracts (
          company_id
        )
      `)
      .neq(
        "status",
        "cancelled"
      )
      .in(
        "source_user_id",
        params.userIds
      )
      .gte(
        "created_at",
        params.periodStart
      )
      .lt(
        "created_at",
        params.periodEndExclusive
      ),
  ]);

  const records: SellerSaleRecord[] =
    [];

  for (const row of salesResult.data ??
    []) {
    const sale = getFirst(
      row.sale
    );

    if (
      !sale ||
      !params.companyIds.includes(
        sale.company_id
      )
    ) {
      continue;
    }

    records.push({
      userId:
        row.source_seller_user_id,
      companyId:
        sale.company_id,
      amount: Number(
        row.base_amount ?? 0
      ),
      createdAt:
        row.created_at,
    });
  }

  for (const row of contractsResult.data ??
    []) {
    const contract = getFirst(
      row.contract
    );

    if (
      !contract ||
      !params.companyIds.includes(
        contract.company_id
      )
    ) {
      continue;
    }

    records.push({
      userId:
        row.source_user_id,
      companyId:
        contract.company_id,
      amount: Number(
        row.base_amount ?? 0
      ),
      createdAt:
        row.created_at,
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
