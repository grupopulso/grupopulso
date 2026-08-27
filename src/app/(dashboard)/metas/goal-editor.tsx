"use client";

import {
  FormEvent,
  useState,
  useTransition,
} from "react";

import { Check, Pencil, X } from "lucide-react";

import { saveCompanyGoal } from "./actions";

type Props = {
  companyId: string;
  year: number;
  month: number;
  currentTarget: number | null;
};

export default function GoalEditor({
  companyId,
  year,
  month,
  currentTarget,
}: Props) {
  const [editing, setEditing] =
    useState(false);

  const [value, setValue] = useState(
    currentTarget !== null
      ? formatInputMoney(currentTarget)
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

    const parsed = parseMoney(value);

    if (
      !Number.isFinite(parsed) ||
      parsed < 0
    ) {
      setError("Valor inválido.");
      return;
    }

    startTransition(async () => {
      const result =
        await saveCompanyGoal({
          companyId,
          year,
          month,
          targetAmount: parsed,
        });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15704f] transition hover:underline"
      >
        <Pencil className="h-3.5 w-3.5" />
        {currentTarget !== null
          ? "Editar meta"
          : "Definir meta"}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-1"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            R$
          </span>

          <input
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) =>
              setValue(e.target.value)
            }
            placeholder="0,00"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#15704f] text-white transition hover:bg-[#105c41] disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
            setValue(
              currentTarget !== null
                ? formatInputMoney(
                    currentTarget
                  )
                : ""
            );
          }}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}

function parseMoney(value: string) {
  const clean = value
    .trim()
    .replace(/\s/g, "");

  if (!clean) {
    return 0;
  }

  if (clean.includes(",")) {
    return (
      Number(
        clean
          .replace(/\./g, "")
          .replace(",", ".")
      ) || 0
    );
  }

  return Number(clean) || 0;
}

function formatInputMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
