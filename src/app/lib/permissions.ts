import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete";

export type UserPermission = {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export async function getCurrentUserAccess() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("user_profiles")
    .select(`
      id,
      name,
      role,
      active
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    return null;
  }

  const [
    permissionsResult,
    companiesResult,
  ] = await Promise.all([
    supabase
      .from("user_permissions")
      .select(`
        module,
        can_view,
        can_create,
        can_edit,
        can_delete
      `)
      .eq("user_id", user.id),

    supabase
      .from("user_companies")
      .select(`
        company_id
      `)
      .eq("user_id", user.id),
  ]);

  return {
    user,
    profile,

    permissions:
      (permissionsResult.data ??
        []) as UserPermission[],

    companyIds:
      (
        companiesResult.data ??
        []
      ).map(
        (item) =>
          item.company_id
      ),
  };
}

/*
 * Exige qualquer usuário autenticado,
 * com perfil existente e ativo.
 */
export async function requireAuthenticatedUser() {
  const access =
    await getCurrentUserAccess();

  if (!access) {
    redirect("/login");
  }

  if (!access.profile.active) {
    redirect(
      "/acesso-bloqueado"
    );
  }

  return access;
}

/*
 * SOMENTE ADMINISTRADOR.
 *
 * Usaremos em:
 * - Empresas
 * - Usuários
 * - Permissões
 * - configurações estruturais sensíveis
 */
export async function requireAdmin() {
  const access =
    await requireAuthenticatedUser();

  if (
    access.profile.role !==
    "admin"
  ) {
    redirect(
      "/sem-permissao"
    );
  }

  return access;
}

/*
 * Proteção baseada nas permissões
 * configuradas para cada módulo.
 */
export async function requireModulePermission(
  module: string,
  action: PermissionAction = "view"
) {
  const access =
    await requireAuthenticatedUser();

  /*
   * Administradores ignoram a matriz
   * de permissões e possuem acesso total.
   */
  if (
    access.profile.role ===
    "admin"
  ) {
    return access;
  }

  const permission =
    access.permissions.find(
      (item) =>
        item.module === module
    );

  if (!permission) {
    redirect(
      "/sem-permissao"
    );
  }

  const allowed =
    action === "view"
      ? permission.can_view
      : action === "create"
        ? permission.can_create
        : action === "edit"
          ? permission.can_edit
          : permission.can_delete;

  if (!allowed) {
    redirect(
      "/sem-permissao"
    );
  }

  return access;
}

/*
 * Útil para esconder botões e itens
 * de interface sem fazer redirect.
 */
export function canAccessModule(
  access:
    | Awaited<
        ReturnType<
          typeof getCurrentUserAccess
        >
      >
    | null,
  module: string,
  action: PermissionAction = "view"
) {
  if (!access) {
    return false;
  }

  if (
    !access.profile.active
  ) {
    return false;
  }

  if (
    access.profile.role ===
    "admin"
  ) {
    return true;
  }

  const permission =
    access.permissions.find(
      (item) =>
        item.module === module
    );

  if (!permission) {
    return false;
  }

  switch (action) {
    case "create":
      return permission.can_create;

    case "edit":
      return permission.can_edit;

    case "delete":
      return permission.can_delete;

    default:
      return permission.can_view;
  }
}

/*
 * Verifica se o usuário pode acessar
 * uma empresa específica.
 *
 * Admin pode acessar todas.
 *
 * Demais usuários precisam possuir
 * vínculo em user_companies.
 */
export async function requireCompanyAccess(
  companyId: string
) {
  const access =
    await requireAuthenticatedUser();

  if (
    access.profile.role ===
    "admin"
  ) {
    return access;
  }

  if (
    !access.companyIds.includes(
      companyId
    )
  ) {
    redirect(
      "/sem-permissao"
    );
  }

  return access;
}