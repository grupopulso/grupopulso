import ClientForm from "@/app/components/client-form";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function NovoClientePage() {
  const access =
    await requireModulePermission(
      "clients",
      "create"
    );

  const supabase =
    await createClient();

  let query = supabase
    .from("companies")
    .select("id, name")
    .eq("active", true)
    .order("name");

  /*
   * Usuário não-admin só pode cadastrar cliente nas
   * empresas às quais tem acesso.
   */
  if (
    access.profile.role !== "admin"
  ) {
    query = query.in(
      "id",
      access.companyIds.length > 0
        ? access.companyIds
        : [
            "00000000-0000-0000-0000-000000000000",
          ]
    );
  }

  const { data: companies } =
    await query;

  return (
    <ClientForm
      companies={companies ?? []}
    />
  );
}
