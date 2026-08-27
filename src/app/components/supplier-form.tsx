"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

import { createSupplier } from "@/app/(dashboard)/financeiro/configuracoes/actions";

export default function SupplierForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await createSupplier({
        name,
        tradeName: tradeName || null,
        cpfCnpj: cpfCnpj || null,
        email: email || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        notes: notes || null,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(
        "/financeiro/configuracoes/fornecedores"
      );

      router.refresh();
    });
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-4xl"
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-2 text-sm text-slate-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Novo fornecedor
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre um fornecedor para utilização nas
              despesas.
            </p>
          </div>

          <button
            disabled={isPending}
            className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nome / Razão Social">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Nome Fantasia">
              <input
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="CPF / CNPJ">
              <input
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Telefone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="WhatsApp">
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="E-mail">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Observações">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="input min-h-[110px]"
              />
            </Field>
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
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}