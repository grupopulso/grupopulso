"use client";

import {
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import {
  useState,
  useTransition,
} from "react";

import {
  deleteFinancialCategory,
  updateFinancialCategory,
} from "@/app/(dashboard)/configuracoes/categorias-financeiras/actions";

type Category = {
  id: string;
  name: string;
  type: string;
  active: boolean;
};

export default function CategoryActions({
  category,
}: {
  category: Category;
}) {
  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    name,
    setName,
  ] = useState(
    category.name
  );

  const [
    type,
    setType,
  ] = useState(
    category.type
  );

  const [
    active,
    setActive,
  ] = useState(
    category.active
  );

  const [
    error,
    setError,
  ] = useState("");

  function save() {
    setError("");

    startTransition(
      async () => {
        const result =
          await updateFinancialCategory(
            category.id,
            {
              name,
              type,
              active,
            }
          );

        if (
          !result.success
        ) {
          setError(
            result.message ??
              "Erro ao salvar."
          );

          return;
        }

        setEditing(false);
      }
    );
  }

  function remove() {
    const confirmed =
      window.confirm(
        `Excluir a categoria "${category.name}"?`
      );

    if (!confirmed) {
      return;
    }

    setError("");

    startTransition(
      async () => {
        const result =
          await deleteFinancialCategory(
            category.id
          );

        if (
          !result.success
        ) {
          setError(
            result.message ??
              "Não foi possível excluir."
          );
        }
      }
    );
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() =>
            setEditing(true)
          }
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {error && !editing && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-lg">
          {error}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Editar categoria
              </h2>

              <button
                type="button"
                onClick={() =>
                  setEditing(
                    false
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nome
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#15704f]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Tipo
                </label>

                <select
                  value={type}
                  onChange={(event) =>
                    setType(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#15704f]"
                >
                  <option value="income">
                    Receita
                  </option>

                  <option value="expense">
                    Despesa
                  </option>
                </select>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) =>
                    setActive(
                      event.target.checked
                    )
                  }
                  className="mt-1 h-4 w-4 rounded"
                />

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Categoria ativa
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Categorias inativas não devem aparecer em novos lançamentos.
                  </p>
                </div>
              </label>

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setEditing(
                    false
                  )
                }
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={save}
                className="h-10 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-50"
              >
                {pending
                  ? "Salvando..."
                  : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}