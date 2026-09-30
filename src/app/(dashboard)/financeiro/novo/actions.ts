"use server";

import {
  createAdminClient,
} from "@/app/lib/supabase/admin";

import {
  requireFinancialCreateAccess,
} from "@/app/lib/permissions";

/*
 * Dados auxiliares do lançamento financeiro manual (clientes,
 * fornecedores, categorias, centros de custo, contas, formas de
 * pagamento) buscados com o cliente admin - a leitura via RLS
 * (cliente do navegador) exige o módulo amplo "financial", que
 * usuários com só "accounts_payable"/"accounts_receivable"
 * (ex.: Lely) não têm, e ficavam sem nenhuma opção nos selects
 * de despesa (bug reportado em 30/09). A permissão de criar o
 * lançamento já é validada por requireFinancialCreateAccess().
 */
export async function getFinancialEntryFormData() {
  const { access } =
    await requireFinancialCreateAccess();

  const isAdmin =
    access.profile.role === "admin";

  const scopedCompanyIds = isAdmin
    ? null
    : access.companyIds;

  const adminDb = createAdminClient();

  const [
    clientsResult,
    suppliersResult,
    companiesResult,
    contractsResult,
    categoriesResult,
    costCentersResult,
    financialAccountsResult,
    paymentMethodsResult,
  ] = await Promise.all([
    adminDb
      .from("clients")
      .select("id, name")
      .eq("active", true)
      .order("name"),

    adminDb
      .from("suppliers")
      .select(
        "id, name, trade_name, cpf_cnpj, email, phone"
      )
      .eq("active", true)
      .order("name"),

    adminDb
      .from("companies")
      .select("id, name")
      .eq("active", true)
      .order("name"),

    adminDb
      .from("contracts")
      .select(`
        id,
        client_id,
        company_id,
        product_id,
        title,
        value
      `)
      .neq("status", "cancelled")
      .order("created_at", {
        ascending: false,
      }),

    adminDb
      .from("financial_categories")
      .select("id, name, type")
      .eq("active", true)
      .order("name"),

    adminDb
      .from("cost_centers")
      .select("id, company_id, name")
      .eq("active", true)
      .order("name"),

    adminDb
      .from("financial_accounts")
      .select("id, company_id, name")
      .eq("active", true)
      .order("name"),

    adminDb
      .from("financial_payment_methods")
      .select("id, name, usage_type, active")
      .eq("active", true)
      .order("name"),
  ]);

  for (const [label, result] of [
    ["clientes", clientsResult],
    ["fornecedores", suppliersResult],
    ["empresas", companiesResult],
    ["contratos", contractsResult],
    ["categorias", categoriesResult],
    ["centros de custo", costCentersResult],
    ["contas financeiras", financialAccountsResult],
    ["formas de pagamento", paymentMethodsResult],
  ] as const) {
    if (result.error) {
      console.error(
        `Erro ao carregar ${label} do lançamento financeiro:`,
        result.error
      );
    }
  }

  const inScope = (companyId: string) =>
    !scopedCompanyIds ||
    scopedCompanyIds.includes(companyId);

  const companies = (
    companiesResult.data ?? []
  ).filter((company) =>
    inScope(company.id)
  );

  const contracts = (
    contractsResult.data ?? []
  ).filter((contract) =>
    inScope(contract.company_id)
  );

  const costCenters = (
    costCentersResult.data ?? []
  ).filter(
    (center) =>
      !center.company_id ||
      inScope(center.company_id)
  );

  const financialAccounts = (
    financialAccountsResult.data ?? []
  ).filter(
    (account) =>
      !account.company_id ||
      inScope(account.company_id)
  );

  return {
    clients: clientsResult.data ?? [],
    suppliers: suppliersResult.data ?? [],
    companies,
    contracts,
    categories: categoriesResult.data ?? [],
    costCenters,
    financialAccounts,
    paymentMethods:
      paymentMethodsResult.data ?? [],
  };
}
