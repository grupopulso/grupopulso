"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

type Failure = {
  success: false;
  error: string;
};

/*
 * =====================================================
 * CATEGORIA FINANCEIRA
 * =====================================================
 */

type CreateCategoryInput = {
  name: string;
  type: string;
};

type FinancialCategory = {
  id: string;
  name: string;
  type: string;
  active: boolean;
};

export async function createFinancialCategory(
  input: CreateCategoryInput
): Promise<
  | {
      success: true;
      category: FinancialCategory;
    }
  | Failure
> {
  await requireModulePermission(
    "financial",
    "edit"
  );

  const name = input.name.trim();

  if (!name) {
    return {
      success: false,
      error:
        "Informe o nome da categoria.",
    };
  }

  if (
    ![
      "income",
      "expense",
      "both",
    ].includes(input.type)
  ) {
    return {
      success: false,
      error:
        "Tipo de categoria inválido.",
    };
  }

  const supabase =
    await createClient();

  const { data, error } =
    await supabase
      .from("financial_categories")
      .insert({
        name,
        type: input.type,
        active: true,
      })
      .select("id, name, type, active")
      .single();

  if (error || !data) {
    console.error(
      "Erro ao criar categoria financeira:",
      error
    );

    return {
      success: false,
      error:
        error?.message ??
        "Não foi possível criar a categoria.",
    };
  }

  revalidatePath(
    "/financeiro/configuracoes/categorias"
  );

  return {
    success: true,
    category: data,
  };
}

/*
 * =====================================================
 * CENTRO DE CUSTO
 * =====================================================
 */

type CreateCostCenterInput = {
  name: string;
  companyId?: string | null;
  description?: string | null;
};

export async function createCostCenter(
  input: CreateCostCenterInput
): Promise<{ success: true } | Failure> {
  const access =
    await requireModulePermission(
      "financial",
      "edit"
    );

  const name = input.name.trim();

  if (!name) {
    return {
      success: false,
      error:
        "Informe o nome do centro de custo.",
    };
  }

  const companyId =
    input.companyId?.trim() || null;

  /*
   * Sem empresa = centro de custo compartilhado pelo grupo
   * (só admin pode criar compartilhado). Com empresa,
   * o usuário precisa ter acesso a ela.
   */
  if (companyId) {
    await requireCompanyAccess(companyId);
  } else if (
    access.profile.role !== "admin"
  ) {
    return {
      success: false,
      error:
        "Selecione uma empresa para o centro de custo.",
    };
  }

  const supabase =
    await createClient();

  const { error } = await supabase
    .from("cost_centers")
    .insert({
      name,
      company_id: companyId,
      description:
        input.description?.trim() ||
        null,
      active: true,
    });

  if (error) {
    console.error(
      "Erro ao criar centro de custo:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath(
    "/financeiro/configuracoes/centros-custo"
  );

  return { success: true };
}

/*
 * =====================================================
 * CONTA FINANCEIRA
 * =====================================================
 */

type CreateAccountInput = {
  name: string;
  type: string;
  bankName?: string | null;
  companyId?: string | null;
  initialBalance: number;
};

export async function createFinancialAccount(
  input: CreateAccountInput
): Promise<{ success: true } | Failure> {
  const access =
    await requireModulePermission(
      "financial",
      "edit"
    );

  const name = input.name.trim();

  if (!name) {
    return {
      success: false,
      error:
        "Informe o nome da conta.",
    };
  }

  if (
    ![
      "bank",
      "cash",
      "digital_wallet",
      "other",
    ].includes(input.type)
  ) {
    return {
      success: false,
      error:
        "Tipo de conta inválido.",
    };
  }

  if (
    !Number.isFinite(
      input.initialBalance
    )
  ) {
    return {
      success: false,
      error:
        "Saldo inicial inválido.",
    };
  }

  const companyId =
    input.companyId?.trim() || null;

  if (companyId) {
    await requireCompanyAccess(companyId);
  } else if (
    access.profile.role !== "admin"
  ) {
    return {
      success: false,
      error:
        "Selecione uma empresa para a conta.",
    };
  }

  const supabase =
    await createClient();

  const { data, error } =
    await supabase
      .from("financial_accounts")
      .insert({
        name,
        type: input.type,
        bank_name:
          input.bankName?.trim() ||
          null,
        company_id: companyId,
        initial_balance:
          input.initialBalance,
        active: true,
      })
      .select("id")
      .single();

  if (error || !data) {
    console.error(
      "Erro ao criar conta financeira:",
      error
    );

    return {
      success: false,
      error:
        error?.message ??
        "Não foi possível criar a conta.",
    };
  }

  await createAuditLog({
    module: "financial",
    action: "create",
    entityType: "financial_account",
    entityId: data.id,
    description:
      `Conta financeira "${name}" foi cadastrada.`,
    newData: {
      name,
      type: input.type,
      company_id: companyId,
      initial_balance:
        input.initialBalance,
    },
  });

  revalidatePath(
    "/financeiro/configuracoes/contas"
  );

  return { success: true };
}

/*
 * =====================================================
 * FORNECEDOR
 * =====================================================
 */

type CreateSupplierInput = {
  name: string;
  tradeName?: string | null;
  cpfCnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  notes?: string | null;
};

export async function createSupplier(
  input: CreateSupplierInput
): Promise<
  | { success: true; supplierId: string }
  | Failure
> {
  await requireModulePermission(
    "financial",
    "edit"
  );

  const name = input.name.trim();

  if (!name) {
    return {
      success: false,
      error:
        "Informe o nome do fornecedor.",
    };
  }

  const supabase =
    await createClient();

  const { data, error } =
    await supabase
      .from("suppliers")
      .insert({
        name,
        trade_name:
          input.tradeName?.trim() ||
          null,
        cpf_cnpj:
          input.cpfCnpj?.trim() ||
          null,
        email:
          input.email?.trim() ||
          null,
        phone:
          input.phone?.trim() ||
          null,
        whatsapp:
          input.whatsapp?.trim() ||
          null,
        notes:
          input.notes?.trim() ||
          null,
        active: true,
      })
      .select("id")
      .single();

  if (error || !data) {
    console.error(
      "Erro ao cadastrar fornecedor:",
      error
    );

    return {
      success: false,
      error:
        error?.message ??
        "Não foi possível cadastrar o fornecedor.",
    };
  }

  revalidatePath(
    "/financeiro/configuracoes/fornecedores"
  );

  return {
    success: true,
    supplierId: data.id,
  };
}
