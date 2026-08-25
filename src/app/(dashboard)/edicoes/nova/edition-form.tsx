"use client";

import Link from "next/link";

import {
  useState,
  useTransition,
} from "react";

import {
  CalendarDays,
  Save,
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
  } | null>(null);

  const [
    isPending,
    startTransition,
  ] = useTransition();

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

  function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage(null);

    if (!name.trim()) {
      setMessage({
        type: "error",
        text:
          "Informe o nome da edição.",
      });

      return;
    }

    if (
      !publicationDate
    ) {
      setMessage({
        type: "error",
        text:
          "Informe a data de publicação.",
      });

      return;
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

            notes:
              notes.trim(),
          });

        if (
          !result.success
        ) {
          setMessage({
            type: "error",
            text:
              result.message ??
              "Não foi possível criar a edição.",
          });

          return;
        }

        if (!result.id) {
          setMessage({
            type: "error",
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
      className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      {/* CABEÇALHO */}

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

      {/* CAMPOS */}

      <div className="p-6">
        <div className="grid gap-5 md:grid-cols-2">

          {/* EMPRESA FIXA */}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Empresa
            </label>

            <div className="mt-2 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
              <span className="text-sm font-semibold text-slate-800">
                {company.name}
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

            <p className="mt-1 text-xs text-slate-400">
              Pode usar números ou outra identificação.
            </p>
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

          {/* OBSERVAÇÕES */}

          <div className="md:col-span-2">
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
          </div>
        </div>

        {/* MENSAGEM */}

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

        {/* AÇÕES */}

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
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
      </div>
    </form>
  );
}