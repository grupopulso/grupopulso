"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  FileCheck2,
  Send,
} from "lucide-react";

import {
  updateFinancialDocumentStatus,
} from "./document-actions";

type Props = {
  entryId: string;

  invoiceIssued: boolean;

  invoiceNumber:
    | string
    | null;

  invoiceIssuedAt:
    | string
    | null;

  chargeSent: boolean;

  chargeSentAt:
    | string
    | null;
};

export default function FinancialDocumentControls({
  entryId,
  invoiceIssued,
  invoiceNumber,
  invoiceIssuedAt,
  chargeSent,
  chargeSentAt,
}: Props) {
  const router =
    useRouter();

  const [
    invoice,
    setInvoice,
  ] =
    useState(
      invoiceIssued
    );

  const [
    invoiceNumberValue,
    setInvoiceNumberValue,
  ] =
    useState(
      invoiceNumber ??
        ""
    );

  const [
    invoiceDate,
    setInvoiceDate,
  ] =
    useState(
      invoiceIssuedAt ??
        today()
    );

  const [
    charged,
    setCharged,
  ] =
    useState(
      chargeSent
    );

  const [
    chargeDate,
    setChargeDate,
  ] =
    useState(
      chargeSentAt
        ? chargeSentAt.slice(
            0,
            10
          )
        : today()
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

  const [
    success,
    setSuccess,
  ] =
    useState("");

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const result =
      await updateFinancialDocumentStatus(
        entryId,
        {
          invoiceIssued:
            invoice,

          invoiceNumber:
            invoice
              ? invoiceNumberValue
              : null,

          invoiceIssuedAt:
            invoice
              ? invoiceDate
              : null,

          chargeSent:
            charged,

          chargeSentAt:
            charged
              ? chargeDate
              : null,
        }
      );

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível atualizar as informações."
      );

      setLoading(false);

      return;
    }

    setSuccess(
      "Informações atualizadas com sucesso."
    );

    setLoading(false);

    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">
        Nota fiscal e cobrança
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Controle a emissão da nota
        fiscal e o envio da cobrança.
      </p>

      <form
        onSubmit={
          handleSubmit
        }
        className="mt-6"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* NOTA FISCAL */}

          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15704f]/10 text-[#15704f]">
                <FileCheck2 className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-slate-900">
                  Nota Fiscal
                </p>

                <p className="text-sm text-slate-500">
                  Registre se a NF
                  já foi emitida.
                </p>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={
                  invoice
                }
                onChange={(
                  event
                ) =>
                  setInvoice(
                    event.target
                      .checked
                  )
                }
                className="h-4 w-4"
              />

              <span className="text-sm font-medium text-slate-700">
                Nota fiscal emitida
              </span>
            </label>

            {invoice && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Número da NF">
                  <input
                    value={
                      invoiceNumberValue
                    }
                    onChange={(
                      event
                    ) =>
                      setInvoiceNumberValue(
                        event.target
                          .value
                      )
                    }
                    placeholder="Ex.: 12345"
                    className="input"
                  />
                </Field>

                <Field label="Data de emissão">
                  <input
                    type="date"
                    value={
                      invoiceDate
                    }
                    onChange={(
                      event
                    ) =>
                      setInvoiceDate(
                        event.target
                          .value
                      )
                    }
                    className="input"
                  />
                </Field>
              </div>
            )}
          </div>

          {/* COBRANÇA */}

          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Send className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-slate-900">
                  Cobrança
                </p>

                <p className="text-sm text-slate-500">
                  Informe se a
                  cobrança já foi
                  enviada.
                </p>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={
                  charged
                }
                onChange={(
                  event
                ) =>
                  setCharged(
                    event.target
                      .checked
                  )
                }
                className="h-4 w-4"
              />

              <span className="text-sm font-medium text-slate-700">
                Cobrança enviada
              </span>
            </label>

            {charged && (
              <div className="mt-5">
                <Field label="Data do envio">
                  <input
                    type="date"
                    value={
                      chargeDate
                    }
                    onChange={(
                      event
                    ) =>
                      setChargeDate(
                        event.target
                          .value
                      )
                    }
                    className="input"
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={
              loading
            }
            className="h-11 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Salvando..."
              : "Salvar NF / Cobrança"}
          </button>
        </div>
      </form>
    </section>
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

function today() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}