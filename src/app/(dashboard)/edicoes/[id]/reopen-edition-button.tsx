"use client";

import {
  useState,
} from "react";

import {
  RotateCcw,
  X,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  reopenEdition,
} from "./close-edition-actions";

type Props = {
  editionId: string;
  editionName: string;
};

export function ReopenEditionButton({
  editionId,
  editionName,
}: Props) {
  const router =
    useRouter();

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  async function handleReopen() {
    setLoading(true);
    setError("");

    const result =
      await reopenEdition(
        editionId
      );

    if (!result.success) {
      setError(
        result.error ??
          "Não foi possível reabrir a edição."
      );

      setLoading(false);

      return;
    }

    setOpen(false);
    setLoading(false);

    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
      >
        <RotateCcw className="h-4 w-4" />

        Reabrir edição
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Reabrir edição
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editionName}
                </p>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  setOpen(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm leading-6 text-slate-600">
                Ao reabrir esta edição, ela voltará a aceitar alterações de publicações, posições, cadernos e vendas.
              </p>

              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                Use esta opção somente quando for necessário corrigir ou alterar uma edição já fechada.
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  setOpen(false)
                }
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={
                  handleReopen
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />

                {loading
                  ? "Reabrindo..."
                  : "Confirmar reabertura"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}