"use client";

import {
  Trash2,
} from "lucide-react";

import {
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  deletePartnerContribution,
} from "@/app/(dashboard)/financeiro/socios/actions";

export default function DeleteContributionButton({
  contributionId,
  partnerName,
  amountLabel,
}: {
  contributionId: string;
  partnerName: string;
  amountLabel: string;
}) {
  const router = useRouter();

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  function handleDelete() {
    startTransition(
      async () => {
        const result =
          await deletePartnerContribution(
            contributionId
          );

        if (!result.success) {
          setError(
            result.message ??
              "Não foi possível excluir."
          );

          return;
        }

        setOpen(false);
        router.refresh();
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
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
        title="Excluir aporte"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Excluir aporte?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              O aporte de{" "}
              <strong className="font-semibold text-slate-700">
                {amountLabel}
              </strong>{" "}
              de{" "}
              <strong className="font-semibold text-slate-700">
                {partnerName}
              </strong>{" "}
              será excluído, junto com o lançamento correspondente no financeiro.
            </p>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
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
                  : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
