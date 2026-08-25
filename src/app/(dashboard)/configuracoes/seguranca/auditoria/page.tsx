import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  FileClock,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";

import {
  requireAdmin,
} from "@/app/lib/permissions";

type SearchParams = Promise<{
  module?: string;
  action?: string;
  user?: string;
  start?: string;
  end?: string;
}>;

type PageProps = {
  searchParams: SearchParams;
};

type AuditLog = {
  id: string;
  user_id: string | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  old_data: unknown;
  new_data: unknown;
  created_at: string;
};

type UserProfile = {
  id: string;
  name: string | null;
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Visão Geral",
  clients: "Clientes",
  subscribers: "Assinantes",
  routes: "Rotas",
  products: "Produtos",
  contracts: "Contratos",
  financial: "Financeiro",
  accounts_receivable: "Contas a Receber",
  accounts_payable: "Contas a Pagar",
  receipts: "Recebimentos",
  payments: "Pagamentos",
  reports: "Relatórios",
  settings: "Configurações",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Alteração",
  delete: "Exclusão",
  login: "Login",
  logout: "Logout",
  payment: "Pagamento",
  receipt: "Recebimento",
  other: "Outro",
};

export default async function AuditoriaPage({
  searchParams,
}: PageProps) {
  await requireAdmin();

  const params =
    await searchParams;

  const supabase =
    await createClient();

  const [
    usersResult,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select(`
        id,
        name
      `)
      .order("name"),
  ]);

  const users =
    (usersResult.data ??
      []) as UserProfile[];

  let query = supabase
    .from("audit_logs")
    .select(`
      id,
      user_id,
      module,
      action,
      entity_type,
      entity_id,
      description,
      old_data,
      new_data,
      created_at
    `)
    .order("created_at", {
      ascending: false,
    })
    .limit(500);

  if (params.module) {
    query = query.eq(
      "module",
      params.module
    );
  }

  if (params.action) {
    query = query.eq(
      "action",
      params.action
    );
  }

  if (params.user) {
    query = query.eq(
      "user_id",
      params.user
    );
  }

  if (params.start) {
    query = query.gte(
      "created_at",
      `${params.start}T00:00:00`
    );
  }

  if (params.end) {
    query = query.lte(
      "created_at",
      `${params.end}T23:59:59`
    );
  }

  const {
    data: logsData,
    error,
  } = await query;

  if (error) {
    console.error(
      "Erro ao carregar auditoria:",
      JSON.stringify(
        error,
        null,
        2
      )
    );
  }

  const logs =
    (logsData ??
      []) as AuditLog[];

  const userMap =
    new Map(
      users.map(
        (user) => [
          user.id,
          user.name ||
            "Usuário sem nome",
        ]
      )
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-[1500px]">
        <Link
          href="/configuracoes/seguranca"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Segurança
        </Link>

        <div className="mt-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <FileClock className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Auditoria
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Histórico das ações realizadas dentro da plataforma.
            </p>
          </div>
        </div>

        <form
          method="GET"
          className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />

            <h2 className="text-sm font-semibold text-slate-900">
              Filtros
            </h2>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <FilterField label="Módulo">
              <select
                name="module"
                defaultValue={
                  params.module ??
                  ""
                }
                className="input"
              >
                <option value="">
                  Todos
                </option>

                {Object.entries(
                  MODULE_LABELS
                ).map(
                  ([key, label]) => (
                    <option
                      key={key}
                      value={key}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </FilterField>

            <FilterField label="Ação">
              <select
                name="action"
                defaultValue={
                  params.action ??
                  ""
                }
                className="input"
              >
                <option value="">
                  Todas
                </option>

                {Object.entries(
                  ACTION_LABELS
                ).map(
                  ([key, label]) => (
                    <option
                      key={key}
                      value={key}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </FilterField>

            <FilterField label="Usuário">
              <select
                name="user"
                defaultValue={
                  params.user ??
                  ""
                }
                className="input"
              >
                <option value="">
                  Todos
                </option>

                {users.map(
                  (user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.name ||
                        "Usuário sem nome"}
                    </option>
                  )
                )}
              </select>
            </FilterField>

            <FilterField label="De">
              <input
                type="date"
                name="start"
                defaultValue={
                  params.start ??
                  ""
                }
                className="input"
              />
            </FilterField>

            <FilterField label="Até">
              <input
                type="date"
                name="end"
                defaultValue={
                  params.end ??
                  ""
                }
                className="input"
              />
            </FilterField>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Link
              href="/configuracoes/seguranca/auditoria"
              className="flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
            >
              Limpar
            </Link>

            <button
              type="submit"
              className="h-10 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white"
            >
              Filtrar
            </button>
          </div>
        </form>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
          <SummaryCard
            label="Registros encontrados"
            value={String(
              logs.length
            )}
          />

          <SummaryCard
            label="Usuários"
            value={String(
              new Set(
                logs
                  .map(
                    (log) =>
                      log.user_id
                  )
                  .filter(Boolean)
              ).size
            )}
          />

          <SummaryCard
            label="Módulos movimentados"
            value={String(
              new Set(
                logs.map(
                  (log) =>
                    log.module
                )
              ).size
            )}
          />
        </div>

        <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-900">
              Histórico de atividades
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Os registros mais recentes aparecem primeiro.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <Header>
                    Data
                  </Header>

                  <Header>
                    Usuário
                  </Header>

                  <Header>
                    Módulo
                  </Header>

                  <Header>
                    Ação
                  </Header>

                  <Header>
                    Descrição
                  </Header>

                  <Header>
                    Entidade
                  </Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {logs.map(
                  (log) => (
                    <tr
                      key={log.id}
                      className="align-top transition hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-slate-400" />

                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              {formatDateTime(
                                log.created_at
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <UserRound className="h-4 w-4 text-slate-400" />

                          <span className="text-sm text-slate-700">
                            {log.user_id
                              ? userMap.get(
                                  log.user_id
                                ) ??
                                "Usuário removido"
                              : "Sistema"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {MODULE_LABELS[
                            log.module
                          ] ??
                            log.module}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <ActionBadge
                          action={
                            log.action
                          }
                        />
                      </td>

                      <td className="max-w-xl px-5 py-4">
                        <p className="text-sm leading-6 text-slate-700">
                          {log.description}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {log.entity_type ? (
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              {log.entity_type}
                            </p>

                            {log.entity_id && (
                              <p className="mt-1 max-w-[180px] truncate text-xs text-slate-400">
                                {log.entity_id}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )}

                {!logs.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-16 text-center"
                    >
                      <ShieldCheck className="mx-auto h-7 w-7 text-slate-300" />

                      <p className="mt-3 text-sm font-semibold text-slate-500">
                        Nenhum registro encontrado.
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Os eventos começarão a aparecer conforme as ações de auditoria forem integradas ao sistema.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>

      {children}
    </label>
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

function ActionBadge({
  action,
}: {
  action: string;
}) {
  const labels: Record<string, string> = {
    create: "Criação",
    update: "Alteração",
    delete: "Exclusão",
    login: "Login",
    logout: "Logout",
    payment: "Pagamento",
    receipt: "Recebimento",
    other: "Outro",
  };

  const styles: Record<string, string> = {
    create:
      "bg-emerald-50 text-emerald-700",

    update:
      "bg-blue-50 text-blue-700",

    delete:
      "bg-red-50 text-red-700",

    login:
      "bg-violet-50 text-violet-700",

    logout:
      "bg-slate-100 text-slate-600",

    payment:
      "bg-orange-50 text-orange-700",

    receipt:
      "bg-emerald-50 text-emerald-700",

    other:
      "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[action] ??
        styles.other
      }`}
    >
      {labels[action] ??
        action}
    </span>
  );
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
      timeZone:
        "America/Sao_Paulo",
    }
  ).format(
    new Date(value)
  );
}