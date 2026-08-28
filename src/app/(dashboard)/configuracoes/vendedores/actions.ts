"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireAuthenticatedUser,
} from "@/app/lib/permissions";

type SaveSellerInput = {
  userId: string;
  companyId: string;
  commissionPercentage: number;
  active: boolean;
};

export async function saveSellerSettings(
  input: SaveSellerInput
) {
  const access =
    await requireAuthenticatedUser();

  if (
    access.profile.role !==
    "admin"
  ) {
    return {
      success: false,
      message:
        "Apenas administradores podem configurar vendedores.",
    };
  }

  if (
    !input.userId ||
    !input.companyId
  ) {
    return {
      success: false,
      message:
        "Informe o usuário e a empresa.",
    };
  }

  if (
    Number.isNaN(
      input.commissionPercentage
    ) ||
    input.commissionPercentage <
      0 ||
    input.commissionPercentage >
      100
  ) {
    return {
      success: false,
      message:
        "Informe uma comissão válida.",
    };
  }

  const supabase =
    await createClient();

  /*
   * Confirma usuário.
   */
  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("user_profiles")
      .select(`
        id,
        role,
        active
      `)
      .eq(
        "id",
        input.userId
      )
      .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    return {
      success: false,
      message:
        "Usuário não encontrado.",
    };
  }

  /*
   * Confirma empresa.
   */
  const {
    data: company,
    error: companyError,
  } =
    await supabase
      .from("companies")
      .select(`
        id,
        active
      `)
      .eq(
        "id",
        input.companyId
      )
      .maybeSingle();

  if (
    companyError ||
    !company ||
    !company.active
  ) {
    return {
      success: false,
      message:
        "Empresa inválida ou inativa.",
    };
  }

  /*
   * Cria ou atualiza configuração.
   */
  const {
    error: settingsError,
  } =
    await supabase
      .from(
        "seller_settings"
      )
      .upsert(
        {
          user_id:
            input.userId,

          company_id:
            input.companyId,

          commission_percentage:
            input.commissionPercentage,

          active:
            input.active,

          updated_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            "user_id,company_id",
        }
      );

  if (settingsError) {
    console.error(
      "Erro ao configurar vendedor:",
      settingsError
    );

    return {
      success: false,
      message:
        settingsError.message,
    };
  }

  /*
   * A comissão do usuário é definida pela existência de uma
   * linha ativa em seller_settings, não pelo campo role
   * (a constraint de user_profiles.role hoje é
   * admin/manager/finance/operations/viewer — não existe
   * mais "seller").
   */

  revalidatePath(
    "/configuracoes/vendedores"
  );

  return {
    success: true,
  };
}