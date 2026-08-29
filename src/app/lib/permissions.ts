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
 * =====================================================
 * FINANCEIRO — ACESSO POR NATUREZA DO LANÇAMENTO
 * =====================================================
 *
 * O módulo "financial" é o acesso GERAL (visão consolidada,
 * fluxo, contas a pagar + receber juntos). Além dele existem
 * módulos específicos por natureza:
 *
 *   receita  → accounts_receivable (cadastro/controle) + receipts (baixa)
 *   despesa  → accounts_payable    (cadastro/controle) + payments  (baixa)
 *
 * Quem tem "financial" pode tudo. Quem só tem o específico
 * (ex.: uma pessoa que só mexe com contas a receber) age
 * apenas naquela natureza, sem ver o geral da empresa.
 */

const FINANCIAL_MODULES_BY_TYPE = {
  income: ["accounts_receivable", "receipts"],
  expense: ["accounts_payable", "payments"],
} as const;

/*
 * Exige acesso a UM lançamento de natureza conhecida
 * (receita ou despesa). Passa se o usuário tiver a
 * permissão no módulo geral "financial" OU em um dos
 * módulos específicos da natureza (accounts_receivable /
 * receipts para receita; accounts_payable / payments para
 * despesa). Senão, redireciona para /sem-permissao.
 */
export async function requireFinancialEntryAccess(
  type: "income" | "expense",
  action: PermissionAction = "view"
) {
  const access =
    await requireAuthenticatedUser();

  if (
    access.profile.role === "admin"
  ) {
    return access;
  }

  const modules = [
    "financial",
    ...FINANCIAL_MODULES_BY_TYPE[type],
  ];

  if (
    modules.some((module) =>
      canAccessModule(
        access,
        module,
        action
      )
    )
  ) {
    return access;
  }

  redirect("/sem-permissao");
}

/*
 * Para o formulário de novo lançamento: descobre quais
 * naturezas o usuário pode criar. Redireciona se não
 * puder criar nenhuma.
 */
export async function requireFinancialCreateAccess() {
  const access =
    await requireAuthenticatedUser();

  const isAdmin =
    access.profile.role === "admin";

  const canIncome =
    isAdmin ||
    canAccessModule(
      access,
      "financial",
      "create"
    ) ||
    canAccessModule(
      access,
      "accounts_receivable",
      "create"
    );

  const canExpense =
    isAdmin ||
    canAccessModule(
      access,
      "financial",
      "create"
    ) ||
    canAccessModule(
      access,
      "accounts_payable",
      "create"
    );

  if (!canIncome && !canExpense) {
    redirect("/sem-permissao");
  }

  return {
    access,
    canIncome,
    canExpense,
  };
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

/*
 * Igual a requireCompanyAccess, mas para registros que
 * se relacionam com VÁRIAS empresas (ex.: cliente é N:N
 * com empresa via client_companies).
 *
 * Admin sempre passa. Os demais precisam ter vínculo com
 * pelo menos uma das empresas informadas.
 *
 * Uma lista vazia significa que o registro não pertence a
 * nenhuma empresa — nesse caso só admin acessa.
 */
export async function requireAnyCompanyAccess(
  companyIds: string[]
) {
  const access =
    await requireAuthenticatedUser();

  if (
    access.profile.role ===
    "admin"
  ) {
    return access;
  }

  const hasAccess =
    companyIds.some(
      (companyId) =>
        access.companyIds.includes(
          companyId
        )
    );

  if (!hasAccess) {
    redirect(
      "/sem-permissao"
    );
  }

  return access;
}