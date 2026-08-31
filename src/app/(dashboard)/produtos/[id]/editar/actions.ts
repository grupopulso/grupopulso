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

/*
 * =====================================================
 * EXCLUIR PRODUTO
 * =====================================================
 */

type DeleteProductResult =
  | { success: true }
  | {
      success: false;
      error: string;
      inUse?: {
        contracts: number;
        sales: number;
      };
    };

export async function deleteProductRecord(
  productId: string
): Promise<DeleteProductResult> {
  await requireModulePermission(
    "products",
    "delete"
  );

  if (!productId) {
    return {
      success: false,
      error: "Produto inválido.",
    };
  }

  const supabase =
    await createClient();

  const [
    { count: contractsCount },
    { count: salesCount },
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("product_id", productId),

    supabase
      .from("edition_sale_items")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("product_id", productId),
  ]);

  const inUseContracts =
    contractsCount ?? 0;

  const inUseSales =
    salesCount ?? 0;

  if (
    inUseContracts > 0 ||
    inUseSales > 0
  ) {
    return {
      success: false,
      error:
        `Este produto já foi usado em ${inUseContracts} contrato(s) e ${inUseSales} venda(s) de publicidade — não é possível excluir. Marque-o como inativo na edição do produto, se preferir parar de oferecê-lo.`,
      inUse: {
        contracts: inUseContracts,
        sales: inUseSales,
      },
    };
  }

  const {
    data: product,
    error: fetchError,
  } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", productId)
    .maybeSingle();

  if (fetchError || !product) {
    return {
      success: false,
      error: "Produto não encontrado.",
    };
  }

  const { error: deleteError } =
    await supabase
      .from("products")
      .delete()
      .eq("id", productId);

  if (deleteError) {
    console.error(
      "Erro ao excluir produto:",
      deleteError
    );

    return {
      success: false,
      error: deleteError.message,
    };
  }

  await createAuditLog({
    module: "products",
    action: "delete",
    entityType: "product",
    entityId: productId,
    description: `Produto ${product.name} foi excluído.`,
    oldData: product,
  });

  revalidatePath("/produtos");

  return { success: true };
}
