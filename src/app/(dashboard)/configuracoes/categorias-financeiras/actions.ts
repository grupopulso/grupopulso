"use server";

import {
  revalidatePath,
} from "next/cache";

import { createClient } from "@/app/lib/supabase/server";

export async function createFinancialCategory(
  formData: FormData
) {
  const supabase =
    await createClient();

  const name = String(
    formData.get("name") ??
      ""
  ).trim();

  const type = String(
    formData.get("type") ??
      ""
  ).trim();

  if (!name) {
    return {
      success: false,
      message:
        "Informe o nome da categoria.",
    };
  }

  if (
    ![
      "income",
      "expense",
    ].includes(type)
  ) {
    return {
      success: false,
      message:
        "Selecione um tipo válido.",
    };
  }

  const {
    data: existing,
  } = await supabase
    .from(
      "financial_categories"
    )
    .select("id")
    .eq("name", name)
    .eq("type", type)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message:
        "Já existe uma categoria com esse nome e tipo.",
    };
  }

  const { error } =
    await supabase
      .from(
        "financial_categories"
      )
      .insert({
        name,
        type,
        active: true,
      });

  if (error) {
    console.error(
      "Erro ao cadastrar categoria:",
      error
    );

    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/categorias-financeiras"
  );

  return {
    success: true,
  };
}

export async function updateFinancialCategory(
  categoryId: string,
  values: {
    name: string;
    type: string;
    active: boolean;
  }
) {
  const supabase =
    await createClient();

  const name =
    values.name.trim();

  if (!name) {
    return {
      success: false,
      message:
        "Informe o nome da categoria.",
    };
  }

  if (
    ![
      "income",
      "expense",
    ].includes(
      values.type
    )
  ) {
    return {
      success: false,
      message:
        "Tipo inválido.",
    };
  }

  const { error } =
    await supabase
      .from(
        "financial_categories"
      )
      .update({
        name,
        type:
          values.type,
        active:
          values.active,
      })
      .eq(
        "id",
        categoryId
      );

  if (error) {
    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/categorias-financeiras"
  );

  return {
    success: true,
  };
}

export async function deleteFinancialCategory(
  categoryId: string
) {
  const supabase =
    await createClient();

  /*
   * Primeiro verificamos se existem
   * lançamentos usando a categoria.
   */
  const {
    count,
    error:
      countError,
  } = await supabase
    .from(
      "financial_entries"
    )
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "category_id",
      categoryId
    );

  if (countError) {
    return {
      success: false,
      message:
        countError.message,
    };
  }

  if (
    (count ?? 0) > 0
  ) {
    return {
      success: false,
      message:
        "Esta categoria já possui lançamentos financeiros. Desative-a em vez de excluí-la.",
    };
  }

  const { error } =
    await supabase
      .from(
        "financial_categories"
      )
      .delete()
      .eq(
        "id",
        categoryId
      );

  if (error) {
    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/categorias-financeiras"
  );

  return {
    success: true,
  };
}