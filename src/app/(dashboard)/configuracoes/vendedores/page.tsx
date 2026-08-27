import Link from "next/link";

import {
  ArrowLeft,
  Users,
} from "lucide-react";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireAuthenticatedUser,
} from "@/app/lib/permissions";

import SellerManagement from "./seller-management";

export default async function SellersSettingsPage() {
  const access =
    await requireAuthenticatedUser();

  if (
    access.profile.role !==
    "admin"
  ) {
    return (
      <main className="min-h-screen bg-[#f5f7f6] p-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-red-100 bg-white p-8">
            <h1 className="text-xl font-semibold text-slate-900">
              Acesso restrito
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Apenas administradores podem configurar vendedores.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const supabase =
    await createClient();

  /*
   * =========================
   * USUÁRIOS
   * =========================
   */

  const {
    data: profiles,
    error: profilesError,
  } =
    await supabase
      .from("user_profiles")
      .select(`
        id,
        name,
        role,
        active
      `)
      .eq(
        "active",
        true
      )
      .order(
        "name"
      );

  if (profilesError) {
    console.error(
      "Erro ao carregar usuários:",
      profilesError
    );
  }

  /*
   * =========================
   * EMPRESAS
   * =========================
   */

  const {
    data: companies,
    error: companiesError,
  } =
    await supabase
      .from("companies")
      .select(`
        id,
        name
      `)
      .eq(
        "active",
        true
      )
      .order(
        "name"
      );

  if (companiesError) {
    console.error(
      "Erro ao carregar empresas:",
      companiesError
    );
  }

  /*
   * =========================
   * VENDEDORES
   * =========================
   */

  const {
    data: settings,
    error: settingsError,
  } =
    await supabase
      .from(
        "seller_settings"
      )
      .select(`
        id,
        user_id,
        company_id,
        active,
        commission_percentage,
        override_percentage,

        company:companies (
          id,
          name
        )
      `)
      .order(
        "created_at"
      );

  if (settingsError) {
    console.error(
      "Erro ao carregar vendedores:",
      settingsError
    );
  }

  const users =
    (
      profiles ??
      []
    ).map(
      (
        profile
      ) => ({
        id:
          profile.id,

        name:
          profile.name,

        role:
          profile.role,
      })
    );

  const companyOptions =
    (
      companies ??
      []
    ).map(
      (
        company
      ) => ({
        id:
          company.id,

        name:
          company.name,
      })
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">

        {/* VOLTAR */}

        <div className="mb-7">
          <Link
            href="/configuracoes"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />

            Configurações
          </Link>
        </div>

        {/* CABEÇALHO */}

        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
              <Users className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Vendedores
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Configure vendedores
                e percentuais de
                comissão.
              </p>
            </div>
          </div>
        </div>

        {/* GERENCIAMENTO */}

        <SellerManagement
          users={
            users
          }
          companies={
            companyOptions
          }
          settings={
            settings ??
            []
          }
        />
      </div>
    </main>
  );
}