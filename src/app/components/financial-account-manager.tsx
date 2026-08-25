"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/app/lib/supabase/client";

type Company = {
  id: string;
  name: string;
};

type Account = {
  id: string;
  name: string;
  type: string;
  bank_name: string | null;
  initial_balance: number;
  company_id: string | null;
  company:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

export default function FinancialAccountManager({
  initialAccounts,
  companies,
}: {
  initialAccounts: Account[];
  companies: Company[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [bankName, setBankName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [balance, setBalance] = useState("0,00");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    await supabase
      .from("financial_accounts")
      .insert({
        name,
        type,
        bank_name: bankName || null,
        company_id: companyId || null,
        initial_balance: parseMoney(balance),
        active: true,
      });

    setName("");
    setBankName("");
    setBalance("0,00");

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold text-slate-900">
          Contas e Caixas
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Cadastre bancos, caixas e carteiras utilizadas
          pelas empresas.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nome da conta">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Sicredi O Estafeta"
                className="input"
              />
            </Field>

            <Field label="Empresa">
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="input"
              >
                <option value="">
                  Grupo Pulso / Compartilhada
                </option>

                {companies.map((company) => (
                  <option
                    key={company.id}
                    value={company.id}
                  >
                    {company.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tipo">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input"
              >
                <option value="bank">
                  Conta bancária
                </option>
                <option value="cash">Caixa</option>
                <option value="digital_wallet">
                  Carteira digital
                </option>
                <option value="other">Outro</option>
              </select>
            </Field>

            <Field label="Banco">
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Sicredi, Banrisul..."
                className="input"
              />
            </Field>

            <Field label="Saldo inicial">
              <input
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <button className="mt-5 rounded-xl bg-[#15704f] px-5 py-3 text-sm font-semibold text-white">
            Adicionar conta
          </button>
        </form>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {initialAccounts.map((account) => {
            const company = Array.isArray(account.company)
              ? account.company[0]
              : account.company;

            return (
              <div
                key={account.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <p className="font-semibold text-slate-900">
                  {account.name}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {company?.name ?? "Grupo Pulso"}
                </p>

                <div className="mt-5">
                  <p className="text-xs uppercase text-slate-400">
                    Saldo inicial
                  </p>

                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {formatCurrency(
                      Number(account.initial_balance)
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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

function parseMoney(value: string) {
  return (
    Number(
      value
        .replace(/\./g, "")
        .replace(",", ".")
    ) || 0
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}