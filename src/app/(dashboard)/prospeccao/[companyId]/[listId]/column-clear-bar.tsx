"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser, X } from "lucide-react";

import {
  bulkClearProspectingLeads,
  type BulkClearFields,
} from "./actions";

const COLUMN_LABELS: Record<
  keyof BulkClearFields,
  string
> = {
  seller: "Vendedor",
  value: "Valor",
  size: "Tamanho",
  status: "Situação",
  billingNote: "Observações",
};

/*
 * Aparece quando há colunas marcadas no cabeçalho: apaga essas
 * colunas em todas as linhas da tela de uma vez (o nome do
 * cliente fica). Situação volta pra "Sem contato".
 */
export default function ColumnClearBar({
  companyId,
  listId,
  columns,
  leadIds,
  totalCount,
  filtered,
  onDone,
}: {
  companyId: string;
  listId: string;
  columns: BulkClearFields;
  leadIds: string[];
  totalCount: number;
  filtered: boolean;
  onDone: () => void;
}) {
  const router = useRouter();

  const [confirming, setConfirming] =
    useState(false);

  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const chosen = (
    Object.keys(COLUMN_LABELS) as (keyof BulkClearFields)[]
  ).filter((key) => columns[key]);

  const chosenLabels = chosen
    .map((key) => COLUMN_LABELS[key])
    .join(", ");

  const rowsLabel = filtered
    ? `das ${leadIds.length} linhas filtradas`
    : `de todas as ${totalCount} linhas`;

  function handleClear() {
    setMessage(null);

    startTransition(async () => {
      const result = await bulkClearProspectingLeads(
        companyId,
        listId,
        leadIds,
        columns
      );

      setConfirming(false);

      if (!result.success) {
        setMessage({
          tone: "error",
          text: result.error,
        });

        return;
      }

      setMessage({
        tone: "success",
        text: `${chosenLabels} apagado(s) em ${result.count} ${
          result.count === 1 ? "linha" : "linhas"
        }.`,
      });

      onDone();
      router.refresh();
    });
  }

  if (chosen.length === 0) {
    return message ? (
      <div
        className={`mt-4 flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
          message.tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-700"
        }`}
      >
        <span>{message.text}</span>

        <button
          type="button"
          onClick={() => setMessage(null)}
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ) : (
      <p className="mt-4 text-xs text-slate-500">
        Para limpar o caderno (ex.: preparar o do ano que vem),
        marque o quadradinho no título das colunas que quer
        apagar.
      </p>
    );
  }

  return (
    <div className="sticky top-0 z-20 mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-sm text-slate-700">
        Apagar <strong>{chosenLabels}</strong> {rowsLabel}.
        {columns.status &&
          " A situação volta para \"Sem contato\"."}
        {" "}O nome do cliente fica.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onDone();
          }}
          disabled={isPending}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancelar
        </button>

        {confirming ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending || leadIds.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            <Eraser className="h-4 w-4" />
            {isPending
              ? "Apagando..."
              : "Confirmar — não dá para desfazer"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={leadIds.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white hover:bg-[#105c41] disabled:opacity-60"
          >
            <Eraser className="h-4 w-4" />
            Apagar colunas marcadas
          </button>
        )}
      </div>

      {message?.tone === "error" && (
        <p className="text-sm text-red-700">
          {message.text}
        </p>
      )}
    </div>
  );
}
