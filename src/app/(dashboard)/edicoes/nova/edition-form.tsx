"use client";

import Link from "next/link";

import {
  useState,
  useTransition,
} from "react";

import {
  BadgeDollarSign,
  BookOpen,
  CalendarDays,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  createEdition,
} from "../actions";

type Company = {
  id: string;
  name: string;
};

type Props = {
  company: Company;
};

type SectionForm = {
  localId: string;

  name: string;

  description: string;

  salesGoal: string;
};

export default function EditionForm({
  company,
}: Props) {
  const router =
    useRouter();

  const [
    name,
    setName,
  ] = useState("");

  const [
    editionNumber,
    setEditionNumber,
  ] = useState("");

  const [
    publicationDate,
    setPublicationDate,
  ] = useState("");

  const [
    pageCount,
    setPageCount,
  ] = useState("");

  /*
   * =====================================================
   * META TOTAL DA EDIÇÃO
   * =====================================================
   */

  const [
    salesGoal,
    setSalesGoal,
  ] = useState("");

  /*
   * =====================================================
   * CADERNOS
   * =====================================================
   */

  const [
    sections,
    setSections,
  ] =
    useState<
      SectionForm[]
    >([]);

  const [
    notes,
    setNotes,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState<{
    type:
      | "success"
      | "error";

    text: string;
  } | null>(
    null
  );

  const [
    isPending,
    startTransition,
  ] = useTransition();

  /*
   * =====================================================
   * NÚMERO / NOME
   * =====================================================
   */

  function handleEditionNumberChange(
    value: string
  ) {
    setEditionNumber(
      value
    );

    if (
      !name ||
      name.startsWith(
        "Edição "
      )
    ) {
      setName(
        value.trim()
          ? `Edição ${value.trim()}`
          : ""
      );
    }
  }

  /*
   * =====================================================
   * CADERNOS
   * =====================================================
   */

  function addSection() {
    setSections(
      (
        current
      ) => [
        ...current,
        {
          localId:
            crypto.randomUUID(),

          name:
            "",

          description:
            "",

          salesGoal:
            "",
        },
      ]
    );
  }

  function removeSection(
    localId: string
  ) {
    setSections(
      (
        current
      ) =>
        current.filter(
          (
            section
          ) =>
            section.localId !==
            localId
        )
    );
  }

  function updateSection(
    localId: string,
    field:
      | "name"
      | "description"
      | "salesGoal",
    value: string
  ) {
    setSections(
      (
        current
      ) =>
        current.map(
          (
            section
          ) =>
            section.localId ===
            localId
              ? {
                  ...section,
                  [field]:
                    value,
                }
              : section
        )
    );
  }

  /*
   * =====================================================
   * SUBMIT
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
          "Informe o nome da edição.",
      });

      return;
    }

    if (
      !publicationDate
    ) {
      setMessage({
        type:
          "error",

        text:
          "Informe a data de publicação.",
      });

      return;
    }

    const numericSalesGoal =
      parseMoney(
        salesGoal
      );

    if (
      salesGoal &&
      (
        !Number.isFinite(
          numericSalesGoal
        ) ||
        numericSalesGoal <
          0
      )
    ) {
      setMessage({
        type:
          "error",

        text:
          "Informe uma meta válida para a edição.",
      });

      return;
    }

    /*
     * Validar cadernos
     */

    for (
      let index = 0;
      index <
      sections.length;
      index++
    ) {
      const section =
        sections[
          index
        ];

      if (
        !section.name
          .trim()
      ) {
        setMessage({
          type:
            "error",

          text:
            `Informe o nome do caderno ${index + 1}.`,
        });

        return;
      }

      const sectionGoal =
        parseMoney(
          section.salesGoal
        );

      if (
        section.salesGoal &&
        (
          !Number.isFinite(
            sectionGoal
          ) ||
          sectionGoal <
            0
        )
      ) {
        setMessage({
          type:
            "error",

          text:
            `Informe uma meta válida para o caderno ${section.name}.`,
        });

        return;
      }
    }

    startTransition(
      async () => {
        const result =
          await createEdition({
            companyId:
              company.id,

            name:
              name.trim(),

            editionNumber:
              editionNumber.trim(),

            publicationDate,

            /*
             * NOVO
             */

            salesGoal:
              numericSalesGoal,

            pageCount:
              pageCount.trim()
                ? Number(pageCount)
                : null,

            sections:
              sections.map(
                (
                  section
                ) => ({
                  name:
                    section.name
                      .trim(),

                  description:
                    section.description
                      .trim() ||
                    null,

                  salesGoal:
                    parseMoney(
                      section.salesGoal
                    ),
                })
              ),

            notes:
              notes.trim(),
          });

        if (
          !result.success
        ) {
          setMessage({
            type:
              "error",

            text:
              result.message ??
              "Não foi possível criar a edição.",
          });

          return;
        }

        if (
          !result.id
        ) {
          setMessage({
            type:
              "error",

            text:
              "A edição foi criada, mas não foi possível identificar o registro.",
          });

          return;
        }

        router.push(
          `/edicoes/${result.id}`
        );

        router.refresh();
      }
    );
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="mt-8 space-y-6"
    >
      {/* =================================================
          DADOS DA EDIÇÃO
         ================================================= */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#15704f]" />

            <h2 className="font-semibold text-slate-900">
              Dados da edição
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Informe os dados principais da edição do jornal.
          </p>
        </div>

        <div className="p-6">
          <div className="grid gap-5 md:grid-cols-2">

            {/* EMPRESA */}

            <div>
              <label className="text-sm font-medium text-slate-700">
                Empresa
              </label>

              <div className="mt-2 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
                <span className="text-sm font-semibold text-slate-800">
                  {
                    company.name
                  }
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-400">
                As edições são exclusivas do O Estafeta.
              </p>
            </div>

            {/* NÚMERO */}

            <div>
              <label className="text-sm font-medium text-slate-700">
                Número da edição
              </label>

              <input
                type="text"
                value={
                  editionNumber
                }
                onChange={(
                  event
                ) =>
                  handleEditionNumberChange(
                    event.target
                      .value
                  )
                }
                placeholder="Ex.: 1254"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#15704f]"
              />
            </div>

            {/* NOME */}

            <div>
              <label className="text-sm font-medium text-slate-700">
                Nome da edição
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
                placeholder="Ex.: Edição 1.254"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#15704f]"
              />
            </div>

            {/* DATA */}

            <div>
              <label className="text-sm font-medium text-slate-700">
                Data de publicação
              </label>

              <input
                type="date"
                value={
                  publicationDate
                }
                onChange={(
                  event
                ) =>
                  setPublicationDate(
                    event.target
                      .value
                  )
                }
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
              />
            </div>

            {/* Nº DE PÁGINAS */}

            <div>
              <label className="text-sm font-medium text-slate-700">
                Nº de páginas
              </label>

              <input
                type="number"
                min={1}
                step={1}
                value={
                  pageCount
                }
                onChange={(
                  event
                ) =>
                  setPageCount(
                    event.target
                      .value
                  )
                }
                placeholder="Ex.: 16, 24, 36"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#15704f]"
              />

              <p className="mt-1 text-xs text-slate-400">
                Mapa da edição. Pode ser preenchido depois.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================
          META TOTAL
         ================================================= */}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
            <BadgeDollarSign className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Meta comercial da edição
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Defina quanto a equipe deve vender nesta edição.
            </p>
          </div>
        </div>

        <div className="mt-5 max-w-md">
          <label className="text-sm font-medium text-slate-700">
            Meta total
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
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
            />
          </div>

          <p className="mt-2 text-xs text-slate-400">
            O vendido de todos os cadernos será somado automaticamente ao total da edição.
          </p>
        </div>
      </section>

      {/* =================================================
          CADERNOS
         ================================================= */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#15704f]" />

              <h2 className="font-semibold text-slate-900">
                Cadernos da edição
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre os cadernos e a meta comercial de cada um.
            </p>
          </div>

          <button
            type="button"
            onClick={
              addSection
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f]"
          >
            <Plus className="h-4 w-4" />

            Adicionar caderno
          </button>
        </div>

        {sections.length ===
        0 ? (
          <div className="px-6 py-10 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-slate-300" />

            <p className="mt-3 text-sm font-medium text-slate-600">
              Nenhum caderno cadastrado
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Você pode criar a edição sem cadernos ou adicioná-los agora.
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-6">
            {sections.map(
              (
                section,
                index
              ) => (
                <div
                  key={
                    section.localId
                  }
                  className="rounded-2xl border border-slate-200 p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      Caderno{" "}
                      {
                        index +
                        1
                      }
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        removeSection(
                          section.localId
                        )
                      }
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-2">

                    {/* NOME */}

                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Nome do caderno
                      </label>

                      <input
                        value={
                          section.name
                        }
                        onChange={(
                          event
                        ) =>
                          updateSection(
                            section.localId,
                            "name",
                            event.target
                              .value
                          )
                        }
                        placeholder="Ex.: Especial Agro"
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-[#15704f]"
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
                            section.salesGoal
                          }
                          onChange={(
                            event
                          ) =>
                            updateSection(
                              section.localId,
                              "salesGoal",
                              event.target
                                .value
                            )
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none transition focus:border-[#15704f]"
                        />
                      </div>
                    </div>

                    {/* DESCRIÇÃO */}

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-slate-700">
                        Descrição
                      </label>

                      <textarea
                        rows={
                          3
                        }
                        value={
                          section.description
                        }
                        onChange={(
                          event
                        ) =>
                          updateSection(
                            section.localId,
                            "description",
                            event.target
                              .value
                          )
                        }
                        placeholder="Opcional"
                        className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-[#15704f]"
                      />
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* =================================================
          OBSERVAÇÕES
         ================================================= */}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <label className="text-sm font-medium text-slate-700">
          Observações
        </label>

        <textarea
          value={
            notes
          }
          onChange={(
            event
          ) =>
            setNotes(
              event.target
                .value
            )
          }
          rows={
            5
          }
          placeholder="Informações adicionais sobre esta edição..."
          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#15704f]"
        />
      </section>

      {/* =================================================
          MENSAGEM
         ================================================= */}

      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
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
          AÇÕES
         ================================================= */}

      <div className="flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <Link
          href="/edicoes"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={
            isPending
          }
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />

          {isPending
            ? "Criando..."
            : "Criar edição"}
        </button>
      </div>
    </form>
  );
}

/*
 * =====================================================
 * VALOR
 * =====================================================
 */

function parseMoney(
  value: string
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