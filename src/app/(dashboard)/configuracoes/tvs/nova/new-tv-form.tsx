"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  Save,
} from "lucide-react";

import {
  createTv,
} from "../actions";

export default function NewTvForm() {
  const router =
    useRouter();

  const [
    name,
    setName,
  ] =
    useState("");

  const [
    location,
    setLocation,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const result =
      await createTv({
        name,
        location,
        description,
      });

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível cadastrar."
      );

      setLoading(false);

      return;
    }

    router.push(
      "/configuracoes/tvs"
    );

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <form
        onSubmit={
          handleSubmit
        }
        className="mx-auto max-w-2xl"
      >
        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500"
        >
          <ArrowLeft className="h-4 w-4" />

          Voltar
        </button>

        <h1 className="text-2xl font-semibold text-slate-900">
          Nova TV / Telão
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Cadastre um novo ponto de mídia da Pottencializa.
        </p>

        {error && (
          <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="space-y-5">
            <Field label="Nome">
              <input
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
                placeholder="Ex.: TV Centro"
                required
                className="input"
              />
            </Field>

            <Field label="Localização">
              <input
                value={
                  location
                }
                onChange={(
                  event
                ) =>
                  setLocation(
                    event.target
                      .value
                  )
                }
                placeholder="Ex.: Avenida principal"
                className="input"
              />
            </Field>

            <Field label="Descrição">
              <textarea
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
                rows={4}
                className="input min-h-[110px]"
              />
            </Field>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={
                loading
              }
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" />

              {loading
                ? "Salvando..."
                : "Cadastrar TV"}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children:
    React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}