"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

import { duplicateProspectingList } from "./actions";

/*
 * Sugestão de nome: troca o ano pelo seguinte ("Natal 2026" →
 * "Natal 2027"); sem ano no nome, acrescenta o próximo ano.
 */
function suggestName(name: string) {
  const match = name.match(/(20\d{2})/);

  if (match) {
    return name.replace(
      match[1],
      String(Number(match[1]) + 1)
    );
  }

  return `${name.trim()} ${new Date().getFullYear() + 1}`;
}

export default function DuplicateListButton({
  companyId,
  listId,
  listName,
}: {
  companyId: string;
  listId: string;
  listName: string;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");

  const [error, setError] = useState("");

  const [isPending, startTransition] =
    useTransition();

  function handleDuplicate() {
    setError("");

    startTransition(async () => {
      const result = await duplicateProspectingList({
        companyId,
        listId,
        name,
      });

      if (!result.success) {
        setError(result.error);

        return;
      }

      setOpen(false);

      router.push(
        `/prospeccao/${companyId}/${result.listId}`
      );
    });
  }

  if (open) {
    return (
      <div
        className="flex flex-col items-end gap-1"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            disabled={isPending}
            maxLength={120}
            aria-label="Nome do novo caderno"
            className="h-8 w-44 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-[#15704f]"
          />

          <button
            type="button"
            disabled={isPending || !name.trim()}
            onClick={handleDuplicate}
            className="rounded-lg bg-[#15704f] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {isPending ? "Copiando..." : "Duplicar"}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600"
          >
            Cancelar
          </button>
        </div>

        <span className="max-w-xs text-right text-[11px] text-slate-500">
          Copia todos os clientes e vendedores. Os vendidos ficam
          como estão; o resto volta para &quot;Sem contato&quot;,
          sem valor e sem cobrança.
        </span>

        {error && (
          <span className="text-[11px] text-red-600">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      title="Duplicar para o próximo ano"
      aria-label={`Duplicar ${listName}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setName(suggestName(listName));
        setError("");
        setOpen(true);
      }}
      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-[#15704f]"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}
