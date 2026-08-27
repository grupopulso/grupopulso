"use client";

import Link from "next/link";

import {
  ArrowLeftRight,
  Pencil,
  Trash2,
  X,
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
  moveEditionSale,
} from "../actions";

type Edition = {
  id: string;
  name: string;
};

type Props = {
  editionId: string;
  saleId: string;
  status: string;
  hasReceipts: boolean;
  editionOpen: boolean;
  openEditions: Edition[];
};

export default function SaleActions({
  editionId,
  saleId,
  status,
  hasReceipts,
  editionOpen,
  openEditions,
}: Props) {
  const router = useRouter();

  const [message, setMessage] =
    useState<string | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const [moveOpen, setMoveOpen] =
    useState(false);

  const [
    targetEditionId,
    setTargetEditionId,
  ] = useState("");

  if (status === "cancelled") {
    return null;
  }

  const canEdit =
    editionOpen && !hasReceipts;

  const canCancel = !hasReceipts;

  const canMove =
    editionOpen &&
    openEditions.length > 0;

  function handleCancel() {
    setMessage(null);

    const confirmed = window.confirm(
      "Deseja realmente cancelar esta venda? As contas a receber e comissões vinculadas também serão canceladas."
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result =
        await cancelEditionSale(
          saleId,
          editionId
        );

      if (!result.success) {
        setMessage(
          result.message ??
            "Não foi possível cancelar a venda."
        );

        return;
      }

      router.refresh();
    });
  }

  function handleMove() {
    setMessage(null);

    if (!targetEditionId) {
      setMessage(
        "Selecione a edição de destino."
      );
      return;
    }

    startTransition(async () => {
      const result =
        await moveEditionSale(
          saleId,
          targetEditionId
        );

      if (!result.success) {
        setMessage(
          result.message ??
            "Não foi possível mover a venda."
        );
        return;
      }

      setMoveOpen(false);

      router.push(
        `/edicoes/${targetEditionId}/vendas/${saleId}/editar`
      );

      router.refresh();
    });
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

        {canMove && (
          <button
            type="button"
            onClick={() =>
              setMoveOpen(true)
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f]"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Mover de edição
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isPending
              ? "Processando..."
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
          {message}
        </div>
      )}

      {/* MODAL MOVER */}

      {moveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Mover venda de edição
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Use quando a venda foi cadastrada na edição errada.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMoveOpen(false)
                }
                disabled={isPending}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              <label className="text-sm font-medium text-slate-700">
                Edição de destino
              </label>

              <select
                value={targetEditionId}
                onChange={(event) =>
                  setTargetEditionId(
                    event.target.value
                  )
                }
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
              >
                <option value="">
                  Selecione
                </option>

                {openEditions.map(
                  (edition) => (
                    <option
                      key={edition.id}
                      value={edition.id}
                    >
                      {edition.name}
                    </option>
                  )
                )}
              </select>

              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
                O caderno e a posição de cada anúncio serão limpos (pertencem à edição atual). Depois de mover, edite a venda na edição de destino para reposicionar os anúncios.
              </div>

              {message && (
                <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {message}
                </div>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setMoveOpen(false)
                  }
                  disabled={isPending}
                  className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleMove}
                  disabled={
                    isPending ||
                    !targetEditionId
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  {isPending
                    ? "Movendo..."
                    : "Mover venda"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
