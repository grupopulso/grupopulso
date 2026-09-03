import Link from "next/link";

import {
  ShieldCheck,
  UserCog,
  Users,
    UserPlus,
} from "lucide-react";

import {
  createClient as createSupabaseAdminClient,
} from "@supabase/supabase-js";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireAdmin,
} from "@/app/lib/permissions";
import {
  isSellerOnlyEmail,
} from "@/app/lib/seller-only";

async function fetchEmailsById(): Promise<
  Map<string, string>
> {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const map = new Map<string, string>();

  if (!url || !serviceRoleKey) {
    return map;
  }

  try {
    const admin = createSupabaseAdminClient(
      url,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data } =
      await admin.auth.admin.listUsers({
        perPage: 1000,
      });

    for (const user of data?.users ?? []) {
      if (user.email) {
        map.set(user.id, user.email);
      }
    }
  } catch {
    // segue sem os e-mails
  }

  return map;
}

type Company = {
  id: string;
  name: string;
  color: string | null;
};

type UserCompanyRelation = {
  company:
    | Company
    | Company[]
    | null;
};

export default async function UsuariosPage() {
    await requireAdmin();

  const supabase = await createClient();

  const emailsById = await fetchEmailsById();

  const {
    data: profiles,
    error,
  } = await supabase
    .from("user_profiles")
    .select(`
      id,
      name,
      role,
      active,
      created_at,

      user_companies (
        company:companies (
          id,
          name,
          color
        )
      )
    `)
    .order("name");

  if (error) {
    console.error(
      "Erro ao carregar usuários:",
      error
    );
  }

  const totalUsers =
    profiles?.length ?? 0;

  const activeUsers =
    profiles?.filter(
      (profile) => profile.active
    ).length ?? 0;

  const admins =
    profiles?.filter(
      (profile) =>
        profile.role === "admin"
    ).length ?? 0;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
  <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
      <Users className="h-5 w-5 text-[#15704f]" />
    </div>

    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Usuários e Permissões
      </h1>

      <p className="mt-1 text-sm text-slate-500">
        Gerencie perfis, acessos e permissões dos usuários da plataforma.
      </p>
    </div>
  </div>

  <Link
    href="/configuracoes/usuarios/novo"
    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
  >
    <UserPlus className="h-4 w-4" />
    Novo usuário
  </Link>
</div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
          <SummaryCard
            label="Usuários"
            value={String(
              totalUsers
            )}
          />

          <SummaryCard
            label="Ativos"
            value={String(
              activeUsers
            )}
          />

          <SummaryCard
            label="Administradores"
            value={String(
              admins
            )}
          />
        </div>

        <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-900">
              Usuários cadastrados
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Clique em um usuário para configurar perfil, empresas e permissões.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <Header>
                    Usuário
                  </Header>

                  <Header>
                    Perfil
                  </Header>

                  <Header>
                    Empresas
                  </Header>

                  <Header>
                    Situação
                  </Header>

                  <Header>
                    Acesso
                  </Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {profiles?.map(
                  (profile) => {
                    const email =
                      emailsById.get(
                        profile.id
                      ) ?? null;

                    const sellerOnly =
                      isSellerOnlyEmail(
                        email
                      );

                    const companies =
                      (
                        profile.user_companies ??
                        []
                      )
                        .map(
                          (
                            relation: UserCompanyRelation
                          ) =>
                            getFirst<Company>(
                              relation.company
                            )
                        )
                        .filter(
                          (
                            company
                          ): company is Company =>
                            Boolean(company)
                        );

                    return (
                      <tr
                        key={
                          profile.id
                        }
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/configuracoes/usuarios/${profile.id}`}
                            className="flex items-center gap-3"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#15704f]/10">
                              <UserCog className="h-5 w-5 text-[#15704f]" />
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-900 hover:text-[#15704f]">
                                {profile.name ||
                                  "Usuário sem nome"}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {sellerOnly
                                  ? "Sem acesso ao sistema"
                                  : (email ??
                                    "—")}
                              </p>
                            </div>
                          </Link>
                        </td>

                        <td className="px-5 py-4">
                          {sellerOnly ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Vendedor (sem acesso)
                            </span>
                          ) : (
                            <RoleBadge
                              role={
                                profile.role
                              }
                            />
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex max-w-md flex-wrap gap-2">
                            {companies.map(
                              (
                                company
                              ) => (
                                <span
                                  key={
                                    company.id
                                  }
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{
                                      backgroundColor:
                                        company.color ??
                                        "#94a3b8",
                                    }}
                                  />

                                  {
                                    company.name
                                  }
                                </span>
                              )
                            )}

                            {!companies.length && (
                              <span className="text-sm text-slate-400">
                                Todas / não configurado
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            active={
                              profile.active
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <Link
                            href={`/configuracoes/usuarios/${profile.id}`}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-[#15704f] hover:underline"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Configurar
                          </Link>
                        </td>
                      </tr>
                    );
                  }
                )}

                {!profiles?.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-14 text-center"
                    >
                      <Users className="mx-auto h-7 w-7 text-slate-300" />

                      <p className="mt-3 text-sm font-medium text-slate-500">
                        Nenhum perfil de usuário cadastrado.
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Os usuários autenticados precisam possuir um registro em user_profiles.
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

function RoleBadge({
  role,
}: {
  role: string;
}) {
  const labels: Record<
    string,
    string
  > = {
    admin:
      "Administrador",

    manager:
      "Gestor",

    finance:
      "Financeiro",

    operations:
      "Operações",

    viewer:
      "Visualização",
  };

  const styles: Record<
    string,
    string
  > = {
    admin:
      "bg-violet-50 text-violet-700",

    manager:
      "bg-blue-50 text-blue-700",

    finance:
      "bg-emerald-50 text-emerald-700",

    operations:
      "bg-orange-50 text-orange-700",

    viewer:
      "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[role] ??
        styles.viewer
      }`}
    >
      {labels[role] ??
        role}
    </span>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
      }`}
    >
      {active
        ? "Ativo"
        : "Bloqueado"}
    </span>
  );
}

function getFirst<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}