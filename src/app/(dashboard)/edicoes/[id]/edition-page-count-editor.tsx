"use client";

import {
  FormEvent,
  useState,
  useTransition,
} from "react";

import {
  Check,
  FileText,
  Pencil,
  X,
} from "lucide-react";

import { updateEditionPageCount } from "../actions";

type Props = {
  editionId: string;
  pageCount: number | null;
  canEdit: boolean;
};

export default function EditionPageCountEditor({
  editionId,
  pageCount,
  canEdit,
}: Props) {
  const [editing, setEditing] =
    useState(false);

  const [value, setValue] = useState(
    pageCount != null
      ? String(pageCount)
      : ""
  );

  const [error, setError] =
    useState("");

  const [isPending, startTransition] =
    useTransition();

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    const trimmed = value.trim();

    const parsed = trimmed
      ? Number(trimmed)
      : null;

    if (
      parsed !== null &&
      (!Number.isFinite(parsed) ||
        parsed <= 0)
    ) {
      setError("Valor inválido.");
      return;
    }

    startTransition(async () => {
      const result =
        await updateEditionPageCount(
          editionId,
          parsed
        );

      if (!result.success) {
        setError(
          result.message ??
            "Não foi possível salvar."
        );
        return;
      }

      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <FileText className="h-4 w-4" />

        {pageCount != null
          ? `${pageCount} páginas`
          : "Nº de páginas não definido"}

        {canEdit && (
          <button
            type="button"
            onClick={() =>
              setEditing(true)
            }
            className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-[#15704f] transition hover:underline"
          >
            <Pencil className="h-3 w-3" />
            {pageCount != null
              ? "editar"
              : "definir"}
          </button>
        )}
      </span>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="inline-flex items-center gap-2"
    >
      <input
        autoFocus
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(e) =>
          setValue(e.target.value)
        }
        placeholder="Ex.: 24"
        className="h-8 w-24 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-[#15704f]"
      />

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#15704f] text-white transition hover:bg-[#105c41] disabled:opacity-60"
      >
        <Check className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError("");
          setValue(
            pageCount != null
              ? String(pageCount)
              : ""
          );
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
      >
        <X className="h-4 w-4" />
      </button>

      {error && (
        <span className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
