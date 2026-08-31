"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  Ban,
  CheckCircle2,
  ChevronDown,
  LayoutGrid,
  Unlock,
} from "lucide-react";

import { setEditionAdPositionBlocked } from "./sections-actions";

type PositionBuyer = {
  clientName: string;
  sizeDescription: string | null;
  source: "sale" | "contract";
};

type Position = {
  id: string;
  name: string;
  positionCode: string;
  capacity: number | null;
  manuallyBlocked: boolean;
  blockedReason: string | null;
  active: boolean;
  soldCount: number;
  buyers: PositionBuyer[];
};

export default function EditionGeneralPositions({
  editionId,
  editionOpen,
  positions,
}: {
  editionId: string;
  editionOpen: boolean;
  positions: Position[];
}) {
  const [isPending, startTransition] =
    useTransition();

  const [message, setMessage] = useState<
    | { type: "error" | "success"; text: string }
    | null
  >(null);

  const [
    expandedPositionId,
    setExpandedPositionId,
  ] = useState<string | null>(null);

  function handleToggle(position: Position) {
    setMessage(null);

    startTransition(async () => {
      const blocked =
        !position.manuallyBlocked;

      const result =
        await setEditionAdPositionBlocked(
          position.id,
          editionId,
          blocked,
          blocked ? "Esgotado" : undefined
        );

      if (!result.success) {
        setMessage({
          type: "error",
          text:
            result.message ??
            "Não foi possível alterar a posição.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: blocked
          ? `${position.name} marcada como esgotada.`
          : `${position.name} reaberta.`,
      });
    });
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-[#15704f]" />

          <h2 className="font-semibold text-slate-900">
            Posições da edição
          </h2>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Capa, contracapa e demais espaços da edição que não pertencem a um caderno. Marque como esgotado quando o espaço for vendido.
        </p>
      </div>

      {message && (
        <div
          className={`mx-6 mt-4 rounded-xl px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="divide-y divide-slate-100 p-6">
        {positions.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Nenhuma posição geral cadastrada nesta edição.
          </p>
        ) : (
          positions.map((position) => {
            const status = !position.active
              ? "inactive"
              : position.manuallyBlocked
                ? "blocked"
                : "available";

            return (
              <div
                key={position.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {position.name}
                    </p>

                    {status ===
                      "available" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Disponível
                      </span>
                    )}

                    {status ===
                      "blocked" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                        <Ban className="h-3 w-3" />
                        Esgotada
                      </span>
                    )}

                    {status ===
                      "inactive" && (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                        Inativa
                      </span>
                    )}
                  </div>

                  {position.soldCount > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPositionId(
                          (current) =>
                            current === position.id
                              ? null
                              : position.id
                        )
                      }
                      className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 underline decoration-dotted underline-offset-2 transition hover:text-[#15704f]"
                    >
                      Vendas registradas:{" "}
                      <strong className="font-semibold text-slate-700">
                        {position.soldCount}
                      </strong>
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${
                          expandedPositionId === position.id
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </button>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      Vendas registradas:{" "}
                      <strong className="font-semibold text-slate-700">
                        {position.soldCount}
                      </strong>
                    </p>
                  )}

                  {expandedPositionId === position.id && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      {position.buyers.length > 0 ? (
                        <ul className="space-y-1.5">
                          {position.buyers.map((buyer, index) => (
                            <li
                              key={index}
                              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs"
                            >
                              <span className="font-medium text-slate-700">
                                {buyer.clientName}
                              </span>

                              <span className="text-slate-500">
                                {buyer.sizeDescription
                                  ? buyer.sizeDescription
                                  : "Tamanho não informado"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Sem detalhes disponíveis.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {editionOpen &&
                  position.active && (
                    <button
                      type="button"
                      onClick={() =>
                        handleToggle(
                          position
                        )
                      }
                      disabled={isPending}
                      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition disabled:opacity-50 ${
                        position.manuallyBlocked
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600"
                      }`}
                    >
                      {position.manuallyBlocked ? (
                        <>
                          <Unlock className="h-3.5 w-3.5" />
                          Reabrir
                        </>
                      ) : (
                        <>
                          <Ban className="h-3.5 w-3.5" />
                          Esgotar
                        </>
                      )}
                    </button>
                  )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
