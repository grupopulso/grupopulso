import FinancialAccountManager from "@/app/components/financial-account-manager";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function ContasFinanceirasPage() {
  const access =
    await requireModulePermission(
      "financial",
      "edit"
    );

  const supabase = await createClient();

  let companiesQuery = supabase
    .from("companies")
    .select("id, name")
    .eq("active", true)
    .order("name");

  if (
    access.profile.role !== "admin"
  ) {
    companiesQuery = companiesQuery.in(
      "id",
      access.companyIds.length > 0
        ? access.companyIds
        : [
            "00000000-0000-0000-0000-000000000000",
          ]
    );
  }

  const [{ data: accounts }, { data: companies }] =
    await Promise.all([
      supabase
        .from("financial_accounts")
        .select(`
          id,
          name,
          type,
          bank_name,
          initial_balance,
          company_id,
          company:companies (
            id,
            name
          )
        `)
        .order("name"),

      companiesQuery,
    ]);

  /*
   * Escopo de empresa: conta sem company_id é compartilhada
   * pelo grupo. Não-admin só vê as compartilhadas e as das
   * empresas às quais tem acesso.
   */
  const scopedAccounts =
    access.profile.role === "admin"
      ? accounts ?? []
      : (accounts ?? []).filter(
          (account) =>
            !account.company_id ||
            access.companyIds.includes(
              account.company_id
            )
        );

  return (
    <FinancialAccountManager
      initialAccounts={scopedAccounts}
      companies={companies ?? []}
      isAdmin={
        access.profile.role === "admin"
      }
    />
  );
}