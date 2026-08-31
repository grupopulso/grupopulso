"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  Ban,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Goal,
  InfinityIcon,
  Pencil,
  Plus,
  Power,
  Save,
  Settings2,
  Trash2,
  Unlock,
  X,
} from "lucide-react";

import {
  createEditionSection,
  deleteEditionSection,
  setEditionAdPositionBlocked,
  setEditionSectionActive,
  updateEditionAdPositionCapacity,
  updateEditionSection,
} from "./sections-actions";

/*
 * =====================================================
 * TIPOS
 * =====================================================
 */

type PositionBuyer = {
  clientName: string;

  sizeDescription:
    string | null;

  source:
    "sale" | "contract";
};

type Position = {
  id: string;

  positionCode:
    string;

  name:
    string;

  capacity:
    number | null;

  soldCount:
    number;

  buyers:
    PositionBuyer[];

  manuallyBlocked:
    boolean;

  blockedReason:
    string | null;

  active:
    boolean;

  exhausted:
    boolean;
};

type Section = {
  id: string;

  name: string;

  description:
    string | null;

  active:
    boolean;

  salesGoal:
    number;

  soldAmount:
    number;

  remainingAmount:
    number;

  progressPercentage:
    number;

  positions:
    Position[];
};

type Props = {
  editionId: string;

  editionOpen:
    boolean;

  sections:
    Section[];
};

/*
 * =====================================================
 * COMPONENTE
 * =====================================================
 */

