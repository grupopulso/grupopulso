"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminClient,
} from "@/app/lib/supabase/admin";

import {
  requireAuthenticatedUser,
} from "@/app/lib/permissions";

type SaveOverrideRuleInput = {
  companyId: string;
  beneficiaryUserId: string;
  sourceUserId: string;
  percentage: number;
};

export async function saveOverrideRule(
  input: SaveOverrideRuleInput
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
        "Apenas administradores podem configurar comissões adicionais.",
    };
  }

  if (
    !input.companyId ||
    !input.beneficiaryUserId ||
    !input.sourceUserId
  ) {
    return {
      success: false,
      message:
        "Preencha todos os campos.",
    };
  }

  if (
    input.beneficiaryUserId ===
    input.sourceUserId
  ) {
    return {
      success: false,
      message:
        "O beneficiário não pode receber comissão adicional sobre as próprias vendas.",
    };
  }

  if (
    Number.isNaN(
      input.percentage
    ) ||
    input.percentage < 0 ||
    input.percentage > 100
  ) {
    return {
      success: false,
      message:
        "Informe um percentual válido.",
    };
  }

  /*
   * Service role: já validado que quem chama é admin logo
   * acima. Evita bloqueio de RLS em `seller_override_rules`.
   */
  const supabase =
    createAdminClient();

  /*
   * Confirma que os dois usuários
   * são vendedores ativos da
   * empresa selecionada.
   */

  const {
    data: sellerSettings,
    error: sellerError,
  } =
    await supabase
      .from(
        "seller_settings"
      )
      .select(`
        user_id,
        company_id,
        active
      `)
      .eq(
        "company_id",
        input.companyId
      )
      .eq(
        "active",
        true
      )
      .in(
        "user_id",
        [
          input.beneficiaryUserId,
          input.sourceUserId,
        ]
      );

  if (sellerError) {
    console.error(
      "Erro ao validar vendedores:",
      sellerError
    );

    return {
      success: false,
      message:
        "Não foi possível validar os vendedores.",
    };
  }

  const validUsers =
    new Set(
      (
        sellerSettings ??
        []
      ).map(
        (item) =>
          item.user_id
      )
    );

  if (
    !validUsers.has(
      input.beneficiaryUserId
    ) ||
    !validUsers.has(
      input.sourceUserId
    )
  ) {
    return {
      success: false,
      message:
        "Os dois usuários precisam estar configurados como vendedores ativos nesta empresa.",
    };
  }

  /*
   * UPSERT:
   *
   * Se a regra já existir,
   * atualizamos percentual e
   * reativamos.
   */

  const {
    error,
  } =
    await supabase
      .from(
        "seller_override_rules"
      )
      .upsert(
        {
          company_id:
            input.companyId,

          beneficiary_user_id:
            input.beneficiaryUserId,

          source_user_id:
            input.sourceUserId,

          percentage:
            input.percentage,

          active:
            true,

          updated_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            "company_id,beneficiary_user_id,source_user_id",
        }
      );

  if (error) {
    console.error(
      "Erro ao salvar comissão adicional:",
      error
    );

    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/vendedores"
  );

  return {
    success: true,
  };
}

export async function toggleOverrideRule(
  ruleId: string,
  active: boolean
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
        "Apenas administradores podem alterar comissões adicionais.",
    };
  }

  if (!ruleId) {
    return {
      success: false,
      message:
        "Regra inválida.",
    };
  }

  /*
   * Service role: já validado que quem chama é admin logo
   * acima. Evita bloqueio de RLS em `seller_override_rules`.
   */
  const supabase =
    createAdminClient();

  const {
    error,
  } =
    await supabase
      .from(
        "seller_override_rules"
      )
      .update({
        active,
        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        ruleId
      );

  if (error) {
    console.error(
      "Erro ao alterar regra:",
      error
    );

    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/vendedores"
  );

  return {
    success: true,
  };
}

export async function deleteOverrideRule(
  ruleId: string
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
        "Apenas administradores podem excluir comissões adicionais.",
    };
  }

  if (!ruleId) {
    return {
      success: false,
      message:
        "Regra inválida.",
    };
  }

  /*
   * Service role: já validado que quem chama é admin logo
   * acima. Evita bloqueio de RLS em `seller_override_rules`.
   */
  const supabase =
    createAdminClient();

  const {
    error,
  } =
    await supabase
      .from(
        "seller_override_rules"
      )
      .delete()
      .eq(
        "id",
        ruleId
      );

  if (error) {
    console.error(
      "Erro ao excluir regra:",
      error
    );

    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/vendedores"
  );

  return {
    success: true,
  };
}