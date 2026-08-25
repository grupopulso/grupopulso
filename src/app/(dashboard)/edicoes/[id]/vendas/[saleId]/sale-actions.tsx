"use client";

import Link from "next/link";

import {
  Pencil,
  Trash2,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  useState,
  useTransition,
} from "react";

import {
  cancelEditionSale,
} from "../actions";

type Props = {
  editionId: string;
  saleId: string;
  status: string;
  hasReceipts: boolean;
  editionOpen: boolean;
};

export default function SaleActions({
  editionId,
  saleId,
  status,
  hasReceipts,
  editionOpen,
}: Props) {
  const router =
    useRouter();

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    isPending,
    startTransition,
  ] =
    useTransition();

  if (
    status ===
    "cancelled"
  ) {
    return null;
  }

  const canEdit =
    editionOpen &&
    !hasReceipts;

  const canCancel =
    !hasReceipts;

  function handleCancel() {
    setMessage(
      null
    );

    const confirmed =
      window.confirm(
        "Deseja realmente cancelar esta venda? As contas a receber e comissões vinculadas também serão canceladas."
      );

    if (
      !confirmed
    ) {
      return;
    }

    startTransition(
      async () => {
        const result =
          await cancelEditionSale(
            saleId,
            editionId
          );

        if (
          !result.success
        ) {
          setMessage(
            result.message ??
              "Não foi possível cancelar a venda."
          );

          return;
        }

        router.refresh();
      }
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {canEdit && (
          <Link
            href={`/edicoes/${editionId}/vendas/${saleId}/editar`}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f]"
          >
            <Pencil className="h-4 w-4" />

            Editar venda
          </Link>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={
              handleCancel
            }
            disabled={
              isPending
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />

            {isPending
              ? "Cancelando..."
              : "Cancelar venda"}
          </button>
        )}
      </div>

      {hasReceipts && (
        <p className="mt-2 max-w-md text-xs leading-5 text-slate-400">
          Esta venda possui recebimentos registrados. Alterações financeiras e cancelamento direto estão bloqueados.
        </p>
      )}

      {message && (
        <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {
            message
          }
        </div>
      )}
    </div>
  );
}