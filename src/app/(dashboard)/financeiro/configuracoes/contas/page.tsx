import FinancialAccountManager from "@/app/components/financial-account-manager";

import { createClient } from "@/app/lib/supabase/server";

export default async function ContasFinanceirasPage() {
  const supabase = await createClient();

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

      supabase
        .from("companies")
        .select("id, name")
        .eq("active", true)
        .order("name"),
    ]);

  return (
    <FinancialAccountManager
      initialAccounts={accounts ?? []}
      companies={companies ?? []}
    />
  );
}