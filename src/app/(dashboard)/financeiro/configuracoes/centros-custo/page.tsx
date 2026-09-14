import CostCenterManager from "@/app/components/cost-center-manager";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function CentrosCustoPage() {
  const access =
    await requireModulePermission(
      "financial",
      "edit"
    );

  /*
   * Via service role: a permissão já foi checada acima
   * (financial.edit). RLS bloqueia leitura/escrita em
   * cost_centers pra quem só tem permissão restrita (ex.: só
   * contas a receber ou contratos).
   */
  const supabase = createAdminClient();

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

  const [{ data: centers }, { data: companies }] =
    await Promise.all([
      supabase
        .from("cost_centers")
        .select(`
          id,
          name,
          description,
          company_id,
          active,
          company:companies (
            id,
            name
          )
        `)
        .order("name"),

      companiesQuery,
    ]);

  /*
   * Escopo de empresa: centro de custo sem company_id é
   * compartilhado pelo grupo. Não-admin só vê os
   * compartilhados e os das empresas às quais tem acesso.
   */
  const scopedCenters =
    access.profile.role === "admin"
      ? centers ?? []
      : (centers ?? []).filter(
          (center) =>
            !center.company_id ||
            access.companyIds.includes(
              center.company_id
            )
        );

  return (
    <CostCenterManager
      initialCenters={scopedCenters}
      companies={companies ?? []}
      isAdmin={
        access.profile.role === "admin"
      }
    />
  );
}