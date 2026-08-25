import {
  notFound,
} from "next/navigation";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireAuthenticatedUser,
} from "@/app/lib/permissions";

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
   * Usuários comuns precisam
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