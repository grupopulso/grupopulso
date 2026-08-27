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

type CreateProductInput = {
  companyId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  type: string;
  defaultPrice: number | null;
  commissionPercentage: number | null;
  billingFrequency: string;
};

type CreateProductResult =
  | {
      success: true;
      productId: string;
    }
  | {
      success: false;
      error: string;
    };

export async function createProductRecord(
  input: CreateProductInput
): Promise<CreateProductResult> {
  await requireModulePermission(
    "products",
    "create"
  );

  const supabase =
    await createClient();

  const name =
    input.name.trim();

  if (!input.companyId) {
    return {
      success: false,
      error:
        "Selecione a empresa.",
    };
  }

  if (!name) {
    return {
      success: false,
      error:
        "Informe o nome do produto ou serviço.",
    };
  }

  /*
   * Escopo de empresa: o company_id vem do formulário —
   * confirma que o usuário tem acesso a essa empresa
   * (admin sempre passa).
   */
  await requireCompanyAccess(
    input.companyId
  );

  const {
    data: company,
    error: companyError,
  } = await supabase
    .from("companies")
    .select("id, active")
    .eq("id", input.companyId)
    .maybeSingle();

  if (
    companyError ||
    !company ||
    !company.active
  ) {
    return {
      success: false,
      error:
        "Empresa inválida ou inativa.",
    };
  }

  const defaultPrice =
    input.defaultPrice;

  if (
    defaultPrice !== null &&
    (
      !Number.isFinite(
        defaultPrice
      ) ||
      defaultPrice < 0
    )
  ) {
    return {
      success: false,
      error:
        "Informe um valor padrão válido.",
    };
  }

  const commissionPercentage =
    input.commissionPercentage;

  if (
    commissionPercentage !== null &&
    (
      !Number.isFinite(
        commissionPercentage
      ) ||
      commissionPercentage < 0 ||
      commissionPercentage > 100
    )
  ) {
    return {
      success: false,
      error:
        "Informe uma comissão válida entre 0% e 100%.",
    };
  }

  const {
    data: product,
    error: insertError,
  } = await supabase
    .from("products")
    .insert({
      company_id:
        input.companyId,
      name,
      description:
        input.description?.trim() ||
        null,
      category:
        input.category?.trim() ||
        null,
      type: input.type,
      default_price:
        defaultPrice,
      commission_percentage:
        commissionPercentage,
      billing_frequency:
        input.billingFrequency,
      active: true,
    })
    .select("id")
    .single();

  if (
    insertError ||
    !product
  ) {
    console.error(
      "Erro ao criar produto:",
      insertError
    );

    return {
      success: false,
      error:
        insertError?.message ??
        "Não foi possível cadastrar o produto.",
    };
  }

  await createAuditLog({
    module: "products",
    action: "create",
    entityType: "product",
    entityId: product.id,
    description:
      `Produto ${name} foi cadastrado.`,
    newData: {
      name,
      company_id:
        input.companyId,
      type: input.type,
      default_price:
        defaultPrice,
      commission_percentage:
        commissionPercentage,
      billing_frequency:
        input.billingFrequency,
    },
  });

  revalidatePath("/produtos");

  return {
    success: true,
    productId: product.id,
  };
}
