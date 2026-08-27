"use client";

import { FormEvent, useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { createFinancialCategory } from "@/app/(dashboard)/financeiro/configuracoes/actions";

type Category = {
  id: string;
  name: string;
  type: string;
  active: boolean;
};

export default function CategoryManager({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const [categories, setCategories] =
    useState(initialCategories);

  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await createFinancialCategory({
        name,
        type,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setCategories((current) =>
        [...current, result.category].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setName("");
    });
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-slate-900">
          Categorias Financeiras
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Organize receitas e despesas por categoria.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-7 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:flex-row"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da categoria"
            required
            className="input flex-1"
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input md:max-w-[220px]"
          >
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
            <option value="both">Ambos</option>
          </select>

          <button
            disabled={isPending}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {isPending ? "Adicionando..." : "Adicionar"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between border-b border-slate-100 px-5 py-4 last:border-0"
            >
              <span className="font-medium text-slate-800">
                {category.name}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {getType(category.type)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function getType(type: string) {
  if (type === "income") return "Receita";
  if (type === "expense") return "Despesa";

  return "Receita e despesa";
}