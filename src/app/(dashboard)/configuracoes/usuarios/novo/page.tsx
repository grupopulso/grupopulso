import Link from "next/link";

import {
  ArrowLeft,
  Save,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";

import {
  requireAdmin,
} from "@/app/lib/permissions";

import {
  createUser,
} from "./actions";

type Company = {
  id: string;
  name: string;
  color: string | null;
};

const MODULES = [
  {
    module: "dashboard",
    label: "Visão Geral",
  },
  {
    module: "clients",
    label: "Clientes",
  },
  {
    module: "products",
    label: "Produtos e Serviços",
  },
  {
    module: "contracts",
    label: "Contratos e Assinaturas",
  },
  {
    module: "financial",
    label: "Financeiro",
  },
  {
    module: "accounts_receivable",
    label: "Contas a Receber",
  },
  {
    module: "accounts_payable",
    label: "Contas a Pagar",
  },
  {
    module: "receipts",
    label: "Recebimentos",
  },
  {
    module: "payments",
    label: "Pagamentos",
  },
  {
    module: "routes",
    label: "Rotas e Entregas",
  },
  {
    module: "reports",
    label: "Relatórios",
  },
  {
    module: "settings",
    label: "Configurações",
  },
];

export default async function NovoUsuarioPage() {
  await requireAdmin();

  const supabase =
    await createClient();

  const {
    data: companiesData,
    error,
  } = await supabase
    .from("companies")
    .select(`
      id,
      name,
      color
    `)
    .eq("active", true)
    .order("name");

  if (error) {
    console.error(
      "Erro ao carregar empresas:",
      JSON.stringify(
        error,
        null,
        2
      )
    );
  }

  const companies =
    (companiesData ??
      []) as Company[];

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/configuracoes/usuarios"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para usuários
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <UserPlus className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Novo usuário
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre um usuário e configure seu acesso à plataforma.
            </p>
          </div>
        </div>

        <form
          action={createUser}
          className="mt-7 space-y-6"
        >
          {/* DADOS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-[#15704f]" />

              <div>
                <h2 className="font-semibold text-slate-900">
                  Dados do usuário
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Informações utilizadas para acesso ao sistema.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Nome *">
                <input
                  name="name"
                  required
                  className="input"
                  placeholder="Nome completo"
                />
              </Field>

              <Field label="E-mail *">
                <input
                  type="email"
                  name="email"
                  required
                  className="input"
                  placeholder="usuario@empresa.com.br"
                />
              </Field>

              <Field label="Senha inicial *">
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  className="input"
                  placeholder="Mínimo de 6 caracteres"
                />
              </Field>

              <Field label="Função">
                <select
                  name="role"
                  defaultValue="viewer"
                  className="input"
                >
                  <option value="admin">
                    Administrador
                  </option>

                  <option value="manager">
                    Gestor
                  </option>

                  <option value="finance">
                    Financeiro
                  </option>

                  <option value="operations">
                    Operações
                  </option>

                  <option value="viewer">
                    Visualização
                  </option>
                </select>
              </Field>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Usuário ativo
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Usuários inativos não poderão acessar as áreas protegidas da plataforma.
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* EMPRESAS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <h2 className="font-semibold text-slate-900">
                Empresas permitidas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Selecione quais empresas este usuário poderá acessar.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {companies.map(
                (company) => (
                  <label
                    key={company.id}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-[#15704f]/30 hover:bg-[#15704f]/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            company.color ??
                            "#94a3b8",
                        }}
                      />

                      <span className="text-sm font-medium text-slate-700">
                        {company.name}
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      name="companies"
                      value={company.id}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </label>
                )
              )}

              {!companies.length && (
                <div className="col-span-full rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  Nenhuma empresa ativa cadastrada.
                </div>
              )}
            </div>
          </section>

          {/* PERMISSÕES */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15704f]/10">
                <ShieldCheck className="h-5 w-5 text-[#15704f]" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Permissões
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Defina o que este usuário poderá fazer em cada módulo.
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>
                      Módulo
                    </TableHeader>

                    <TableHeader>
                      Visualizar
                    </TableHeader>

                    <TableHeader>
                      Criar
                    </TableHeader>

                    <TableHeader>
                      Editar
                    </TableHeader>

                    <TableHeader>
                      Excluir
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {MODULES.map(
                    (item) => (
                      <tr
                        key={
                          item.module
                        }
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-800">
                            {item.label}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-400">
                            {item.module}
                          </p>
                        </td>

                        <PermissionCell
                          name={`${item.module}_view`}
                        />

                        <PermissionCell
                          name={`${item.module}_create`}
                        />

                        <PermissionCell
                          name={`${item.module}_edit`}
                        />

                        <PermissionCell
                          name={`${item.module}_delete`}
                        />
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-xs leading-5 text-amber-700">
                Administradores possuem acesso completo à plataforma independentemente das permissões individuais.
              </p>
            </div>
          </section>

          {/* AÇÕES */}

          <div className="flex justify-end gap-3 pb-8">
            <Link
              href="/configuracoes/usuarios"
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
            >
              <Save className="h-4 w-4" />
              Criar usuário
            </button>
          </div>
        </form>
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
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}

function TableHeader({
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

function PermissionCell({
  name,
}: {
  name: string;
}) {
  return (
    <td className="px-5 py-4">
      <input
        type="checkbox"
        name={name}
        className="h-4 w-4 rounded border-slate-300"
      />
    </td>
  );
}