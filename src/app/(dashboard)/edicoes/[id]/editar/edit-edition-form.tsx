"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useState,
  useTransition,
} from "react";
import {
  ArrowLeft,
  Save,
} from "lucide-react";

import { updateEdition } from "../../actions";

type Props = {
  edition: {
    id: string;
    name: string;
    editionNumber: string;
    publicationDate: string;
    notes: string;
  };
};

export default function EditEditionForm({
  edition,
}: Props) {
  const router = useRouter();

  const [name, setName] = useState(
    edition.name
  );
  const [editionNumber, setEditionNumber] =
    useState(edition.editionNumber);
  const [publicationDate, setPublicationDate] =
    useState(edition.publicationDate);
  const [notes, setNotes] = useState(
    edition.notes
  );

  const [error, setError] = useState("");
  const [isPending, startTransition] =
    useTransition();

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Informe o nome da edição.");
      return;
    }

    if (!publicationDate) {
      setError(
        "Informe a data de publicação."
      );
      return;
    }

    startTransition(async () => {
      const result = await updateEdition({
        id: edition.id,
        name: name.trim(),
        editionNumber:
          editionNumber.trim(),
        publicationDate,
        notes: notes.trim(),
      });

      if (!result.success) {
        setError(
          result.message ??
            "Não foi possível salvar."
        );
        return;
      }

      router.push(
        `/edicoes/${edition.id}`
      );
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-3xl"
      >
        <Link
          href={`/edicoes/${edition.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a edição
        </Link>

        <h1 className="mt-5 text-2xl font-semibold text-slate-900">
          Editar edição
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Ajuste os dados gerais da edição. Cadernos, metas e posições
          são editados na própria edição.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <section className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Número da edição
              </span>

              <input
                value={editionNumber}
                onChange={(e) =>
                  setEditionNumber(
                    e.target.value
                  )
                }
                placeholder="Ex.: 1254"
                className="input"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Data de publicação
              </span>

              <input
                type="date"
                value={publicationDate}
                onChange={(e) =>
                  setPublicationDate(
                    e.target.value
                  )
                }
                required
                className="input"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Nome da edição
              </span>

              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                required
                className="input"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Observações
              </span>

              <textarea
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                rows={5}
                className="input min-h-[130px]"
              />
            </label>
          </div>
        </section>

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href={`/edicoes/${edition.id}`}
            className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isPending
              ? "Salvando..."
              : "Salvar alterações"}
          </button>
        </div>
      </form>
    </main>
  );
}
