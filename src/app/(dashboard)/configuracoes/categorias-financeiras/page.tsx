import {
  CircleDollarSign,
  Plus,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import CategoryForm from "@/app/components/category-form";
import CategoryActions from "@/app/components/category-actions";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function CategoriasFinanceirasPage() {
    await requireModulePermission(
  "settings",
  "view"
);
  const supabase =
    await createClient();

  const {
    data: categories,
    error,
  } = await supabase
    .from("financial_categories")
    .select(`
      id,
      name,
      type,
      active,
      created_at
    `)
    .order("type")
    .order("name");

  if (error) {
    console.error(
      "Erro ao carregar categorias financeiras:",
      error
    );
  }

  const incomeCategories =
    categories?.filter(
      (category) =>
        category.type ===
        "income"
    ) ?? [];

  const expenseCategories =
    categories?.filter(
      (category) =>
        category.type ===
        "expense"
    ) ?? [];

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
                <CircleDollarSign className="h-5 w-5 text-[#15704f]" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Categorias Financeiras
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Organize receitas e despesas por categoria.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7">
          <CategoryForm />
        </div>

        <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <CategoryList
            title="Categorias de Receita"
            type="income"
            categories={
              incomeCategories
            }
          />

          <CategoryList
            title="Categorias de Despesa"
            type="expense"
            categories={
              expenseCategories
            }
          />
        </div>
      </div>
    </main>
  );
}

function CategoryList({
  title,
  type,
  categories,
}: {
  title: string;
  type:
    | "income"
    | "expense";
  categories: {
    id: string;
    name: string;
    type: string;
    active: boolean;
  }[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div>
          <h2 className="font-semibold text-slate-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {categories.length}{" "}
            {categories.length === 1
              ? "categoria"
              : "categorias"}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            type === "income"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          <CircleDollarSign className="h-5 w-5" />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {categories.map(
          (category) => (
            <div
              key={category.id}
              className="flex items-center justify-between gap-4 p-5"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {category.name}
                </p>

                <span
                  className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    category.active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {category.active
                    ? "Ativa"
                    : "Inativa"}
                </span>
              </div>

              <CategoryActions
                category={{
                  id: category.id,
                  name:
                    category.name,
                  type:
                    category.type,
                  active:
                    category.active,
                }}
              />
            </div>
          )
        )}

        {!categories.length && (
          <div className="p-12 text-center">
            <Plus className="mx-auto h-6 w-6 text-slate-300" />

            <p className="mt-3 text-sm text-slate-400">
              Nenhuma categoria cadastrada.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}