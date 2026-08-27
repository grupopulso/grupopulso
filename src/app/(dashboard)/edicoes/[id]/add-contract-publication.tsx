"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  addContractPublicationToEdition,
  removeContractPublicationFromEdition,
  updateContractPublicationInEdition,
} from "./actions";

/*
 * =====================================================
 * TIPOS
 * =====================================================
 */

type Contract = {
  id: string;

  title: string;

  value:
    | number
    | string;

  start_date: string;

  end_date:
    | string
    | null;

  client: {
    id: string;
    name: string;
  } | null;

  product: {
    id: string;
    name: string;
  } | null;
};

type Section = {
  id: string;
  name: string;

  description:
    | string
    | null;
};

type Position = {
  id: string;

  section_id:
    | string
    | null;

  position_code: string;

  name: string;

  capacity:
    | number
    | null;

  manually_blocked:
    boolean;

  blocked_reason:
    | string
    | null;

  active:
    boolean;

  usageCount:
    number;
};

type Publication = {
  id: string;

  contractId: string;

  contractTitle: string;

  clientName: string;

  productName:
    | string
    | null;

  sectionId:
    | string
    | null;

  adPositionId:
    | string
    | null;

  sizeDescription:
    | string
    | null;

  amount:
    | number
    | string;

  notes:
    | string
    | null;
};

type AddProps = {
  editionId: string;

  contracts:
    Contract[];

  sections:
    Section[];

  positions:
    Position[];

  autoOpenContractId?:
    | string
    | null;
};

type EditProps = {
  editionId: string;

  publication:
    Publication;

  sections:
    Section[];

  positions:
    Position[];
};

/*
 * =====================================================
 * ADICIONAR PUBLICAÇÃO
 * =====================================================
 */

