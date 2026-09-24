"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { createProspectingList } from "./actions";

export default function NewListForm({
  companyId,
}: {
  companyId: string;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] =
    useTransition();

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result =
        await createProspectingList({
          companyId,
          name,
        });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(
        `/prospeccao/${companyId}/${result.listId}`
      );
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
      >
        <Plus className="h-4 w-4" />
        Nova lista
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2"
    >
      <input
        autoFocus
        value={name}
        onChange={(event) =>
          setName(event.target.value)
        }
        placeholder="Ex.: Guia de Serviços 2026"
        className="input h-11 w-64"
      />

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending
          ? "Criando..."
          : "Criar"}
      </button>

      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError("");
        }}
        className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
      >
        Cancelar
      </button>

      {error && (
        <span className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
