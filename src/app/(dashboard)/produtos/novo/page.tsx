import ProductForm from "@/app/components/product-form";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function NovoProdutoPage() {
  const access =
    await requireModulePermission(
      "products",
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
   * Usuário não-admin só pode cadastrar produto nas
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
    <ProductForm
      companies={companies ?? []}
    />
  );
}
