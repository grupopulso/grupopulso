"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  BookOpen,
  Pencil,
  Plus,
  Power,
  Save,
  X,
} from "lucide-react";

import {
  createEditionSection,
  setEditionSectionActive,
  updateEditionSection,
} from "./sections-actions";

type Section = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type Props = {
  editionId: string;
  editionOpen: boolean;
  sections: Section[];
};

export default function SectionsManagement({
  editionId,
  editionOpen,
  sections,
}: Props) {
  const [
    name,
    setName,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    editingId,
    setEditingId,
  ] = useState<
    string | null
  >(null);

  const [
    message,
    setMessage,
  ] = useState<{
    type:
      | "success"
      | "error";
    text: string;
  } | null>(null);

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const isEditing =
    Boolean(
      editingId
    );

  function resetForm() {
    setName("");
    setDescription("");
    setEditingId(
      null
    );
  }

  function handleEdit(
    section: Section
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

    setMessage(null);
  }

  function handleCancelEdit() {
    resetForm();
    setMessage(null);
  }

  function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage(null);

    if (
      !name.trim()
    ) {
      setMessage({
        type: "error",
        text:
          "Informe o nome do caderno.",
      });

      return;
    }

    startTransition(
      async () => {
        const result =
          editingId
            ? await updateEditionSection(
                {
                  id:
                    editingId,

                  editionId,

                  name:
                    name.trim(),

                  description:
                    description.trim(),
                }
              )
            : await createEditionSection(
                {
                  editionId,

                  name:
                    name.trim(),

                  description:
                    description.trim(),
                }
              );

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

  function handleToggle(
    section: Section
  ) {
    setMessage(null);

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

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* CABEÇALHO */}

      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[#15704f]" />

          <h2 className="font-semibold text-slate-900">
            Cadernos da edição
          </h2>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Cadastre cadernos ou seções específicas para organizar os anúncios desta edição.
        </p>
      </div>

      {/* FORMULÁRIO */}

      {editionOpen && (
        <form
          onSubmit={
            handleSubmit
          }
          className="border-b border-slate-100 p-6"
        >
          <div className="grid gap-5 md:grid-cols-[1fr_2fr_auto] md:items-end">

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
                placeholder="Ex.: Esportes"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#15704f]"
              />
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

          {message && (
            <div
              className={`mt-5 rounded-xl px-4 py-3 text-sm ${
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
        </form>
      )}

      {/* LISTAGEM */}

      {sections.length ? (
        <div className="divide-y divide-slate-100">
          {sections.map(
            (
              section
            ) => (
              <div
                key={
                  section.id
                }
                className="flex flex-col justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {
                        section.name
                      }
                    </p>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        section.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
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
                  <div className="flex items-center gap-2">
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
                  </div>
                )}
              </div>
            )
          )}
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-slate-300" />

          <p className="mt-3 text-sm font-medium text-slate-700">
            Nenhum caderno cadastrado
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Os anúncios ainda podem ser registrados sem caderno específico.
          </p>
        </div>
      )}
    </section>
  );
}