"use client";

import {
  Plus,
} from "lucide-react";

import {
  useState,
  useTransition,
} from "react";

import {
  createFinancialCategory,
} from "@/app/(dashboard)/configuracoes/categorias-financeiras/actions";

export default function CategoryForm() {
  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    name,
    setName,
  ] = useState("");

  const [
    type,
    setType,
  ] =
    useState<
      | "income"
      | "expense"
    >("income");

  const [
    message,
    setMessage,
  ] = useState("");

  function submit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    const formData =
      new FormData();

    formData.set(
      "name",
      name
    );

    formData.set(
      "type",
      type
    );

    startTransition(
      async () => {
        const result =
          await createFinancialCategory(
            formData
          );

        if (
          !result.success
        ) {
          setMessage(
            result.message ??
              "Erro ao cadastrar."
          );

          return;
        }

        setName("");
      }
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div>
        <h2 className="font-semibold text-slate-900">
          Nova categoria
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Cadastre categorias para organizar seus lançamentos financeiros.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_auto]">
        <input
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
          }
          placeholder="Ex.: Publicidade, Assinaturas, Energia..."
          className="h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#15704f]"
        />

        <select
          value={type}
          onChange={(event) =>
            setType(
              event.target.value as
                | "income"
                | "expense"
            )
          }
          className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#15704f]"
        >
          <option value="income">
            Receita
          </option>

          <option value="expense">
            Despesa
          </option>
        </select>

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />

          {pending
            ? "Salvando..."
            : "Adicionar"}
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}
    </form>
  );
}