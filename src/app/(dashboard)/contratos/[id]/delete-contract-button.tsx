"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  Trash2,
  X,
} from "lucide-react";

import {
  deleteContract,
} from "./actions";

type Props = {
  contractId: string;
  contractTitle: string;
};

export default function DeleteContractButton({
  contractId,
  contractTitle,
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

  async function handleDelete() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    const result =
      await deleteContract(
        contractId
      );

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível excluir o contrato."
      );

      setLoading(false);

      return;
    }

    router.push(
      "/contratos"
    );

    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() =>
          setOpen(true)
        }
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />

        Excluir contrato
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Excluir contrato?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Você está prestes a excluir
              <strong className="font-semibold text-slate-700">
                {" "}
                {contractTitle}
              </strong>
              .
            </p>
          </div>

          <button
            type="button"
            disabled={
              loading
            }
            onClick={() =>
              setOpen(false)
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
          Parcelas e contas a receber ainda não pagas vinculadas a este contrato também serão removidas.
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={
              loading
            }
            onClick={() =>
              setOpen(false)
            }
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={
              loading
            }
            onClick={
              handleDelete
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />

            {loading
              ? "Excluindo..."
              : "Excluir definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}