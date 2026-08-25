import CostCenterManager from "@/app/components/cost-center-manager";

import { createClient } from "@/app/lib/supabase/server";

export default async function CentrosCustoPage() {
  const supabase = await createClient();

  const [{ data: centers }, { data: companies }] =
    await Promise.all([
      supabase
        .from("cost_centers")
        .select(`
          id,
          name,
          description,
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
    <CostCenterManager
      initialCenters={centers ?? []}
      companies={companies ?? []}
    />
  );
}