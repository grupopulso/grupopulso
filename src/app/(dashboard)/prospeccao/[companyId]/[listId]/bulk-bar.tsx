"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Trash2, X } from "lucide-react";

import {
  bulkClearProspectingLeads,
  bulkDeleteProspectingLeads,
  type BulkClearFields,
} from "./actions";

const FIELD_LABELS: {
  key: keyof BulkClearFields;
  label: string;
}[] = [
  { key: "seller", label: "Vendedor" },
  { key: "value", label: "Valor" },
  { key: "size", label: "Tamanho" },
  { key: "status", label: "Situação (volta a Sem contato)" },
  { key: "billingNote", label: "Observações" },
];

/*
 * Barra das linhas marcadas: apaga de uma vez os dados escolhidos
 * (mantém o nome do cliente) ou exclui as linhas.
 */
export default function BulkBar({
  companyId,
  listId,
  selectedIds,
  onClear,
}: {
  companyId: string;
  listId: string;
  selectedIds: string[];
  onClear: () => void;
}) {
  const router = useRouter();

  const [fields, setFields] =
    useState<BulkClearFields>({
      seller: true,
      value: true,
      size: true,
      status: true,
      billingNote: true,
    });

  const [confirmDelete, setConfirmDelete] =
    useState(false);

  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const count = selectedIds.length;

  function run(kind: "clear" | "delete") {
    setMessage(null);

    startTransition(async () => {
      const result =
        kind === "clear"
          ? await bulkClearProspectingLeads(
              companyId,
              listId,
              selectedIds,
              fields
            )
          : await bulkDeleteProspectingLeads(
              companyId,
              listId,
              selectedIds
            );

      if (!result.success) {
        setMessage({
          tone: "error",
          text: result.error,
        });

        return;
      }

      setConfirmDelete(false);

      setMessage({
        tone: "success",
        text: `${result.count} ${
          result.count === 1 ? "linha" : "linhas"
        } ${kind === "clear" ? "limpa(s)" : "excluída(s)"}.`,
      });

      onClear();
      router.refresh();
    });
  }

  if (count === 0) {
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
    ) : null;
  }

  const nothingChecked = !Object.values(fields).some(
    Boolean
  );

  return (
    <div className="sticky top-0 z-20 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-slate-700">
          <strong className="text-slate-900">
            {count}{" "}
            {count === 1
              ? "linha selecionada"
              : "linhas selecionadas"}
          </strong>
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs font-medium text-slate-500">
            Apagar:
          </span>

          {FIELD_LABELS.map((field) => (
            <label
              key={field.key}
              className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={fields[field.key]}
                onChange={(event) =>
                  setFields((current) => ({
                    ...current,
                    [field.key]: event.target.checked,
                  }))
                }
                disabled={isPending}
                className="h-4 w-4 accent-[#15704f]"
              />
              {field.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClear}
          disabled={isPending}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Limpar seleção
        </button>

        {confirmDelete ? (
          <span className="flex items-center gap-2">
            <span className="text-sm text-red-700">
              Excluir {count}{" "}
              {count === 1 ? "linha" : "linhas"} do
              caderno?
            </span>

            <button
              type="button"
              onClick={() => run("delete")}
              disabled={isPending}
              className="h-9 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? "Excluindo..." : "Confirmar"}
            </button>

            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={isPending}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Excluir linhas
          </button>
        )}

        <button
          type="button"
          onClick={() => run("clear")}
          disabled={isPending || nothingChecked}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white hover:bg-[#105c41] disabled:opacity-60"
        >
          <Eraser className="h-4 w-4" />
          {isPending ? "Apagando..." : "Apagar dados marcados"}
        </button>
      </div>

      {message?.tone === "error" && (
        <p className="mt-2 text-sm text-red-700">
          {message.text}
        </p>
      )}
    </div>
  );
}
