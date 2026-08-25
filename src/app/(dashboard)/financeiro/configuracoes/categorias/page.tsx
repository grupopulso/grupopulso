import CategoryManager from "@/app/components/category-manager";
import { createClient } from "@/app/lib/supabase/server";

export default async function CategoriasPage() {
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