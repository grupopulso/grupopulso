"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  Pencil,
  Save,
  X,
} from "lucide-react";

import {
  updateTv,
} from "./actions";

type Props = {
  tv: {
    id: string;
    name: string;
    location: string;
    description: string;
    active: boolean;
  };
};

export default function TvEditForm({
  tv,
}: Props) {
  const [
    editing,
    setEditing,
  ] =
    useState(false);

  const [
    name,
    setName,
  ] =
    useState(
      tv.name
    );

  const [
    location,
    setLocation,
  ] =
    useState(
      tv.location
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      tv.description
    );

  const [
    active,
    setActive,
  ] =
    useState(
      tv.active
    );

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
      await updateTv({
        id:
          tv.id,

        name,

        location,

        description,

        active,
      });

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível atualizar."
      );

      setLoading(false);

      return;
    }

    setLoading(false);

    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() =>
          setEditing(true)
        }
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        <Pencil className="h-4 w-4" />

        Editar
      </button>
    );
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-4"
    >
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
          placeholder="Ex.: Centro"
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
          rows={3}
          className="input min-h-[90px]"
        />
      </Field>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={
            active
          }
          onChange={(
            event
          ) =>
            setActive(
              event.target
                .checked
            )
          }
        />

        <span className="text-sm font-medium text-slate-700">
          TV ativa
        </span>
      </label>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={
            loading
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Save className="h-4 w-4" />

          {loading
            ? "Salvando..."
            : "Salvar"}
        </button>

        <button
          type="button"
          disabled={
            loading
          }
          onClick={() =>
            setEditing(false)
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
        >
          <X className="h-4 w-4" />

          Cancelar
        </button>
      </div>
    </form>
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