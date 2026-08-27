"use client";

import {
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  X,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  closeEditionWithValidation,
} from "./close-edition-actions";

type Props = {
  editionId: string;

  editionName: string;

  totalPublications: number;

  contractPublications: number;

  standalonePublications: number;

  totalClients: number;

  totalAmount: number;

  salesGoal: number;

  pendingContractPublications: number;

  pendingStandalonePublications: number;

  draftSales: number;

  blockedUsedPositions: number;

  inactiveUsedPositions: number;
};

export function CloseEditionButton({
  editionId,
  editionName,
  totalPublications,
  contractPublications,
  standalonePublications,
  totalClients,
  totalAmount,
  salesGoal,
  pendingContractPublications,
  pendingStandalonePublications,
  draftSales,
  blockedUsedPositions,
  inactiveUsedPositions,
}: Props) {
  const router =
    useRouter();

  const [
    open,
    setOpen,
  ] =
    useState(
      false
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    serverIssues,
    setServerIssues,
  ] =
    useState<
      string[]
    >([]);

  const knownIssues =
    pendingContractPublications +
    pendingStandalonePublications +
    draftSales +
    blockedUsedPositions +
    inactiveUsedPositions;

  const canClose =
    knownIssues ===
    0;

  async function handleClose() {
    setLoading(
      true
    );

    setError("");

    setServerIssues(
      []
    );

    const result =
      await closeEditionWithValidation(
        editionId
      );

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível fechar a edição."
      );

      setServerIssues(
        result.issues ??
          []
      );

      setLoading(
        false
      );

      return;
    }

    setLoading(
      false
    );

    setOpen(
      false
    );

    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");

          setServerIssues(
            []
          );

          setOpen(
            true
          );
        }}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
      >
        <LockKeyhole className="h-4 w-4" />

        Fechar edição
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Fechar edição
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Revise a montagem antes de concluir.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  loading
                }
                onClick={() =>
                  setOpen(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Edição
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {
                    editionName
                  }
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Summary
                  label="Publicações"
                  value={
                    String(
                      totalPublications
                    )
                  }
                />

                <Summary
                  label="Clientes"
                  value={
                    String(
                      totalClients
                    )
                  }
                />

                <Summary
                  label="Via contratos"
                  value={
                    String(
                      contractPublications
                    )
                  }
                />

                <Summary
                  label="Vendas avulsas"
                  value={
                    String(
                      standalonePublications
                    )
                  }
                />

                <Summary
                  label="Total vinculado"
                  value={
                    formatCurrency(
                      totalAmount
                    )
                  }
                />

                <Summary
                  label="Meta"
                  value={
                    salesGoal >
                    0
                      ? formatCurrency(
                          salesGoal
                        )
                      : "Sem meta"
                  }
                />
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  Validação operacional
                </h3>

                {canClose ? (
                  <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                      <div>
                        <p className="text-sm font-semibold text-emerald-800">
                          Edição pronta para fechamento
                        </p>

                        <p className="mt-1 text-xs leading-5 text-emerald-700">
                          Não encontramos pendências operacionais conhecidas.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                      <div>
                        <p className="text-sm font-semibold text-amber-800">
                          Existem pendências
                        </p>

                        <div className="mt-3 space-y-2">
                          {pendingContractPublications >
                            0 && (
                            <Issue>
                              {
                                pendingContractPublications
                              }{" "}
                              publicação(ões) de contrato estão sem posição ou tamanho.
                            </Issue>
                          )}

                          {pendingStandalonePublications >
                            0 && (
                            <Issue>
                              {
                                pendingStandalonePublications
                              }{" "}
                              anúncio(s) avulso(s) estão sem posição ou tamanho.
                            </Issue>
                          )}

                          {draftSales >
                            0 && (
                            <Issue>
                              {
                                draftSales
                              }{" "}
                              venda(s) avulsa(s) estão em rascunho.
                            </Issue>
                          )}

                          {blockedUsedPositions >
                            0 && (
                            <Issue>
                              {
                                blockedUsedPositions
                              }{" "}
                              posição(ões) utilizadas estão bloqueadas.
                            </Issue>
                          )}

                          {inactiveUsedPositions >
                            0 && (
                            <Issue>
                              {
                                inactiveUsedPositions
                              }{" "}
                              posição(ões) utilizadas estão inativas.
                            </Issue>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700">
                    {
                      error
                    }
                  </p>

                  {serverIssues.length >
                    0 && (
                    <div className="mt-3 space-y-1">
                      {serverIssues.map(
                        (
                          issue,
                          index
                        ) => (
                          <p
                            key={
                              index
                            }
                            className="text-xs leading-5 text-red-600"
                          >
                            •{" "}
                            {
                              issue
                            }
                          </p>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Depois do fechamento
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  A edição deixa de aceitar novas vendas, publicações, mudanças de posição e alterações dos cadernos. O histórico comercial permanece preservado.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
              <button
                type="button"
                disabled={
                  loading
                }
                onClick={() =>
                  setOpen(
                    false
                  )
                }
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={
                  loading ||
                  !canClose
                }
                onClick={
                  handleClose
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <LockKeyhole className="h-4 w-4" />

                {loading
                  ? "Fechando..."
                  : "Confirmar fechamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-400">
        {
          label
        }
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-900">
        {
          value
        }
      </p>
    </div>
  );
}

function Issue({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <p className="text-xs leading-5 text-amber-700">
      •{" "}
      {
        children
      }
    </p>
  );
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",
    }
  ).format(
    Number.isFinite(
      value
    )
      ? value
      : 0
  );
}