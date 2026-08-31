import {
  notFound,
} from "next/navigation";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  canAccessModule,
  requireAuthenticatedUser,
} from "@/app/lib/permissions";

/*
 * Módulos que, quando concedidos, também liberam a área do
 * O Estafeta (assinaturas / edições) — sem precisar do
 * vínculo direto com a empresa.
 */
const ESTAFETA_MODULES = [
  "subscriptions",
  "editions",
];

export async function requireEstafetaAccess() {
  const access =
    await requireAuthenticatedUser();

  const supabase =
    await createClient();

  /*
   * Administrador tem acesso
   * a todas as empresas.
   */
  if (
    access.profile.role ===
    "admin"
  ) {
    const {
      data: company,
      error,
    } =
      await supabase
        .from("companies")
        .select(`
          id,
          name,
          slug,
          color
        `)
        .eq(
          "slug",
          "o-estafeta"
        )
        .eq(
          "active",
          true
        )
        .maybeSingle();

    if (
      error ||
      !company
    ) {
      notFound();
    }

    return {
      ...access,

      estafetaCompany:
        company,
    };
  }

  /*
   * Usuários comuns entram se
   * tiverem permissão explícita
   * em Assinaturas ou Edições
   * (configurada na matriz de
   * acesso), mesmo sem vínculo
   * direto com a empresa.
   */
  const hasEstafetaModule =
    ESTAFETA_MODULES.some(
      (module) =>
        canAccessModule(
          access,
          module,
          "view"
        )
    );

  if (hasEstafetaModule) {
    const {
      data: company,
      error,
    } =
      await supabase
        .from("companies")
        .select(`
          id,
          name,
          slug,
          color
        `)
        .eq(
          "slug",
          "o-estafeta"
        )
        .eq(
          "active",
          true
        )
        .maybeSingle();

    if (
      error ||
      !company
    ) {
      notFound();
    }

    return {
      ...access,

      estafetaCompany:
        company,
    };
  }

  /*
   * Caso contrário, precisam
   * possuir vínculo com
   * O Estafeta.
   */

  const {
    data: relation,
    error,
  } =
    await supabase
      .from(
        "user_companies"
      )
      .select(`
        company:companies (
          id,
          name,
          slug,
          color,
          active
        )
      `)
      .eq(
        "user_id",
        access.user.id
      )
      .eq(
        "company.slug",
        "o-estafeta"
      )
      .maybeSingle();

  const company =
    getFirst(
      relation?.company
    );

  if (
    error ||
    !company ||
    company.slug !==
      "o-estafeta" ||
    !company.active
  ) {
    notFound();
  }

  return {
    ...access,

    estafetaCompany:
      company,
  };
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

  return Array.isArray(
    value
  )
    ? value[0] ??
        null
    : value;
}