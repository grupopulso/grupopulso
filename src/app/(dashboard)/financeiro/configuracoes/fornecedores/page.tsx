import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";

export default async function FornecedoresPage() {
  const supabase = await createClient();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select(`
      id,
      name,
      trade_name,
      cpf_cnpj,
      email,
      phone,
      active
    `)
    .order("name");

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Fornecedores
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Fornecedores utilizados nas contas a pagar.
            </p>
          </div>

          <Link
            href="/financeiro/configuracoes/fornecedores/novo"
            className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Novo fornecedor
          </Link>
        </div>

        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <Header>Fornecedor</Header>
                <Header>CPF / CNPJ</Header>
                <Header>Telefone</Header>
                <Header>E-mail</Header>
                <Header>Status</Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {suppliers?.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {supplier.name}
                    </p>

                    {supplier.trade_name && (
                      <p className="mt-1 text-xs text-slate-400">
                        {supplier.trade_name}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {supplier.cpf_cnpj || "—"}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {supplier.phone || "—"}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {supplier.email || "—"}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        supplier.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {supplier.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}

              {!suppliers?.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    Nenhum fornecedor cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Header({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}