import type { createAdminClient } from "@/app/lib/supabase/admin";

type Db = ReturnType<
  typeof createAdminClient
>;

export type ExpenseOrigin = {
  kind: "sale" | "contract";
  clientName: string | null;

  /*
   * "Edição 1801 (Nº 1801)" para venda de anúncio, ou o título do
   * contrato.
   */
  reference: string;

  baseAmount: number;
  percentage: number;
  commissionAmount: number;
  beneficiaryId: string | null;
  href: string | null;
};

type Related<T> = T | T[] | null | undefined;

function first<T>(value: Related<T>): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? (value[0] ?? null)
    : value;
}

/*
 * Do que se trata uma despesa gerada pelo pagamento de comissão:
 * a venda de anúncio (edição) ou o contrato que originou a
 * comissão, e o cliente. O vínculo é feito pelas tabelas de
 * pagamento de comissão (financial_entry_id), então vale também
 * para despesas antigas, cujo texto não tem o cliente. Despesas
 * comuns (sem vínculo) não aparecem no resultado.
 */
export async function loadExpenseOrigins(
  adminDb: Db,
  entryIds: string[]
): Promise<Map<string, ExpenseOrigin>> {
  const result = new Map<
    string,
    ExpenseOrigin
  >();

  if (entryIds.length === 0) {
    return result;
  }

  const [salePayments, contractPayments] =
    await Promise.all([
      adminDb
        .from("commission_payments")
        .select("financial_entry_id, commission_id")
        .in("financial_entry_id", entryIds),

      adminDb
        .from("contract_commission_payments")
        .select("financial_entry_id, commission_id")
        .in("financial_entry_id", entryIds),
    ]);

  const saleLinks = salePayments.data ?? [];
  const contractLinks =
    contractPayments.data ?? [];

  const [saleCommissions, contractCommissions] =
    await Promise.all([
      saleLinks.length > 0
        ? adminDb
            .from("sale_commissions")
            .select(`
              id,
              beneficiary_user_id,
              percentage,
              base_amount,
              amount,
              sale:edition_sales (
                id,
                edition_id,
                client:clients (
                  name
                ),
                edition:newspaper_editions (
                  name,
                  edition_number
                )
              )
            `)
            .in(
              "id",
              saleLinks.map(
                (link) => link.commission_id
              )
            )
        : Promise.resolve({ data: [] }),

      contractLinks.length > 0
        ? adminDb
            .from("contract_commissions")
            .select(`
              id,
              contract_id,
              beneficiary_user_id,
              percentage,
              base_amount,
              amount,
              contract:contracts (
                id,
                title,
                client:clients (
                  name
                )
              )
            `)
            .in(
              "id",
              contractLinks.map(
                (link) => link.commission_id
              )
            )
        : Promise.resolve({ data: [] }),
    ]);

  const saleById = new Map(
    (saleCommissions.data ?? []).map(
      (row) => [row.id, row]
    )
  );

  for (const link of saleLinks) {
    const commission = saleById.get(
      link.commission_id
    );

    if (!commission) {
      continue;
    }

    const sale = first(commission.sale);
    const edition = first(sale?.edition);
    const client = first(sale?.client);

    result.set(link.financial_entry_id, {
      kind: "sale",
      clientName: client?.name ?? null,
      reference: edition
        ? edition.edition_number &&
          !edition.name.includes(
            String(edition.edition_number)
          )
          ? `${edition.name} (Nº ${edition.edition_number})`
          : edition.name
        : "Venda de anúncio",
      baseAmount: Number(
        commission.base_amount ?? 0
      ),
      percentage: Number(
        commission.percentage ?? 0
      ),
      commissionAmount: Number(
        commission.amount ?? 0
      ),
      beneficiaryId:
        commission.beneficiary_user_id ?? null,
      href:
        sale?.edition_id && sale?.id
          ? `/edicoes/${sale.edition_id}/vendas/${sale.id}`
          : null,
    });
  }

  const contractById = new Map(
    (contractCommissions.data ?? []).map(
      (row) => [row.id, row]
    )
  );

  for (const link of contractLinks) {
    const commission = contractById.get(
      link.commission_id
    );

    if (!commission) {
      continue;
    }

    const contract = first(commission.contract);
    const client = first(contract?.client);

    result.set(link.financial_entry_id, {
      kind: "contract",
      clientName: client?.name ?? null,
      reference:
        contract?.title ?? "Contrato",
      baseAmount: Number(
        commission.base_amount ?? 0
      ),
      percentage: Number(
        commission.percentage ?? 0
      ),
      commissionAmount: Number(
        commission.amount ?? 0
      ),
      beneficiaryId:
        commission.beneficiary_user_id ?? null,
      href: contract?.id
        ? `/contratos/${contract.id}`
        : null,
    });
  }

  return result;
}
