"use client";

import { FormEvent, useState, useTransition } from "react";
import { X } from "lucide-react";

import {
  createSupplier,
  updateSupplier,
} from "@/app/(dashboard)/financeiro/configuracoes/actions";

export type QuickSupplier = {
  id: string;
  name: string;
  trade_name: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  phone: string | null;
};

export default function SupplierQuickModal({
  supplier,
  onClose,
  onSaved,
}: {
  supplier?: QuickSupplier;
  onClose: () => void;
  onSaved: (supplier: QuickSupplier) => void;
}) {
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

  const [phone, setPhone] = useState(
    supplier?.phone ?? ""
  );

  const [email, setEmail] = useState(
    supplier?.email ?? ""
  );

  const [isPending, startTransition] =
    useTransition();

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
            phone: phone || null,
            email: email || null,
          })
        : await createSupplier({
            name,
            tradeName: tradeName || null,
            cpfCnpj: cpfCnpj || null,
            phone: phone || null,
            email: email || null,
          });

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSaved({
        id: result.supplierId,
        name,
        trade_name: tradeName || null,
        cpf_cnpj: cpfCnpj || null,
        phone: phone || null,
        email: email || null,
      });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit
              ? "Editar fornecedor"
              : "Cadastrar fornecedor"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome / Razão Social">
              <input
                required
                autoFocus
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                className="input"
              />
            </Field>

            <Field label="Nome Fantasia">
              <input
                value={tradeName}
                onChange={(e) =>
                  setTradeName(e.target.value)
                }
                className="input"
              />
            </Field>

            <Field label="CPF / CNPJ">
              <input
                value={cpfCnpj}
                onChange={(e) =>
                  setCpfCnpj(e.target.value)
                }
                className="input"
              />
            </Field>

            <Field label="Telefone">
              <input
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value)
                }
                className="input"
              />
            </Field>

            <Field label="E-mail">
              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="input"
              />
            </Field>
          </div>

          <p className="text-xs text-slate-400">
            {isEdit
              ? "Outros dados do fornecedor (observações, WhatsApp, status) podem ser ajustados na tela de fornecedores."
              : "Você pode completar o cadastro (observações, WhatsApp) depois na tela de fornecedores."}
          </p>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-[#15704f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending
                ? "Salvando..."
                : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">
        {label}
      </span>

      {children}
    </label>
  );
}
