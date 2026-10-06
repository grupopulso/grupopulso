"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Trash2 } from "lucide-react";

import { deleteExpenseEntry } from "./edit-actions";

/*
 * variant "page": botão do cabeçalho do lançamento - depois de
 * excluir volta pra tela anterior (a lista, com os filtros).
 * variant "row": link pequeno da lista - só recarrega a lista.
 */
export default function DeleteExpenseButton({
  entryId,
  description,
  variant = "page",
}: {
  entryId: string;
  description: string;
  variant?: "page" | "row";
}) {
  const router = useRouter();

  const [error, setError] = useState("");

  const [isPending, startTransition] =
    useTransition();

  function handleDelete() {
    setError("");

    if (
      !window.confirm(
        `Excluir a despesa "${description}"? Essa ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result =
        await deleteExpenseEntry(entryId);

      if (!result.success) {
        if (variant === "row") {
          window.alert(result.message);
        } else {
          setError(result.message);
        }

        return;
      }

      if (variant === "row") {
        router.refresh();

        return;
      }

      if (window.history.length > 1) {
        router.back();
      } else {
        router.push("/financeiro/pagar");
      }
    });
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {isPending ? "Excluindo..." : "Excluir"}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        {isPending
          ? "Excluindo..."
          : "Excluir despesa"}
      </button>

      {error && (
        <p className="max-w-xs text-right text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
