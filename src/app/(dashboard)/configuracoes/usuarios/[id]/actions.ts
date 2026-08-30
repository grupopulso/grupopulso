"use server";

import { revalidatePath } from "next/cache";

import {
  createClient as createSupabaseAdminClient,
} from "@supabase/supabase-js";

import { createClient } from "@/app/lib/supabase/server";

import {
  requireAdmin,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

function getAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "As credenciais administrativas do Supabase não estão configuradas."
    );
  }

  return createSupabaseAdminClient(
    url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function deleteUser(
  userId: string
) {
  const admin = await requireAdmin();

  if (!userId) {
    return {
      success: false,
      message: "Usuário inválido.",
    };
  }

  if (userId === admin.user.id) {
    return {
      success: false,
      message:
        "Você não pode excluir o seu próprio usuário.",
    };
  }

  const supabase = await createClient();

  const {
    data: profile,
  } = await supabase
    .from("user_profiles")
    .select("id, name")
    .eq("id", userId)
    .maybeSingle();

  /*
   * Bloqueia a exclusão se o usuário for responsável por
   * contratos ou vendas — apagar deixaria esses registros
   * órfãos. Nesse caso o correto é desativar o usuário.
   */
  const { count: contractCount } =
    await supabase
      .from("contracts")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("responsible_user_id", userId);

  if ((contractCount ?? 0) > 0) {
    return {
      success: false,
      message:
        "Este usuário é responsável por contratos. Desative-o em vez de excluir.",
    };
  }

  const { count: saleCount } =
    await supabase
      .from("edition_sales")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("seller_user_id", userId);

  if ((saleCount ?? 0) > 0) {
    return {
      success: false,
      message:
        "Este usuário tem vendas de publicidade registradas. Desative-o em vez de excluir.",
    };
  }

  const client = getAdminClient();

  await client
    .from("user_permissions")
    .delete()
    .eq("user_id", userId);

  await client
    .from("user_companies")
    .delete()
    .eq("user_id", userId);

  await client
    .from("company_partners")
    .delete()
    .eq("user_id", userId);

  await client
    .from("seller_settings")
    .delete()
    .eq("user_id", userId);

  const { error: profileDeleteError } =
    await client
      .from("user_profiles")
      .delete()
      .eq("id", userId);

  if (profileDeleteError) {
    return {
      success: false,
      message:
        "Não foi possível excluir: o usuário ainda tem registros vinculados. Desative-o em vez de excluir.",
    };
  }

  const { error: authDeleteError } =
    await client.auth.admin.deleteUser(
      userId
    );

  if (authDeleteError) {
    return {
      success: false,
      message: authDeleteError.message,
    };
  }

  await createAuditLog({
    module: "settings",
    action: "delete",
    entityType: "user",
    entityId: userId,
    description: `Usuário ${
      profile?.name ?? userId
    } excluído.`,
  });

  revalidatePath(
    "/configuracoes/usuarios"
  );

  return { success: true };
}

const VALID_ROLES = [
  "admin",
  "manager",
  "finance",
  "operations",
  "viewer",
];

const MODULES = [
  "dashboard",
  "clients",
  "subscribers",
  "routes",
  "products",
  "contracts",
  "financial",
  "accounts_receivable",
  "accounts_payable",
  "receipts",
  "payments",
  "reports",
  "settings",
];

type PermissionInput = {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type UpdateUserInput = {
  name: string;
  role: string;
  active: boolean;
  companyIds: string[];
  permissions: PermissionInput[];
};

export async function updateUserAccess(
  userId: string,
  input: UpdateUserInput
) {
  await requireAdmin();

  const supabase =
    await createClient();

  /*
   * Confirma que o perfil existe.
   */
  const {
    data: existingProfile,
    error: profileCheckError,
  } = await supabase
    .from("user_profiles")
    .select(`
      id,
      role
    `)
    .eq("id", userId)
    .maybeSingle();

  if (
    profileCheckError ||
    !existingProfile
  ) {
    return {
      success: false,
      message:
        "Usuário não encontrado.",
    };
  }

  const name =
    input.name.trim();

  if (!name) {
    return {
      success: false,
      message:
        "Informe o nome do usuário.",
    };
  }

  if (
    !VALID_ROLES.includes(
      input.role
    )
  ) {
    return {
      success: false,
      message:
        "Perfil de acesso inválido.",
    };
  }

  /*
   * Atualiza o perfil.
   */
  const {
    error: profileError,
  } = await supabase
    .from("user_profiles")
    .update({
      name,
      role:
        input.role,
      active:
        input.active,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    console.error(
      "Erro ao atualizar perfil:",
      profileError
    );

    return {
      success: false,
      message:
        profileError.message,
    };
  }

  /*
   * EMPRESAS
   *
   * Removemos os vínculos antigos e
   * recriamos conforme a seleção atual.
   */
  const {
    error:
      deleteCompaniesError,
  } = await supabase
    .from("user_companies")
    .delete()
    .eq("user_id", userId);

  if (
    deleteCompaniesError
  ) {
    return {
      success: false,
      message:
        deleteCompaniesError.message,
    };
  }

  const companyIds =
    Array.from(
      new Set(
        input.companyIds.filter(
          Boolean
        )
      )
    );

  if (companyIds.length) {
    const {
      error:
        insertCompaniesError,
    } = await supabase
      .from("user_companies")
      .insert(
        companyIds.map(
          (companyId) => ({
            user_id:
              userId,

            company_id:
              companyId,
          })
        )
      );

    if (
      insertCompaniesError
    ) {
      console.error(
        "Erro ao salvar empresas do usuário:",
        insertCompaniesError
      );

      return {
        success: false,
        message:
          insertCompaniesError.message,
      };
    }
  }

  /*
   * PERMISSÕES
   *
   * Administradores sempre terão
   * acesso completo.
   */
  const normalizedPermissions =
    MODULES.map(
      (module) => {
        const permission =
          input.permissions.find(
            (item) =>
              item.module ===
              module
          );

        if (
          input.role ===
          "admin"
        ) {
          return {
            user_id:
              userId,

            module,

            can_view:
              true,

            can_create:
              true,

            can_edit:
              true,

            can_delete:
              true,

            updated_at:
              new Date().toISOString(),
          };
        }

        return {
          user_id:
            userId,

          module,

          can_view:
            permission?.canView ??
            false,

          can_create:
            permission?.canCreate ??
            false,

          can_edit:
            permission?.canEdit ??
            false,

          can_delete:
            permission?.canDelete ??
            false,

          updated_at:
            new Date().toISOString(),
        };
      }
    );

  const {
    error:
      permissionsError,
  } = await supabase
    .from("user_permissions")
    .upsert(
      normalizedPermissions,
      {
        onConflict:
          "user_id,module",
      }
    );

  if (
    permissionsError
  ) {
    console.error(
      "Erro ao salvar permissões:",
      permissionsError
    );

    return {
      success: false,
      message:
        permissionsError.message,
    };
  }

  revalidatePath(
    "/configuracoes/usuarios"
  );

  revalidatePath(
    `/configuracoes/usuarios/${userId}`
  );
await createAuditLog({
  module: "settings",
  action: "update",
  entityType: "user",
  entityId: userId,
  description: `Permissões do usuário ${name} foram alteradas.`,
  newData: {
    role: input.role,
    active: input.active,
    companyIds,
    permissions:
      normalizedPermissions,
  },
});
  return {
    success: true,
    message:
      "Usuário atualizado com sucesso.",
  };
}