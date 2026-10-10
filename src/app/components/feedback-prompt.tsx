"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import { X } from "lucide-react";

import { submitSystemFeedback } from "@/app/lib/feedback-actions";

const SNOOZE_KEY =
  "pulso_feedback_snooze_until";

const SNOOZE_MS = 12 * 60 * 60 * 1000;

/*
 * Janela pedindo a avaliação do sistema na entrada: nota de 0 a 5
 * pra cada módulo que a pessoa usa (0 = não uso) + "o que pode
 * melhorar". O servidor só manda show=true pra quem ainda não
 * respondeu; "Responder depois" adia por 12h neste navegador e
 * volta a perguntar na próxima entrada, até a pessoa responder.
 */
export default function FeedbackPrompt({
  show,
  modules,
}: {
  show: boolean;
  modules: { key: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  const [ratings, setRatings] = useState<
    Record<string, number>
  >({});

  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState(false);

  const [isPending, startTransition] =
    useTransition();

  useEffect(() => {
    if (!show) {
      return;
    }

    let snoozedUntil = 0;

    try {
      snoozedUntil = Number(
        window.localStorage.getItem(
          SNOOZE_KEY
        ) ?? 0
      );
    } catch {
      snoozedUntil = 0;
    }

    if (Date.now() > snoozedUntil) {
      setOpen(true);
    }
  }, [show]);

  if (!open) {
    return null;
  }

  function handleLater() {
    try {
      window.localStorage.setItem(
        SNOOZE_KEY,
        String(Date.now() + SNOOZE_MS)
      );
    } catch {
      // sem localStorage: só fecha
    }

    setOpen(false);
  }

  function handleSubmit() {
    setError("");

    startTransition(async () => {
      const result =
        await submitSystemFeedback({
          ratings,
          comment,
        });

      if (!result.success) {
        setError(result.message);

        return;
      }

      setThanks(true);

      window.setTimeout(
        () => setOpen(false),
        2200
      );
    });
  }

  const canSubmit =
    Object.values(ratings).some(
      (value) => value > 0
    ) || comment.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        {!thanks && (
          <button
            type="button"
            onClick={handleLater}
            aria-label="Fechar"
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {thanks ? (
          <div className="px-6 py-12 text-center">
            <p className="text-lg font-semibold text-slate-900">
              Obrigado pela avaliação!
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Sua opinião ajuda a melhorar o
              sistema.
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 pt-6">
              <h2 className="pr-8 text-lg font-semibold text-slate-900">
                Como está sendo usar o sistema?
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Dê uma nota de 0 a 5 para cada
                parte que você usa.{" "}
                <strong>0</strong> = não uso /
                sem opinião, <strong>5</strong> =
                ótimo.
              </p>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto px-6">
              <div className="divide-y divide-slate-100">
                {modules.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {item.label}
                    </span>

                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4, 5].map(
                        (value) => {
                          const selected =
                            ratings[item.key] ===
                            value;

                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setRatings(
                                  (current) => ({
                                    ...current,
                                    [item.key]:
                                      value,
                                  })
                                )
                              }
                              aria-label={`${item.label}: nota ${value}`}
                              className={`h-8 w-8 rounded-lg border text-sm font-semibold transition ${
                                selected
                                  ? value === 0
                                    ? "border-slate-400 bg-slate-500 text-white"
                                    : "border-[#15704f] bg-[#15704f] text-white"
                                  : "border-slate-200 text-slate-500 hover:border-[#15704f]/50"
                              }`}
                            >
                              {value}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <label className="mt-4 block text-sm font-medium text-slate-700">
                O que podemos melhorar?
                <textarea
                  value={comment}
                  onChange={(event) =>
                    setComment(
                      event.target.value
                    )
                  }
                  rows={4}
                  maxLength={1000}
                  placeholder="Conte o que está difícil, o que falta ou o que poderia ser diferente..."
                  className="input mt-2 font-normal"
                />
              </label>

              {error && (
                <p className="mt-2 text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={handleLater}
                disabled={isPending}
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Responder depois
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  isPending || !canSubmit
                }
                className="h-11 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-50"
              >
                {isPending
                  ? "Enviando..."
                  : "Enviar avaliação"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
