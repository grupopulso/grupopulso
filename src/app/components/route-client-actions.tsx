"use client";

import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import {
  useState,
  useTransition,
} from "react";

import {
  moveSubscriber,
  removeSubscriber,
  updateSubscriberNotes,
} from "@/app/(dashboard)/rotas/[id]/actions";

export default function RouteClientActions({
  routeId,
  relationId,
  notes,
  first,
  last,
}: {
  routeId: string;
  relationId: string;
  notes: string | null;
  first: boolean;
  last: boolean;
}) {
  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    value,
    setValue,
  ] = useState(
    notes ?? ""
  );

  function move(
    direction:
      | "up"
      | "down"
  ) {
    startTransition(
      async () => {
        await moveSubscriber(
          routeId,
          relationId,
          direction
        );
      }
    );
  }

  function remove() {
    const confirmed =
      window.confirm(
        "Remover este assinante da rota?"
      );

    if (!confirmed) {
      return;
    }

    startTransition(
      async () => {
        await removeSubscriber(
          routeId,
          relationId
        );
      }
    );
  }

  function saveNotes() {
    startTransition(
      async () => {
        await updateSubscriberNotes(
          routeId,
          relationId,
          value
        );

        setEditing(false);
      }
    );
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={
            first ||
            pending
          }
          onClick={() =>
            move("up")
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
          title="Mover para cima"
        >
          <ArrowUp className="h-4 w-4" />
        </button>

        <button
          type="button"
          disabled={
            last ||
            pending
          }
          onClick={() =>
            move("down")
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
          title="Mover para baixo"
        >
          <ArrowDown className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            setEditing(true)
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
          title="Editar observação"
        >
          <Pencil className="h-4 w-4" />
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          title="Remover da rota"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Observação da entrega
              </h2>

              <button
                type="button"
                onClick={() =>
                  setEditing(
                    false
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={value}
              onChange={(event) =>
                setValue(
                  event.target.value
                )
              }
              rows={5}
              placeholder="Ex.: entregar na recepção, deixar no portão..."
              className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#15704f]"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setEditing(
                    false
                  )
                }
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={
                  saveNotes
                }
                className="h-10 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending
                  ? "Salvando..."
                  : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}