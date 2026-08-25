"use client";

import { Plus } from "lucide-react";

import {
  useState,
  useTransition,
} from "react";

import {
  createPaymentMethod,
} from "@/app/(dashboard)/configuracoes/formas-pagamento/actions";

export default function PaymentMethodForm() {
  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    name,
    setName,
  ] = useState("");

  const [
    code,
    setCode,
  ] = useState("");

  const [
    usageType,
    setUsageType,
  ] = useState("both");

  const [
    error,
    setError,
  ] = useState("");

  function submit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const formData =
      new FormData();

    formData.set(
      "name",
      name
    );

    formData.set(
      "code",
      code
    );

    formData.set(
      "usage_type",
      usageType
    );

    setError("");

    startTransition(
      async () => {
        const result =
          await createPaymentMethod(
            formData
          );

        if (
          !result.success
        ) {
          setError(
            result.message ??
              "Não foi possível cadastrar."
          );

          return;
        }

        setName("");
        setCode("");
        setUsageType(
          "both"
        );
      }
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div>
        <h2 className="font-semibold text-slate-900">
          Nova forma de pagamento
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Adicione uma nova opção para o financeiro.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_220px_220px_auto]">
        <input
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
          }
          placeholder="Nome"
          className="h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#15704f]"
        />

        <input
          value={code}
          onChange={(event) =>
            setCode(
              event.target.value
            )
          }
          placeholder="Identificador"
          className="h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#15704f]"
        />

        <select
          value={
            usageType
          }
          onChange={(event) =>
            setUsageType(
              event.target.value
            )
          }
          className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#15704f]"
        >
          <option value="both">
            Receber e pagar
          </option>

          <option value="income">
            Somente recebimentos
          </option>

          <option value="expense">
            Somente pagamentos
          </option>
        </select>

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />

          {pending
            ? "Salvando..."
            : "Adicionar"}
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Se deixar o identificador vazio, ele será criado automaticamente a partir do nome.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </form>
  );
}