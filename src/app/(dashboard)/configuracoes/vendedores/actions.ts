"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  createAdminClient,
} from "@/app/lib/supabase/admin";

import {
  requireAuthenticatedUser,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

import {
  SELLER_ONLY_EMAIL_DOMAIN,
  slugifyName,
} from "@/app/lib/seller-only";

type CreateSellerOnlyInput = {
  name: string;
  companyId: string;
  commissionPercentage: number;
};

/*
 * Cadastra um "vendedor" que não é um usuário do sistema:
 * ele existe só pra poder ser escolhido como responsável de
 * contrato / vendedor de edição e receber comissão, mas
 * nunca faz login (e-mail sintético + senha aleatória que
 * ninguém sabe). Reaproveita toda a estrutura existente
 * (user_profiles/seller_settings) em vez de criar uma
 * tabela paralela.
 */
export async function createSellerOnlyUser(
  input: CreateSellerOnlyInput
) {
  const access =
    await requireAuthenticatedUser();

  if (
    access.profile.role !== "admin"
  ) {
    return {
      success: false,
      message:
        "Apenas administradores podem cadastrar vendedores.",
    };
  }

  const name = input.name.trim();

  if (!name) {
    return {
      success: false,
      message:
        "Informe o nome do vendedor.",
    };
  }

  if (!input.companyId) {
    return {
      success: false,
      message:
        "Selecione uma empresa.",
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

  const { data: company } =
    await supabase
      .from("companies")
      .select("id, active")
      .eq("id", input.companyId)
      .maybeSingle();

  if (!company || !company.active) {
    return {
      success: false,
      message:
        "Empresa inválida ou inativa.",
    };
  }

  const admin = createAdminClient();

  const slug =
    slugifyName(name) || "vendedor";

  const suffix = Math.random()
    .toString(36)
    .slice(2, 8);

  const email = `${slug}-${suffix}@${SELLER_ONLY_EMAIL_DOMAIN}`;

  const password = Array.from(
    { length: 4 },
    () =>
      Math.random()
        .toString(36)
        .slice(2)
  ).join("");

  const {
    data: authData,
    error: authError,
  } =
    await admin.auth.admin.createUser(
      {
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          seller_only: true,
        },
      }
    );

  if (
    authError ||
    !authData.user
  ) {
    return {
      success: false,
      message:
        authError?.message ??
        "Não foi possível cadastrar o vendedor.",
    };
  }

  const newUserId = authData.user.id;

  async function rollbackUser() {
    try {
      await admin.auth.admin.deleteUser(
        newUserId
      );
    } catch (rollbackError) {
      console.error(
        "Erro ao desfazer cadastro do vendedor:",
        rollbackError
      );
    }
  }

  /*
   * O trigger on_auth_user_created já cria a linha padrão
   * em user_profiles — sobrescrevemos com os dados reais.
   * role "viewer" + nenhuma linha em user_permissions =
   * sem acesso a nenhum módulo, mesmo que alguém descubra
   * a senha.
   */
  const {
    error: profileError,
  } = await admin
    .from("user_profiles")
    .upsert(
      {
        id: newUserId,
        name,
        role: "viewer",
        active: true,
      },
      {
        onConflict: "id",
      }
    );

  if (profileError) {
    await rollbackUser();

    return {
      success: false,
      message: `Erro ao criar perfil do vendedor: ${profileError.message}`,
    };
  }

  const {
    error: companyLinkError,
  } = await admin
    .from("user_companies")
    .insert({
      user_id: newUserId,
      company_id: input.companyId,
    });

  if (companyLinkError) {
    await rollbackUser();

    return {
      success: false,
      message: `Erro ao vincular empresa: ${companyLinkError.message}`,
    };
  }

  const {
    error: settingsError,
  } = await admin
    .from("seller_settings")
    .insert({
      user_id: newUserId,
      company_id: input.companyId,
      commission_percentage:
        input.commissionPercentage,
      active: true,
    });

  if (settingsError) {
    await rollbackUser();

    return {
      success: false,
      message: `Erro ao configurar comissão: ${settingsError.message}`,
    };
  }

  await createAuditLog({
    module: "settings",
    action: "create",
    entityType: "user",
    entityId: newUserId,
    description: `Vendedor sem acesso ao sistema cadastrado: ${name}.`,
    newData: {
      name,
      companyId: input.companyId,
      commissionPercentage:
        input.commissionPercentage,
      sellerOnly: true,
    },
  });

  revalidatePath(
    "/configuracoes/vendedores"
  );

  revalidatePath(
    "/configuracoes/usuarios"
  );

  return {
    success: true,
    userId: newUserId,
    name,
  };
}

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
   * Cria ou atualiza configuração. Via service role — a
   * checagem de admin já foi feita acima.
   */
  const adminDb = createAdminClient();

  const {
    error: settingsError,
  } =
    await adminDb
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