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

type UpdateProductInput = {
  productId: string;
  companyId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  type: string;
  defaultPrice: number | null;
  commissionPercentage: number | null;
  billingFrequency: string;
  active: boolean;
};

type UpdateProductResult =
  | { success: true }
  | { success: false; error: string };

export async function updateProductRecord(
  input: UpdateProductInput
): Promise<UpdateProductResult> {
  await requireModulePermission(
    "products",
    "edit"
  );

  const supabase =
    await createClient();

  const name = input.name.trim();

  if (!input.productId) {
    return {
      success: false,
      error: "Produto inválido.",
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
   * Escopo de empresa: busca o produto atual e confirma
   * acesso à empresa dele. Se estiver movendo para outra
   * empresa, valida a de destino também.
   */
  const {
    data: current,
    error: currentError,
  } = await supabase
    .from("products")
    .select("id, company_id")
    .eq("id", input.productId)
    .maybeSingle();

  if (currentError || !current) {
    return {
      success: false,
      error: "Produto não encontrado.",
    };
  }

  await requireCompanyAccess(
    current.company_id
  );

  if (
    input.companyId !==
    current.company_id
  ) {
    await requireCompanyAccess(
      input.companyId
    );

    const {
      data: company,
    } = await supabase
      .from("companies")
      .select("id, active")
      .eq("id", input.companyId)
      .maybeSingle();

    if (!company || !company.active) {
      return {
        success: false,
        error:
          "Empresa de destino inválida.",
      };
    }
  }

  const defaultPrice =
    input.defaultPrice;

  if (
    defaultPrice !== null &&
    (!Number.isFinite(defaultPrice) ||
      defaultPrice < 0)
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
    (!Number.isFinite(
      commissionPercentage
    ) ||
      commissionPercentage < 0 ||
      commissionPercentage > 100)
  ) {
    return {
      success: false,
      error:
        "Informe uma comissão válida entre 0% e 100%.",
    };
  }

  const { error } = await supabase
    .from("products")
    .update({
      company_id: input.companyId,
      name,
      description:
        input.description?.trim() ||
        null,
      category:
        input.category?.trim() || null,
      type: input.type,
      default_price: defaultPrice,
      commission_percentage:
        commissionPercentage,
      billing_frequency:
        input.billingFrequency,
      active: input.active,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", input.productId);

  if (error) {
    console.error(
      "Erro ao atualizar produto:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }

  await createAuditLog({
    module: "products",
    action: "update",
    entityType: "product",
    entityId: input.productId,
    description:
      `Produto ${name} foi atualizado.`,
    newData: {
      name,
      company_id: input.companyId,
      type: input.type,
      default_price: defaultPrice,
      commission_percentage:
        commissionPercentage,
      billing_frequency:
        input.billingFrequency,
      active: input.active,
    },
  });

  revalidatePath("/produtos");

  return { success: true };
}