export default function SectionsManagement({
  editionId,
  editionOpen,
  sections,
}: Props) {
  /*
   * =====================================================
   * FORMULÁRIO DO CADERNO
   * =====================================================
   */

  const [
    name,
    setName,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    salesGoal,
    setSalesGoal,
  ] =
    useState("");

  const [
    editingId,
    setEditingId,
  ] =
    useState<
      string | null
    >(null);

  /*
   * =====================================================
   * CAPACIDADES DAS POSIÇÕES
   * =====================================================
   */

  const [
    capacityValues,
    setCapacityValues,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  /*
   * =====================================================
   * COMPRADORES DA POSIÇÃO (expandir "Utilizado: N")
   * =====================================================
   */

  const [
    expandedPositionId,
    setExpandedPositionId,
  ] =
    useState<
      string | null
    >(null);

  /*
   * =====================================================
   * MENSAGEM
   * =====================================================
   */

  const [
    message,
    setMessage,
  ] =
    useState<{
      type:
        | "success"
        | "error";

      text:
        string;
    } | null>(
      null
    );

  const [
    isPending,
    startTransition,
  ] =
    useTransition();

  const isEditing =
    Boolean(
      editingId
    );

  /*
   * =====================================================
   * RESET
   * =====================================================
   */

  function resetForm() {
    setName("");

    setDescription("");

    setSalesGoal("");

    setEditingId(
      null
    );
  }

  /*
   * =====================================================
   * EDITAR CADERNO
   * =====================================================
   */

  function handleEdit(
    section:
      Section
  ) {
    setEditingId(
      section.id
    );

    setName(
      section.name
    );

    setDescription(
      section.description ??
        ""
    );

    setSalesGoal(
      formatEditableMoney(
        section.salesGoal
      )
    );

    setMessage(
      null
    );
  }

  function handleCancelEdit() {
    resetForm();

    setMessage(
      null
    );
  }

  /*
   * =====================================================
   * SALVAR CADERNO
   * =====================================================
   */

  function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage(
      null
    );

    if (
      !name.trim()
    ) {
      setMessage({
        type:
          "error",

        text:
          "Informe o nome do caderno.",
      });

      return;
    }

    const numericSalesGoal =
      parseMoney(
        salesGoal
      );

    if (
      !Number.isFinite(
        numericSalesGoal
      ) ||
      numericSalesGoal <
        0
    ) {
      setMessage({
        type:
          "error",

        text:
          "Informe uma meta válida para o caderno.",
      });

      return;
    }

    startTransition(
      async () => {
        const result =
          editingId
            ? await updateEditionSection({
                id:
                  editingId,

                editionId,

                name:
                  name.trim(),

                description:
                  description.trim(),

                salesGoal:
                  numericSalesGoal,
              })
            : await createEditionSection({
                editionId,

                name:
                  name.trim(),

                description:
                  description.trim(),

                salesGoal:
                  numericSalesGoal,
              });

        if (
          !result.success
        ) {
          setMessage({
            type:
              "error",

            text:
              result.message ??
              "Não foi possível salvar o caderno.",
          });

          return;
        }

        setMessage({
          type:
            "success",

          text:
            editingId
              ? "Caderno atualizado com sucesso."
              : "Caderno adicionado com sucesso.",
        });

        resetForm();
      }
    );
  }

  /*
   * =====================================================
   * ATIVAR / DESATIVAR CADERNO
   * =====================================================
   */

  function handleDelete(
    section: Section
  ) {
    if (
      !window.confirm(
        `Excluir o caderno "${section.name}"? As posições dele serão removidas. Essa ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const result =
        await deleteEditionSection(
          section.id,
          editionId
        );

      if (!result.success) {
        setMessage({
          type: "error",
          text:
            result.message ??
            "Não foi possível excluir o caderno.",
        });

        return;
      }

      setMessage({
        type: "success",
        text: "Caderno excluído.",
      });
    });
  }

  function handleToggle(
    section:
      Section
  ) {
    setMessage(
      null
    );

    startTransition(
      async () => {
        const result =
          await setEditionSectionActive(
            section.id,
            editionId,
            !section.active
          );

        if (
          !result.success
        ) {
          setMessage({
            type:
              "error",

            text:
              result.message ??
              "Não foi possível alterar o caderno.",
          });

          return;
        }

        setMessage({
          type:
            "success",

          text:
            section.active
              ? "Caderno desativado."
              : "Caderno ativado.",
        });
      }
    );
  }

  /*
   * =====================================================
   * BLOQUEAR / DESBLOQUEAR POSIÇÃO
   * =====================================================
   */

  function handlePositionBlocked(
    position:
      Position
  ) {
    setMessage(
      null
    );

    startTransition(
      async () => {
        const blocked =
          !position
            .manuallyBlocked;

        const result =
          await setEditionAdPositionBlocked(
            position.id,
            editionId,
            blocked,
            blocked ? "Esgotado" : undefined
          );

        if (
          !result.success
        ) {
          setMessage({
            type:
              "error",

            text:
              result.message ??
              "Não foi possível alterar a posição.",
          });

          return;
        }

        setMessage({
          type:
            "success",

          text:
            blocked
              ? `${position.name} marcada como esgotada.`
              : `${position.name} reaberta.`,
        });
      }
    );
  }

  /*
   * =====================================================
   * CAPACIDADE
   * =====================================================
   */

  function getCapacityValue(
    position:
      Position
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        capacityValues,
        position.id
      )
    ) {
      return (
        capacityValues[
          position.id
        ] ??
        ""
      );
    }

    return position.capacity ===
      null
      ? ""
      : String(
          position.capacity
        );
  }

  function setCapacityValue(
    positionId:
      string,
    value:
      string
  ) {
    setCapacityValues(
      (
        current
      ) => ({
        ...current,

        [positionId]:
          value,
      })
    );
  }

  function handleCapacitySave(
    position:
      Position
  ) {
    const value =
      getCapacityValue(
        position
      ).trim();

    /*
     * Campo vazio =
     * capacidade ilimitada.
     */

    const capacity =
      value ===
      ""
        ? null
        : Number(
            value
          );

    if (
      capacity !==
        null &&
      (
        !Number.isInteger(
          capacity
        ) ||
        capacity <
          1
      )
    ) {
      setMessage({
        type:
          "error",

        text:
          `Informe uma capacidade válida para ${position.name}.`,
      });

      return;
    }

    setMessage(
      null
    );

    startTransition(
      async () => {
        const result =
          await updateEditionAdPositionCapacity(
            position.id,
            editionId,
            capacity
          );

        if (
          !result.success
        ) {
          setMessage({
            type:
              "error",

            text:
              result.message ??
              "Não foi possível alterar a capacidade.",
          });

          return;
        }

        setMessage({
          type:
            "success",

          text:
            capacity ===
            null
              ? `${position.name} agora possui capacidade ilimitada.`
              : `Capacidade de ${position.name} atualizada para ${capacity}.`,
        });

        setCapacityValues(
          (
            current
          ) => {
            const next = {
              ...current,
            };

            delete next[
              position.id
            ];

            return next;
          }
        );
      }
    );
  }

  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">

      {/* =================================================
          CABEÇALHO
         ================================================= */}

      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[#15704f]" />

          <h2 className="font-semibold text-slate-900">
            Cadernos da edição
          </h2>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Acompanhe as metas comerciais, vendas e disponibilidade das posições de cada caderno.
        </p>
      </div>

      {/* =================================================
          FORMULÁRIO
         ================================================= */}

      {editionOpen && (
        <form
          onSubmit={
            handleSubmit
          }
          className="border-b border-slate-100 bg-slate-50/40 p-6"
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">

            {/* NOME */}

            <div>
              <label className="text-sm font-medium text-slate-700">
                Nome do caderno
              </label>

              <input
                type="text"
                value={
                  name
                }
                onChange={(
                  event
                ) =>
                  setName(
                    event.target
                      .value
                  )
                }
                placeholder="Ex.: Especial Agro"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#15704f]"
              />
            </div>

            {/* META */}

            <div>
              <label className="text-sm font-medium text-slate-700">
                Meta de vendas
              </label>

              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  R$
                </span>

                <input
                  value={
                    salesGoal
                  }
                  onChange={(
                    event
                  ) =>
                    setSalesGoal(
                      event.target
                        .value
                    )
                  }
                  inputMode="decimal"
                  placeholder="0,00"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#15704f]"
                />
              </div>
            </div>

            {/* DESCRIÇÃO */}

            <div>
              <label className="text-sm font-medium text-slate-700">
                Descrição
              </label>

              <input
                type="text"
                value={
                  description
                }
                onChange={(
                  event
                ) =>
                  setDescription(
                    event.target
                      .value
                  )
                }
                placeholder="Opcional"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#15704f]"
              />
            </div>

            {/* AÇÕES */}

            <div className="flex gap-2">
              {isEditing && (
                <button
                  type="button"
                  disabled={
                    isPending
                  }
                  onClick={
                    handleCancelEdit
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />

                  Cancelar
                </button>
              )}

              <button
                type="submit"
                disabled={
                  isPending
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEditing ? (
                  <Save className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}

                {isPending
                  ? "Salvando..."
                  : isEditing
                    ? "Salvar"
                    : "Adicionar"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* =================================================
          MENSAGEM
         ================================================= */}

      {message && (
        <div
          className={`mx-6 mt-5 rounded-xl px-4 py-3 text-sm ${
            message.type ===
            "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {
            message.text
          }
        </div>
      )}

      {/* =================================================
          CADERNOS
         ================================================= */}

      {sections.length >
      0 ? (
        <div className="space-y-6 p-6">
          {sections.map(
            (
              section
            ) => {
              const progressBar =
                Math.min(
                  Math.max(
                    section.progressPercentage,
                    0
                  ),
                  100
                );

              return (
                <div
                  key={
                    section.id
                  }
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  {/* CABEÇALHO DO CADERNO */}

                  <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-5 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {
                            section.name
                          }
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            section.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {section.active
                            ? "Ativo"
                            : "Inativo"}
                        </span>
                      </div>

                      {section.description && (
                        <p className="mt-1 text-sm text-slate-500">
                          {
                            section.description
                          }
                        </p>
                      )}
                    </div>

                    {editionOpen && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleEdit(
                              section
                            )
                          }
                          disabled={
                            isPending
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f] disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />

                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggle(
                              section
                            )
                          }
                          disabled={
                            isPending
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f] disabled:opacity-50"
                        >
                          <Power className="h-3.5 w-3.5" />

                          {section.active
                            ? "Desativar"
                            : "Ativar"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              section
                            )
                          }
                          disabled={
                            isPending
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />

                          Excluir
                        </button>
                      </div>
                    )}
                  </div>

                  {/* META */}

                  <div className="p-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricCard
                        label="Meta"
                        value={
                          formatCurrency(
                            section.salesGoal
                          )
                        }
                      />

                      <MetricCard
                        label="Vendido"
                        value={
                          formatCurrency(
                            section.soldAmount
                          )
                        }
                        highlighted
                      />

                      <MetricCard
                        label="Falta"
                        value={
                          formatCurrency(
                            section.remainingAmount
                          )
                        }
                      />

                      <MetricCard
                        label="Atingimento"
                        value={
                          section.salesGoal >
                          0
                            ? formatPercentage(
                                section.progressPercentage
                              )
                            : "Sem meta"
                        }
                      />
                    </div>

                    {section.salesGoal >
                      0 && (
                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Goal className="h-3.5 w-3.5" />

                            Progresso do caderno
                          </div>

                          <span className="text-xs font-semibold text-[#15704f]">
                            {formatPercentage(
                              section.progressPercentage
                            )}
                          </span>
                        </div>

                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#15704f] transition-all"
                            style={{
                              width:
                                `${progressBar}%`,
                            }}
                          />
                        </div>

                        {section.progressPercentage >
                          100 && (
                          <p className="mt-2 text-xs font-medium text-emerald-700">
                            Meta superada em{" "}
                            {formatPercentage(
                              section.progressPercentage -
                                100
                            )}
                            .
                          </p>
                        )}
                      </div>
                    )}

                    {/* POSIÇÕES */}

                    <div className="mt-7 overflow-hidden rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <Settings2 className="h-4 w-4 text-[#15704f]" />

                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Posições comerciais
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            Controle disponibilidade e capacidade das posições deste caderno.
                          </p>
                        </div>
                      </div>

                      {section.positions.length >
                      0 ? (
                        <div className="divide-y divide-slate-100">
                          {section.positions.map(
                            (
                              position
                            ) => {
                              const status =
                                getPositionStatus(
                                  position
                                );

                              const capacityValue =
                                getCapacityValue(
                                  position
                                );

                              return (
                                <div
                                  key={
                                    position.id
                                  }
                                  className="px-4 py-4"
                                >
                                  <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">

                                    {/* POSIÇÃO */}

                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-900">
                                          {
                                            position.name
                                          }
                                        </p>

                                        <PositionStatusBadge
                                          status={
                                            status
                                          }
                                        />
                                      </div>

                                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                        {position.soldCount >
                                        0 ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedPositionId(
                                                (
                                                  current
                                                ) =>
                                                  current ===
                                                  position.id
                                                    ? null
                                                    : position.id
                                              )
                                            }
                                            className="inline-flex items-center gap-1 rounded-md text-slate-500 underline decoration-dotted underline-offset-2 transition hover:text-[#15704f]"
                                          >
                                            Utilizado:{" "}
                                            <strong className="font-semibold text-slate-700">
                                              {
                                                position.soldCount
                                              }
                                            </strong>
                                            <ChevronDown
                                              className={`h-3 w-3 transition-transform ${
                                                expandedPositionId ===
                                                position.id
                                                  ? "rotate-180"
                                                  : ""
                                              }`}
                                            />
                                          </button>
                                        ) : (
                                          <span>
                                            Utilizado:{" "}
                                            <strong className="font-semibold text-slate-700">
                                              {
                                                position.soldCount
                                              }
                                            </strong>
                                          </span>
                                        )}

                                        <span>
                                          Capacidade:{" "}
                                          <strong className="font-semibold text-slate-700">
                                            {position.capacity ===
                                            null ? (
                                              <span className="inline-flex items-center gap-1">
                                                <InfinityIcon className="h-3 w-3" />

                                                Ilimitada
                                              </span>
                                            ) : (
                                              position.capacity
                                            )}
                                          </strong>
                                        </span>
                                      </div>

                                      {expandedPositionId ===
                                        position.id && (
                                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                          {position.buyers
                                            .length >
                                          0 ? (
                                            <ul className="space-y-1.5">
                                              {position.buyers.map(
                                                (
                                                  buyer,
                                                  index
                                                ) => (
                                                  <li
                                                    key={
                                                      index
                                                    }
                                                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs"
                                                  >
                                                    <span className="font-medium text-slate-700">
                                                      {
                                                        buyer.clientName
                                                      }
                                                    </span>

                                                    <span className="text-slate-500">
                                                      {buyer.sizeDescription
                                                        ? buyer.sizeDescription
                                                        : "Tamanho não informado"}
                                                    </span>
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          ) : (
                                            <p className="text-xs text-slate-500">
                                              Sem detalhes disponíveis.
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {position.manuallyBlocked &&
                                        position.blockedReason && (
                                          <p className="mt-2 text-xs text-amber-700">
                                            {
                                              position.blockedReason
                                            }
                                          </p>
                                        )}
                                    </div>

                                    {/* CONTROLES */}

                                    {editionOpen && (
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                                        {/* CAPACIDADE */}

                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            min={
                                              1
                                            }
                                            value={
                                              capacityValue
                                            }
                                            onChange={(
                                              event
                                            ) =>
                                              setCapacityValue(
                                                position.id,
                                                event.target.value
                                              )
                                            }
                                            placeholder="Ilimitado"
                                            disabled={
                                              isPending
                                            }
                                            className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-[#15704f] disabled:opacity-50"
                                          />

                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleCapacitySave(
                                                position
                                              )
                                            }
                                            disabled={
                                              isPending
                                            }
                                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f] disabled:opacity-50"
                                          >
                                            <Save className="h-3.5 w-3.5" />

                                            Capacidade
                                          </button>
                                        </div>

                                        {/* BLOQUEAR */}

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handlePositionBlocked(
                                              position
                                            )
                                          }
                                          disabled={
                                            isPending
                                          }
                                          className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition disabled:opacity-50 ${
                                            position.manuallyBlocked
                                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                              : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-700"
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
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <Ban className="mx-auto h-6 w-6 text-slate-300" />

                          <p className="mt-2 text-sm text-slate-500">
                            Nenhuma posição comercial configurada.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-slate-300" />

          <p className="mt-3 text-sm font-medium text-slate-700">
            Nenhum caderno cadastrado
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Adicione um caderno para definir metas e posições comerciais.
          </p>
        </div>
      )}
    </section>
  );
}

/*
 * =====================================================
 * MÉTRICA
 * =====================================================
 */

function MetricCard({
  label,
  value,
  highlighted = false,
}: {
  label:
    string;

  value:
    string;

  highlighted?:
    boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlighted
          ? "border-emerald-100 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p
        className={`mt-2 text-base font-semibold ${
          highlighted
            ? "text-[#15704f]"
            : "text-slate-900"
        }`}
      >
        {
          value
        }
      </p>
    </div>
  );
}

/*
 * =====================================================
 * STATUS DA POSIÇÃO
 * =====================================================
 */

type PositionStatus =
  | "available"
  | "blocked"
  | "exhausted"
  | "inactive";

function getPositionStatus(
  position:
    Position
): PositionStatus {
  if (
    !position.active
  ) {
    return "inactive";
  }

  if (
    position.manuallyBlocked
  ) {
    return "blocked";
  }

  if (
    position.exhausted
  ) {
    return "exhausted";
  }

  return "available";
}

function PositionStatusBadge({
  status,
}: {
  status:
    PositionStatus;
}) {
  if (
    status ===
    "available"
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />

        Disponível
      </span>
    );
  }

  if (
    status ===
    "blocked"
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
        <Ban className="h-3 w-3" />

        Esgotada
      </span>
    );
  }

  if (
    status ===
    "exhausted"
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
        <Ban className="h-3 w-3" />

        Esgotada
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
      Inativa
    </span>
  );
}

/*
 * =====================================================
 * DINHEIRO
 * =====================================================
 */

function parseMoney(
  value:
    string
) {
  const clean =
    value
      .trim()
      .replace(
        /\s/g,
        ""
      );

  if (
    !clean
  ) {
    return 0;
  }

  if (
    clean.includes(
      ","
    )
  ) {
    return (
      Number(
        clean
          .replace(
            /\./g,
            ""
          )
          .replace(
            ",",
            "."
          )
      ) ||
      0
    );
  }

  return (
    Number(
      clean
    ) ||
    0
  );
}

function formatEditableMoney(
  value:
    number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  ).format(
    Number.isFinite(
      value
    )
      ? value
      : 0
  );
}

function formatCurrency(
  value:
    number
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

function formatPercentage(
  value:
    number
) {
  return (
    new Intl.NumberFormat(
      "pt-BR",
      {
        maximumFractionDigits:
          1,
      }
    ).format(
      Number.isFinite(
        value
      )
        ? value
        : 0
    ) +
    "%"
  );
}