export function AddContractPublication({
  editionId,
  contracts,
  sections,
  positions,
  autoOpenContractId,
}: AddProps) {
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
    step,
    setStep,
  ] =
    useState<
      1 | 2
    >(
      1
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    contractId,
    setContractId,
  ] =
    useState("");

  const [
    sectionId,
    setSectionId,
  ] =
    useState("");

  const [
    positionId,
    setPositionId,
  ] =
    useState("");

  const [
    sizeDescription,
    setSizeDescription,
  ] =
    useState("");

  const [
    amount,
    setAmount,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

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

  /*
   * =====================================================
   * CONTRATO SELECIONADO
   * =====================================================
   */

  const selectedContract =
    useMemo(
      () =>
        contracts.find(
          (
            contract
          ) =>
            contract.id ===
            contractId
        ) ??
        null,
      [
        contracts,
        contractId,
      ]
    );

  /*
   * =====================================================
   * PESQUISA
   * =====================================================
   */

  const filteredContracts =
    useMemo(
      () => {
        const term =
          normalize(
            search
          );

        if (
          !term
        ) {
          return contracts;
        }

        return contracts.filter(
          (
            contract
          ) => {
            const content =
              normalize(
                [
                  contract.title,

                  contract.client
                    ?.name ??
                    "",

                  contract.product
                    ?.name ??
                    "",
                ].join(
                  " "
                )
              );

            return content.includes(
              term
            );
          }
        );
      },
      [
        contracts,
        search,
      ]
    );

  /*
   * =====================================================
   * POSIÇÕES DISPONÍVEIS
   * =====================================================
   */

  const availablePositions =
    useMemo(
      () =>
        positions.filter(
          (
            position
          ) => {
            if (
              !position.active
            ) {
              return false;
            }

            if (
              sectionId
            ) {
              return (
                position.section_id ===
                sectionId
              );
            }

            return (
              position.section_id ===
              null
            );
          }
        ),
      [
        positions,
        sectionId,
      ]
    );

  const selectedPosition =
    useMemo(
      () =>
        positions.find(
          (
            position
          ) =>
            position.id ===
            positionId
        ) ??
        null,
      [
        positions,
        positionId,
      ]
    );

  /*
   * =====================================================
   * ABRIR / FECHAR
   * =====================================================
   */

  function handleOpen() {
    reset();

    setOpen(
      true
    );
  }

  function handleClose() {
    if (
      loading
    ) {
      return;
    }

    setOpen(
      false
    );

    reset();
  }

  function reset() {
    setStep(
      1
    );

    setSearch("");

    setContractId("");

    setSectionId("");

    setPositionId("");

    setSizeDescription("");

    setAmount("");

    setNotes("");

    setError("");
  }

  /*
   * =====================================================
   * CONTRATO
   * =====================================================
   */

  function selectContract(
    contract:
      Contract
  ) {
    setContractId(
      contract.id
    );

    setAmount(
      formatMoneyInput(
        Number(
          contract.value ??
            0
        )
      )
    );

    setError("");

    setStep(
      2
    );
  }

  /*
   * Abre o modal já no contrato certo quando a página
   * é acessada com ?publicar={contractId} (fluxo vindo
   * da tela do contrato).
   */
  useEffect(
    () => {
      if (
        !autoOpenContractId
      ) {
        return;
      }

      const contract =
        contracts.find(
          (item) =>
            item.id ===
            autoOpenContractId
        );

      if (!contract) {
        return;
      }

      reset();
      selectContract(contract);
      setOpen(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [autoOpenContractId]
  );

  /*
   * =====================================================
   * CADERNO
   * =====================================================
   */

  function handleSectionChange(
    value:
      string
  ) {
    setSectionId(
      value
    );

    setPositionId(
      ""
    );
  }

  /*
   * =====================================================
   * SALVAR
   * =====================================================
   */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (
      !contractId
    ) {
      setError(
        "Selecione um contrato."
      );

      setStep(
        1
      );

      return;
    }

    const parsedAmount =
      parseMoney(
        amount
      );

    if (
      !Number.isFinite(
        parsedAmount
      ) ||
      parsedAmount <
        0
    ) {
      setError(
        "Informe um valor válido."
      );

      return;
    }

    setLoading(
      true
    );

    const result =
      await addContractPublicationToEdition({
        editionId,

        contractId,

        sectionId:
          sectionId ||
          null,

        adPositionId:
          positionId ||
          null,

        sizeDescription:
          sizeDescription
            .trim() ||
          null,

        amount:
          parsedAmount,

        notes:
          notes.trim() ||
          null,
      });

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível adicionar a publicação."
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

    reset();

    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={
          handleOpen
        }
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
      >
        <Plus className="h-4 w-4" />

        Adicionar publicação
      </button>

      {open && (
        <ModalShell
          title="Adicionar publicação"
          description={
            step ===
            1
              ? "Selecione um contrato existente."
              : "Configure como esta publicação aparecerá na edição."
          }
          loading={
            loading
          }
          onClose={
            handleClose
          }
        >
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <StepIndicator
                number={
                  1
                }
                label="Contrato"
                active={
                  step ===
                  1
                }
                completed={
                  step >
                  1
                }
              />

              <div className="h-px flex-1 bg-slate-200" />

              <StepIndicator
                number={
                  2
                }
                label="Publicação"
                active={
                  step ===
                  2
                }
                completed={
                  false
                }
              />
            </div>
          </div>

          {error && (
            <ErrorMessage>
              {
                error
              }
            </ErrorMessage>
          )}

          {step ===
            1 && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="px-6 pt-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    value={
                      search
                    }
                    onChange={(
                      event
                    ) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Buscar cliente, contrato ou produto..."
                    className="input pl-10"
                    autoFocus
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {filteredContracts.length >
                0 ? (
                  <div className="grid gap-3">
                    {filteredContracts.map(
                      (
                        contract
                      ) => (
                        <ContractCard
                          key={
                            contract.id
                          }
                          contract={
                            contract
                          }
                          onSelect={() =>
                            selectContract(
                              contract
                            )
                          }
                        />
                      )
                    )}
                  </div>
                ) : (
                  <EmptyContracts />
                )}
              </div>
            </div>
          )}

          {step ===
            2 &&
            selectedContract && (
              <form
                onSubmit={
                  handleSubmit
                }
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <SelectedContractCard
                    title={
                      selectedContract.title
                    }
                    clientName={
                      selectedContract.client
                        ?.name ??
                      "Cliente não informado"
                    }
                    productName={
                      selectedContract.product
                        ?.name ??
                      null
                    }
                    onChange={() => {
                      setStep(
                        1
                      );

                      setContractId("");

                      setSectionId("");

                      setPositionId("");

                      setError("");
                    }}
                  />

                  <PublicationFields
                    sections={
                      sections
                    }
                    positions={
                      availablePositions
                    }
                    sectionId={
                      sectionId
                    }
                    positionId={
                      positionId
                    }
                    sizeDescription={
                      sizeDescription
                    }
                    amount={
                      amount
                    }
                    notes={
                      notes
                    }
                    selectedPosition={
                      selectedPosition
                    }
                    onSectionChange={
                      handleSectionChange
                    }
                    onPositionChange={
                      setPositionId
                    }
                    onSizeChange={
                      setSizeDescription
                    }
                    onAmountChange={
                      setAmount
                    }
                    onNotesChange={
                      setNotes
                    }
                  />
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-5">
                  <button
                    type="button"
                    disabled={
                      loading
                    }
                    onClick={() => {
                      setStep(
                        1
                      );

                      setError("");
                    }}
                    className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Voltar
                  </button>

                  <button
                    type="submit"
                    disabled={
                      loading
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />

                    {loading
                      ? "Adicionando..."
                      : "Adicionar à edição"}
                  </button>
                </div>
              </form>
            )}
        </ModalShell>
      )}
    </>
  );
}

/*
 * =====================================================
 * EDITAR PUBLICAÇÃO
 * =====================================================
 */

export function EditContractPublication({
  editionId,
  publication,
  sections,
  positions,
}: EditProps) {
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
    confirmRemove,
    setConfirmRemove,
  ] =
    useState(
      false
    );

  const [
    sectionId,
    setSectionId,
  ] =
    useState(
      publication.sectionId ??
        ""
    );

  const [
    positionId,
    setPositionId,
  ] =
    useState(
      publication.adPositionId ??
        ""
    );

  const [
    sizeDescription,
    setSizeDescription,
  ] =
    useState(
      publication.sizeDescription ??
        ""
    );

  const [
    amount,
    setAmount,
  ] =
    useState(
      formatMoneyInput(
        Number(
          publication.amount ??
            0
        )
      )
    );

  const [
    notes,
    setNotes,
  ] =
    useState(
      publication.notes ??
        ""
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

  /*
   * =====================================================
   * POSIÇÕES
   * =====================================================
   */

  const availablePositions =
    useMemo(
      () =>
        positions.filter(
          (
            position
          ) => {
            if (
              !position.active
            ) {
              return false;
            }

            if (
              sectionId
            ) {
              return (
                position.section_id ===
                sectionId
              );
            }

            return (
              position.section_id ===
              null
            );
          }
        ),
      [
        positions,
        sectionId,
      ]
    );

  const selectedPosition =
    useMemo(
      () =>
        positions.find(
          (
            position
          ) =>
            position.id ===
            positionId
        ) ??
        null,
      [
        positions,
        positionId,
      ]
    );

  /*
   * =====================================================
   * ABRIR
   * =====================================================
   */

  function handleOpen() {
    setSectionId(
      publication.sectionId ??
        ""
    );

    setPositionId(
      publication.adPositionId ??
        ""
    );

    setSizeDescription(
      publication.sizeDescription ??
        ""
    );

    setAmount(
      formatMoneyInput(
        Number(
          publication.amount ??
            0
        )
      )
    );

    setNotes(
      publication.notes ??
        ""
    );

    setConfirmRemove(
      false
    );

    setError("");

    setOpen(
      true
    );
  }

  /*
   * =====================================================
   * CADERNO
   * =====================================================
   */

  function handleSectionChange(
    value:
      string
  ) {
    setSectionId(
      value
    );

    setPositionId(
      ""
    );
  }

  /*
   * =====================================================
   * SALVAR EDIÇÃO
   * =====================================================
   */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    const parsedAmount =
      parseMoney(
        amount
      );

    if (
      !Number.isFinite(
        parsedAmount
      ) ||
      parsedAmount <
        0
    ) {
      setError(
        "Informe um valor válido."
      );

      return;
    }

    setLoading(
      true
    );

    const result =
      await updateContractPublicationInEdition({
        publicationId:
          publication.id,

        editionId,

        sectionId:
          sectionId ||
          null,

        adPositionId:
          positionId ||
          null,

        sizeDescription:
          sizeDescription
            .trim() ||
          null,

        amount:
          parsedAmount,

        notes:
          notes.trim() ||
          null,
      });

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível atualizar a publicação."
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

  /*
   * =====================================================
   * REMOVER
   * =====================================================
   */

  async function handleRemove() {
    setError("");

    setLoading(
      true
    );

    const result =
      await removeContractPublicationFromEdition(
        publication.id,
        editionId
      );

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível remover a publicação."
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
        onClick={
          handleOpen
        }
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f]"
      >
        <Pencil className="h-3.5 w-3.5" />

        Editar
      </button>

      {open && (
        <ModalShell
          title="Editar publicação"
          description="Altere a configuração desta publicação dentro da edição."
          loading={
            loading
          }
          onClose={() => {
            if (
              loading
            ) {
              return;
            }

            setOpen(
              false
            );
          }}
        >
          {error && (
            <ErrorMessage>
              {
                error
              }
            </ErrorMessage>
          )}

          {!confirmRemove ? (
            <form
              onSubmit={
                handleSubmit
              }
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <SelectedContractCard
                  title={
                    publication.contractTitle
                  }
                  clientName={
                    publication.clientName
                  }
                  productName={
                    publication.productName
                  }
                />

                <PublicationFields
                  sections={
                    sections
                  }
                  positions={
                    availablePositions
                  }
                  sectionId={
                    sectionId
                  }
                  positionId={
                    positionId
                  }
                  sizeDescription={
                    sizeDescription
                  }
                  amount={
                    amount
                  }
                  notes={
                    notes
                  }
                  selectedPosition={
                    selectedPosition
                  }
                  currentPositionId={
                    publication.adPositionId
                  }
                  onSectionChange={
                    handleSectionChange
                  }
                  onPositionChange={
                    setPositionId
                  }
                  onSizeChange={
                    setSizeDescription
                  }
                  onAmountChange={
                    setAmount
                  }
                  onNotesChange={
                    setNotes
                  }
                />
              </div>

              <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:items-center">
                <button
                  type="button"
                  disabled={
                    loading
                  }
                  onClick={() =>
                    setConfirmRemove(
                      true
                    )
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />

                  Desvincular
                </button>

                <div className="flex gap-3">
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
                    className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={
                      loading
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" />

                    {loading
                      ? "Salvando..."
                      : "Salvar alterações"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="p-6">
              <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <Trash2 className="h-5 w-5" />
                </div>

                <h3 className="mt-4 font-semibold text-slate-900">
                  Desvincular publicação?
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  O contrato continuará existindo normalmente. Apenas esta publicação será removida da edição atual.
                </p>

                <p className="mt-3 text-sm font-semibold text-slate-800">
                  {
                    publication.clientName
                  }{" "}
                  •{" "}
                  {
                    publication.contractTitle
                  }
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={
                    loading
                  }
                  onClick={() =>
                    setConfirmRemove(
                      false
                    )
                  }
                  className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  disabled={
                    loading
                  }
                  onClick={
                    handleRemove
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />

                  {loading
                    ? "Desvinculando..."
                    : "Confirmar desvinculação"}
                </button>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </>
  );
}

/*
 * =====================================================
 * CAMPOS DA PUBLICAÇÃO
 * =====================================================
 */

function PublicationFields({
  sections,
  positions,
  sectionId,
  positionId,
  sizeDescription,
  amount,
  notes,
  selectedPosition,
  currentPositionId,
  onSectionChange,
  onPositionChange,
  onSizeChange,
  onAmountChange,
  onNotesChange,
}: {
  sections:
    Section[];

  positions:
    Position[];

  sectionId:
    string;

  positionId:
    string;

  sizeDescription:
    string;

  amount:
    string;

  notes:
    string;

  selectedPosition:
    Position | null;

  currentPositionId?:
    string | null;

  onSectionChange:
    (
      value:
        string
    ) => void;

  onPositionChange:
    (
      value:
        string
    ) => void;

  onSizeChange:
    (
      value:
        string
    ) => void;

  onAmountChange:
    (
      value:
        string
    ) => void;

  onNotesChange:
    (
      value:
        string
    ) => void;
}) {
  return (
    <>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field label="Caderno">
          <select
            value={
              sectionId
            }
            onChange={(
              event
            ) =>
              onSectionChange(
                event.target.value
              )
            }
            className="input"
          >
            <option value="">
              Sem caderno específico
            </option>

            {sections.map(
              (
                section
              ) => (
                <option
                  key={
                    section.id
                  }
                  value={
                    section.id
                  }
                >
                  {
                    section.name
                  }
                </option>
              )
            )}
          </select>

          <HelpText>
            O caderno é opcional.
          </HelpText>
        </Field>

        <Field label="Posição">
          <select
            value={
              positionId
            }
            onChange={(
              event
            ) =>
              onPositionChange(
                event.target.value
              )
            }
            className="input"
          >
            <option value="">
              Sem posição definida
            </option>

            {positions.map(
              (
                position
              ) => {
                /*
                 * Na edição, a posição
                 * atual já conta na ocupação.
                 *
                 * Por isso não bloqueamos
                 * a própria posição atual.
                 */

                const isCurrent =
                  currentPositionId ===
                  position.id;

                const full =
                  position.capacity !==
                    null &&
                  position.usageCount >=
                    position.capacity &&
                  !isCurrent;

                const unavailable =
                  (
                    position.manually_blocked &&
                    !isCurrent
                  ) ||
                  full;

                return (
                  <option
                    key={
                      position.id
                    }
                    value={
                      position.id
                    }
                    disabled={
                      unavailable
                    }
                  >
                    {position.position_code
                      ? `${position.position_code} • `
                      : ""}

                    {
                      position.name
                    }

                    {position.capacity !==
                    null
                      ? ` (${position.usageCount}/${position.capacity})`
                      : ""}

                    {position.manually_blocked &&
                    !isCurrent
                      ? " — bloqueada"
                      : full
                        ? " — lotada"
                        : ""}
                  </option>
                );
              }
            )}
          </select>
        </Field>

        <Field label="Tamanho / formato">
          <input
            value={
              sizeDescription
            }
            onChange={(
              event
            ) =>
              onSizeChange(
                event.target.value
              )
            }
            placeholder="Ex.: página inteira, 1/2 página, 10x15 cm..."
            className="input"
          />
        </Field>

        <Field label="Valor da publicação">
          <input
            value={
              amount
            }
            onChange={(
              event
            ) =>
              onAmountChange(
                event.target.value
              )
            }
            inputMode="decimal"
            placeholder="0,00"
            className="input"
          />

          <HelpText>
            Este valor alimenta a meta comercial desta edição.
          </HelpText>
        </Field>
      </div>

      {selectedPosition && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Posição selecionada
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-slate-900">
              {
                selectedPosition.name
              }
            </p>

            {selectedPosition.capacity !==
              null && (
              <span className="rounded-md bg-white px-2 py-1 text-xs text-slate-500">
                {
                  selectedPosition.usageCount
                }
                /
                {
                  selectedPosition.capacity
                }{" "}
                ocupado
                {selectedPosition.capacity !==
                1
                  ? "s"
                  : ""}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-5">
        <Field label="Observações">
          <textarea
            value={
              notes
            }
            onChange={(
              event
            ) =>
              onNotesChange(
                event.target.value
              )
            }
            rows={
              4
            }
            placeholder="Informações específicas desta publicação..."
            className="input min-h-[110px]"
          />
        </Field>
      </div>
    </>
  );
}

/*
 * =====================================================
 * CONTRATO
 * =====================================================
 */

function ContractCard({
  contract,
  onSelect,
}: {
  contract:
    Contract;

  onSelect:
    () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onSelect
      }
      className="group rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#15704f]/40 hover:bg-emerald-50/40"
    >
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-[#15704f]">
              <FileText className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {
                  contract.title
                }
              </p>

              <p className="mt-0.5 truncate text-xs text-slate-500">
                {contract.client
                  ?.name ??
                  "Cliente não informado"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {contract.product && (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                {
                  contract.product.name
                }
              </span>
            )}

            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">
              {formatDate(
                contract.start_date
              )}

              {contract.end_date
                ? ` até ${formatDate(
                    contract.end_date
                  )}`
                : ""}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-slate-900">
            {formatCurrency(
              Number(
                contract.value ??
                  0
              )
            )}
          </p>

          <p className="mt-1 text-xs font-medium text-[#15704f]">
            Selecionar
          </p>
        </div>
      </div>
    </button>
  );
}

function SelectedContractCard({
  title,
  clientName,
  productName,
  onChange,
}: {
  title:
    string;

  clientName:
    string;

  productName:
    string | null;

  onChange?:
    () => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Contrato
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            {
              title
            }
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {
              clientName
            }

            {productName
              ? ` • ${productName}`
              : ""}
          </p>
        </div>

        {onChange && (
          <button
            type="button"
            onClick={
              onChange
            }
            className="text-xs font-semibold text-[#15704f]"
          >
            Trocar contrato
          </button>
        )}
      </div>
    </div>
  );
}

/*
 * =====================================================
 * MODAL
 * =====================================================
 */

function ModalShell({
  title,
  description,
  loading,
  onClose,
  children,
}: {
  title:
    string;

  description:
    string;

  loading:
    boolean;

  onClose:
    () => void;

  children:
    React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {
                title
              }
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {
                description
              }
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              loading
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {
          children
        }
      </div>
    </div>
  );
}

function ErrorMessage({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="mx-6 mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
      {
        children
      }
    </div>
  );
}

function EmptyContracts() {
  return (
    <div className="py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <FileText className="h-5 w-5" />
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-700">
        Nenhum contrato disponível
      </p>

      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
        Não encontramos contratos ativos disponíveis para vincular a esta edição.
      </p>
    </div>
  );
}

/*
 * =====================================================
 * PASSOS
 * =====================================================
 */

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number:
    number;

  label:
    string;

  active:
    boolean;

  completed:
    boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
          active ||
          completed
            ? "bg-[#15704f] text-white"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        {
          number
        }
      </div>

      <span
        className={`text-xs font-semibold ${
          active ||
          completed
            ? "text-slate-800"
            : "text-slate-400"
        }`}
      >
        {
          label
        }
      </span>
    </div>
  );
}

/*
 * =====================================================
 * FIELD
 * =====================================================
 */

function Field({
  label,
  children,
}: {
  label:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {
          label
        }
      </span>

      {
        children
      }
    </label>
  );
}

function HelpText({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span className="mt-1.5 block text-xs leading-5 text-slate-400">
      {
        children
      }
    </span>
  );
}

/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

function normalize(
  value:
    string
) {
  return value
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

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

function formatMoneyInput(
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

function formatDate(
  value:
    string
) {
  if (
    !value
  ) {
    return "—";
  }

  const [
    year,
    month,
    day,
  ] =
    value.split(
      "-"
    );

  return `${day}/${month}/${year}`;
}