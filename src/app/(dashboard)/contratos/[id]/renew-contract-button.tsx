"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  RefreshCw,
  X,
} from "lucide-react";

import {
  renewContract,
} from "./actions";

type Props = {
  contractId: string;
  contractTitle: string;
  compact?: boolean;
};

export default function RenewContractButton({
  contractId,
  contractTitle,
  compact = false,
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

  async function handleRenew() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    const result =
      await renewContract(
        contractId
      );

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível renovar o contrato."
      );

      setLoading(false);

      return;
    }

    router.push(
      `/contratos/${result.contractId}`
    );

    router.refresh();
  }

  if (!open) {
    if (compact) {
      return (
        <button
          type="button"
          onClick={() =>
            setOpen(true)
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />

          Renovar
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() =>
          setOpen(true)
        }
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <RefreshCw className="h-4 w-4" />

        Renovar contrato
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Renovar contrato?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Um novo contrato será criado a partir de
              <strong className="font-semibold text-slate-700">
                {" "}
                {contractTitle}
              </strong>
              , com a mesma duração de vigência, começando logo após o término do contrato atual (ou hoje, se ele não tiver data de término).
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

        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          As parcelas, o financeiro e a comissão do novo contrato serão gerados automaticamente, como em um contrato novo. O contrato atual não é apagado nem alterado, além de uma observação registrando a renovação.
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
              handleRenew
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />

            {loading
              ? "Renovando..."
              : "Confirmar renovação"}
          </button>
        </div>
      </div>
    </div>
  );
}
