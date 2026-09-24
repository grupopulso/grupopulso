"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteProspectingList } from "./actions";

export default function DeleteListButton({
  companyId,
  listId,
  listName,
}: {
  companyId: string;
  listId: string;
  listName: string;
}) {
  const router = useRouter();

  const [confirming, setConfirming] =
    useState(false);

  const [isPending, startTransition] =
    useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteProspectingList(
        companyId,
        listId
      );

      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div
        className="flex items-center gap-2"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <span className="text-xs text-slate-500">
          Excluir &quot;{listName}
          &quot;?
        </span>

        <button
          type="button"
          disabled={isPending}
          onClick={handleDelete}
          className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {isPending
            ? "..."
            : "Confirmar"}
        </button>

        <button
          type="button"
          onClick={() =>
            setConfirming(false)
          }
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setConfirming(true);
      }}
      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
