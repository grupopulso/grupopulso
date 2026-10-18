"use client";

import {
  createContext,
  useContext,
  useState,
  useTransition,
} from "react";

import { useRouter } from "next/navigation";

import { FileCheck2, Send, X } from "lucide-react";

import { markChargesDocumentStatus } from "./actions";

type Selection = {
  selected: string[];
  toggle: (id: string) => void;
  setMany: (ids: string[], checked: boolean) => void;
  clear: () => void;
};

const SelectionContext =
  createContext<Selection | null>(null);

function useSelection() {
  const context = useContext(SelectionContext);

  if (!context) {
    throw new Error(
      "Seleção de cobranças fora do provider."
    );
  }

  return context;
}

export function ChargeSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>(
    []
  );

  const value: Selection = {
    selected,

    toggle: (id) =>
      setSelected((current) =>
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
      ),

    setMany: (ids, checked) =>
      setSelected((current) => {
        const rest = current.filter(
          (item) => !ids.includes(item)
        );

        return checked ? [...rest, ...ids] : rest;
      }),

    clear: () => setSelected([]),
  };

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function ChargeCheckbox({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const { selected, toggle } = useSelection();

  return (
    <input
      type="checkbox"
      checked={selected.includes(id)}
      onChange={() => toggle(id)}
      aria-label={`Selecionar ${label}`}
      className="h-4 w-4 cursor-pointer accent-[#15704f]"
    />
  );
}

export function SelectAllCharges({
  ids,
}: {
  ids: string[];
}) {
  const { selected, setMany } = useSelection();

  if (ids.length === 0) {
    return null;
  }

  const allChecked = ids.every((id) =>
    selected.includes(id)
  );

  return (
    <input
      type="checkbox"
      checked={allChecked}
      onChange={() => setMany(ids, !allChecked)}
      aria-label="Marcar todos da lista"
      title="Marcar todos da lista"
      className="h-4 w-4 cursor-pointer accent-[#15704f]"
    />
  );
}

/*
 * Barra que aparece com itens marcados: marca todos de uma vez
 * como "cobrança enviada" ou "nota fiscal emitida".
 */
export function ChargeActionBar({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const router = useRouter();

  const { selected, clear } = useSelection();

  const [date, setDate] = useState(today());

  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const [isPending, startTransition] =
    useTransition();

  function handleMark(field: "charge" | "invoice") {
    setMessage(null);

    startTransition(async () => {
      const result = await markChargesDocumentStatus(
        selected,
        { field, date }
      );

      if (!result.success) {
        setMessage({
          tone: "error",
          text: result.message,
        });

        return;
      }

      setMessage({
        tone: "success",
        text: `${result.count} ${
          result.count === 1
            ? "lançamento marcado"
            : "lançamentos marcados"
        } como ${
          field === "charge"
            ? "cobrança enviada"
            : "nota fiscal emitida"
        }.`,
      });

      clear();
      router.refresh();
    });
  }

  if (!canEdit) {
    return null;
  }

  if (selected.length === 0) {
    return message ? (
      <div
        className={`flex items-center justify-between gap-3 border-b px-6 py-3 text-sm ${
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

  return (
    <div className="sticky top-0 z-20 border-b border-emerald-200 bg-emerald-50 px-6 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-slate-700">
          <strong className="text-slate-900">
            {selected.length}{" "}
            {selected.length === 1
              ? "lançamento selecionado"
              : "lançamentos selecionados"}
          </strong>
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Data
            <input
              type="date"
              value={date}
              onChange={(event) =>
                setDate(event.target.value)
              }
              disabled={isPending}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
            />
          </label>

          <button
            type="button"
            onClick={() => handleMark("charge")}
            disabled={isPending || !date}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            Cobrança enviada
          </button>

          <button
            type="button"
            onClick={() => handleMark("invoice")}
            disabled={isPending || !date}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <FileCheck2 className="h-4 w-4" />
            NF emitida
          </button>

          <button
            type="button"
            onClick={clear}
            disabled={isPending}
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            Limpar
          </button>
        </div>
      </div>

      {message?.tone === "error" && (
        <p className="mt-2 text-sm text-red-700">
          {message.text}
        </p>
      )}
    </div>
  );
}

function today() {
  const date = new Date();

  const month = String(date.getMonth() + 1).padStart(
    2,
    "0"
  );

  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}
