"use client";

import {
  Trash2,
} from "lucide-react";

import {
  useState,
  useTransition,
} from "react";

import {
  deleteDriver,
} from "@/app/(dashboard)/rotas/entregadores/[id]/actions";

export default function DeleteDriverButton({
  driverId,
  driverName,
  routesCount,
}: {
  driverId: string;
  driverName: string;
  routesCount: number;
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    pending,
    startTransition,
  ] = useTransition();

  function handleDelete() {
    startTransition(
      async () => {
        await deleteDriver(
          driverId
        );
      }
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setOpen(true)
        }
        className="flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        Excluir entregador
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Excluir entregador?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              O entregador{" "}
              <strong className="font-semibold text-slate-700">
                {driverName}
              </strong>{" "}
              será removido permanentemente.
            </p>

            {routesCount > 0 && (
              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">
                  {routesCount}{" "}
                  {routesCount === 1
                    ? "rota está vinculada"
                    : "rotas estão vinculadas"}{" "}
                  a este entregador.
                </p>

                <p className="mt-1 text-xs leading-5 text-amber-700">
                  As rotas não serão excluídas. Elas ficarão sem entregador responsável.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  setOpen(false)
                }
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={
                  handleDelete
                }
                className="flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />

                {pending
                  ? "Excluindo..."
                  : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}