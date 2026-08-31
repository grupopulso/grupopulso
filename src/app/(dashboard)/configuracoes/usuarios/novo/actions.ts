"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createClient as createSupabaseAdminClient,
} from "@supabase/supabase-js";

import {
  requireAdmin,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

const MODULES = [
  "dashboard",
  "clients",
  "products",
  "contracts",
  "subscriptions",
  "editions",
  "financial",
  "accounts_receivable",
  "accounts_payable",
  "receipts",
  "payments",
  "routes",
  "reports",
  "settings",
] as const;

const VALID_ROLES = [
  "admin",
  "manager",
  "finance",
  "operations",
  "viewer",
] as const;

type UserRole =
  (typeof VALID_ROLES)[number];

export async function createUser(
  formData: FormData
) {
  /*
   * Só administrador pode executar
   * esta Server Action.
   */
  await requireAdmin();

  const name = String(
    formData.get("name") ?? ""
  ).trim();

  const email = String(
    formData.get("email") ?? ""
  )
    .trim()
    .toLowerCase();

  const password = String(
    formData.get("password") ?? ""
  );

  const requestedRole = String(
    formData.get("role") ??
      "viewer"
  );

  const active =
    formData.get("active") === "on";

  const companyIds = [
    ...new Set(
      formData
        .getAll("companies")
        .map(String)
        .filter(Boolean)
    ),
  ];

  /*
   * =============================
   * VALIDAÇÕES
   * =============================
   */

  if (!name) {
    throw new Error(
      "Informe o nome do usuário."
    );
  }

  if (
    !email ||
    !email.includes("@")
  ) {
    throw new Error(
      "Informe um e-mail válido."
    );
  }

  if (password.length < 6) {
    throw new Error(
      "A senha inicial deve possuir pelo menos 6 caracteres."
    );
  }

  if (
    !VALID_ROLES.includes(
      requestedRole as UserRole
    )
  ) {
    throw new Error(
      "Função de usuário inválida."
    );
  }

  const role =
    requestedRole as UserRole;

  /*
   * =============================
   * CLIENT ADMIN DO SUPABASE
   * =============================
   *
   * IMPORTANTE:
   * esta chave nunca pode ser usada
   * em Client Components.
   */

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "As credenciais administrativas do Supabase não estão configuradas."
    );
  }

  const admin =
    createSupabaseAdminClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken:
            false,
          persistSession:
            false,
        },
      }
    );

  /*
   * =============================
   * VALIDA EMPRESAS
   * =============================
   */

  if (companyIds.length) {
    const {
      data: validCompanies,
      error: companiesError,
    } = await admin
      .from("companies")
      .select("id")
      .in(
        "id",
        companyIds
      )
      .eq("active", true);

    if (companiesError) {
      throw new Error(
        `Erro ao validar empresas: ${companiesError.message}`
      );
    }

    const validIds =
      new Set(
        (
          validCompanies ??
          []
        ).map(
          (company) =>
            company.id
        )
      );

    const invalidCompany =
      companyIds.some(
        (companyId) =>
          !validIds.has(
            companyId
          )
      );

    if (invalidCompany) {
      throw new Error(
        "Uma das empresas selecionadas é inválida ou está inativa."
      );
    }
  }

  /*
   * =============================
   * CRIA USUÁRIO NO AUTH
   * =============================
   */

  const {
    data: authData,
    error: authError,
  } =
    await admin.auth.admin.createUser(
      {
        email,
        password,

        /*
         * Permite login imediato
         * sem confirmação por e-mail.
         */
        email_confirm: true,

        user_metadata: {
          name,
        },
      }
    );

  if (
    authError ||
    !authData.user
  ) {
    throw new Error(
      authError?.message ??
        "Não foi possível criar o usuário."
    );
  }

  const newUserId =
    authData.user.id;

  /*
   * Se qualquer etapa seguinte falhar,
   * removemos o usuário recém-criado
   * do Auth para não deixar cadastro
   * incompleto.
   */
  async function rollbackUser() {
    try {
      await admin.auth.admin.deleteUser(
        newUserId
      );
    } catch (
      rollbackError
    ) {
      console.error(
        "Erro ao desfazer criação do usuário:",
        rollbackError
      );
    }
  }

  /*
   * =============================
   * USER PROFILE
   * =============================
   */

  /*
   * upsert (não insert) porque um trigger no banco
   * (on_auth_user_created) já cria uma linha padrão
   * em user_profiles assim que o usuário é criado no
   * Auth, para garantir que ninguém fique sem perfil
   * mesmo se for criado fora deste fluxo. Aqui a gente
   * só sobrescreve com os dados reais informados no
   * formulário.
   */
  const {
    error: profileError,
  } = await admin
    .from("user_profiles")
    .upsert(
      {
        id:
          newUserId,

        name,

        role,

        active,
      },
      {
        onConflict: "id",
      }
    );

  if (profileError) {
    await rollbackUser();

    throw new Error(
      `Erro ao criar perfil do usuário: ${profileError.message}`
    );
  }

  /*
   * =============================
   * EMPRESAS PERMITIDAS
   * =============================
   */

  if (
    role !== "admin" &&
    companyIds.length
  ) {
    const {
      error:
        companiesInsertError,
    } = await admin
      .from(
        "user_companies"
      )
      .insert(
        companyIds.map(
          (companyId) => ({
            user_id:
              newUserId,

            company_id:
              companyId,
          })
        )
      );

    if (
      companiesInsertError
    ) {
      await rollbackUser();

      throw new Error(
        `Erro ao vincular empresas: ${companiesInsertError.message}`
      );
    }
  }

  /*
   * =============================
   * PERMISSÕES
   * =============================
   */

  const permissions =
    MODULES.map(
      (module) => {
        /*
         * Admin possui tudo liberado.
         *
         * Mesmo que o sistema ignore
         * essas permissões para admin,
         * mantemos os registros coerentes.
         */
        if (role === "admin") {
          return {
            user_id:
              newUserId,

            module,

            can_view:
              true,

            can_create:
              true,

            can_edit:
              true,

            can_delete:
              true,
          };
        }

        return {
          user_id:
            newUserId,

          module,

          can_view:
            formData.get(
              `${module}_view`
            ) === "on",

          can_create:
            formData.get(
              `${module}_create`
            ) === "on",

          can_edit:
            formData.get(
              `${module}_edit`
            ) === "on",

          can_delete:
            formData.get(
              `${module}_delete`
            ) === "on",
        };
      }
    );

  const {
    error:
      permissionsError,
  } = await admin
    .from(
      "user_permissions"
    )
    .insert(
      permissions
    );

  if (permissionsError) {
    await rollbackUser();

    throw new Error(
      `Erro ao salvar permissões: ${permissionsError.message}`
    );
  }

  /*
   * =============================
   * AUDITORIA
   * =============================
   */

  await createAuditLog({
    module: "settings",

    action: "create",

    entityType:
      "user",

    entityId:
      newUserId,

    description:
      `Usuário ${name} foi cadastrado.`,

    newData: {
      name,
      email,
      role,
      active,

      companyIds:
        role === "admin"
          ? []
          : companyIds,

      permissions:
        permissions.map(
          ({
            module,
            can_view,
            can_create,
            can_edit,
            can_delete,
          }) => ({
            module,
            can_view,
            can_create,
            can_edit,
            can_delete,
          })
        ),
    },
  });

  /*
   * =============================
   * FINALIZA
   * =============================
   */

  revalidatePath(
    "/configuracoes/usuarios"
  );

  revalidatePath(
    "/configuracoes/seguranca"
  );

  redirect(
    "/configuracoes/usuarios"
  );
}