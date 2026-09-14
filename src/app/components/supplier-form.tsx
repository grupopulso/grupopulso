"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

import {
  createSupplier,
  updateSupplier,
} from "@/app/(dashboard)/financeiro/configuracoes/actions";

type SupplierData = {
  id: string;
  name: string;
  trade_name: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  active: boolean;
};

export default function SupplierForm({
  supplier,
}: {
  supplier?: SupplierData;
}) {
  const router = useRouter();
  const isEdit = Boolean(supplier);

  const [name, setName] = useState(
    supplier?.name ?? ""
  );
  const [tradeName, setTradeName] = useState(
    supplier?.trade_name ?? ""
  );
  const [cpfCnpj, setCpfCnpj] = useState(
    supplier?.cpf_cnpj ?? ""
  );
  const [email, setEmail] = useState(
    supplier?.email ?? ""
  );
  const [phone, setPhone] = useState(
    supplier?.phone ?? ""
  );
  const [whatsapp, setWhatsapp] = useState(
    supplier?.whatsapp ?? ""
  );
  const [notes, setNotes] = useState(
    supplier?.notes ?? ""
  );
  const [active, setActive] = useState(
    supplier?.active ?? true
  );

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = isEdit
        ? await updateSupplier({
            id: supplier!.id,
            name,
            tradeName: tradeName || null,
            cpfCnpj: cpfCnpj || null,
            email: email || null,
            phone: phone || null,
            whatsapp: whatsapp || null,
            notes: notes || null,
            active,
          })
        : await createSupplier({
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
              {isEdit
                ? "Editar fornecedor"
                : "Novo fornecedor"}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {isEdit
                ? "Atualize os dados deste fornecedor."
                : "Cadastre um fornecedor para utilização nas despesas."}
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

          {isEdit && (
            <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) =>
                  setActive(e.target.checked)
                }
                className="h-4 w-4"
              />
              Fornecedor ativo
            </label>
          )}
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