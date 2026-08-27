import CategoryManager from "@/app/components/category-manager";
import { createClient } from "@/app/lib/supabase/server";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function CategoriasPage() {
  await requireModulePermission(
    "financial",
    "edit"
  );

  const supabase = await createClient();

  const { data } = await supabase
    .from("financial_categories")
    .select("id, name, type, active")
    .order("name");

  return (
    <CategoryManager
      initialCategories={data ?? []}
    />
  );
}