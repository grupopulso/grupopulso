import Link from "next/link";
import {
  ArrowLeft,
  UserCog,
} from "lucide-react";

import {
  notFound,
} from "next/navigation";

import {
  createClient as createSupabaseAdminClient,
} from "@supabase/supabase-js";

import { createClient } from "@/app/lib/supabase/server";

import UserAccessForm from "@/app/components/user-access-form";
import DeleteUserButton from "./delete-user-button";
import {
  requireAdmin,
} from "@/app/lib/permissions";

async function fetchUserEmail(
  userId: string
): Promise<string | null> {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
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
      await admin.auth.admin.getUserById(
        userId
      );

    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const MODULES = [
  {
    key: "dashboard",
    name: "Visão Geral",
  },
  {
    key: "clients",
    name: "Clientes",
  },
  {
    key: "subscribers",
    name: "Assinantes",
  },
  {
    key: "routes",
    name: "Rotas e Entregas",
  },
  {
    key: "products",
    name: "Produtos e Serviços",
  },
  {
    key: "contracts",
    name: "Contratos e Assinaturas",
  },
  {
    key: "financial",
    name: "Financeiro",
  },
  {
    key: "accounts_receivable",
    name: "Contas a Receber",
  },
  {
    key: "accounts_payable",
    name: "Contas a Pagar",
  },
  {
    key: "receipts",
    name: "Recebimentos",
  },
  {
    key: "payments",
    name: "Pagamentos",
  },
  {
    key: "reports",
    name: "Relatórios",
  },
  {
    key: "settings",
    name: "Configurações",
  },
];

export default async function UsuarioPage({
  params,
}: PageProps) {
    await requireAdmin();

  const { id } =
    await params;

  const supabase =
    await createClient();

  const userEmail = await fetchUserEmail(id);

  const [
    profileResult,
    companiesResult,
    userCompaniesResult,
    permissionsResult,
  ] = await Promise.all([
    supabase
      .from(
        "user_profiles"
      )
      .select(`
        id,
        name,
        role,
        active
      `)
      .eq("id", id)
      .maybeSingle(),

    supabase
      .from("companies")
      .select(`
        id,
        name,
        color
      `)
      .eq(
        "active",
        true
      )
      .order("name"),

    supabase
      .from(
        "user_companies"
      )
      .select(`
        company_id
      `)
      .eq(
        "user_id",
        id
      ),

    supabase
      .from(
        "user_permissions"
      )
      .select(`
        module,
        can_view,
        can_create,
        can_edit,
        can_delete
      `)
      .eq(
        "user_id",
        id
      ),
  ]);

  const profile =
    profileResult.data;

  if (
    profileResult.error ||
    !profile
  ) {
    console.error(
      "Erro ao carregar usuário:",
      profileResult.error
    );

    notFound();
  }

  if (
    companiesResult.error
  ) {
    console.error(
      "Erro ao carregar empresas:",
      companiesResult.error
    );
  }

  if (
    userCompaniesResult.error
  ) {
    console.error(
      "Erro ao carregar empresas do usuário:",
      userCompaniesResult.error
    );
  }

  if (
    permissionsResult.error
  ) {
    console.error(
      "Erro ao carregar permissões:",
      permissionsResult.error
    );
  }

  const companies =
    companiesResult.data ??
    [];

  const selectedCompanyIds =
    (
      userCompaniesResult.data ??
      []
    ).map(
      (relation) =>
        relation.company_id
    );

  const permissions =
    permissionsResult.data ??
    [];

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/configuracoes/usuarios"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos usuários
        </Link>

        <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#15704f]/10">
              <UserCog className="h-6 w-6 text-[#15704f]" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {profile.name ||
                  "Usuário sem nome"}
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                {userEmail ??
                  "E-mail não disponível"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Configure o perfil, empresas e permissões deste usuário.
              </p>
            </div>
          </div>

          <DeleteUserButton
            userId={profile.id}
            userName={
              profile.name ??
              "este usuário"
            }
          />
        </div>

        <UserAccessForm
          profile={{
            id:
              profile.id,

            name:
              profile.name,

            role:
              profile.role,

            active:
              profile.active,
          }}
          companies={
            companies
          }
          selectedCompanyIds={
            selectedCompanyIds
          }
          permissions={
            permissions
          }
          modules={
            MODULES
          }
        />
      </div>
    </main>
  );
}