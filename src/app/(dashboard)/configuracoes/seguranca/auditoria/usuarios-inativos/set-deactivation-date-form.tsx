"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setUserDeactivationDate } from "./actions";

export default function SetDeactivationDateForm({
  userId,
}: {
  userId: string;
}) {
  const router = useRouter();

  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] =
    useTransition();

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (!date) {
      setError(
        "Selecione a data de saída."
      );
      return;
    }

    startTransition(async () => {
      const result =
        await setUserDeactivationDate(
          userId,
          date
        );

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2"
    >
      <input
        type="date"
        value={date}
        onChange={(event) =>
          setDate(event.target.value)
        }
        className="input h-9 text-sm"
      />

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-9 items-center rounded-lg bg-slate-800 px-3 text-xs font-semibold text-white disabled:opacity-60"
      >
        {isPending
          ? "Salvando..."
          : "Definir data de saída"}
      </button>

      {error && (
        <span className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
