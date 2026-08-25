"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/app/lib/supabase/server";

export async function createPaymentMethod(
  formData: FormData
) {
  const supabase =
    await createClient();

  const name = String(
    formData.get("name") ?? ""
  ).trim();

  const rawCode = String(
    formData.get("code") ?? ""
  ).trim();

  const usageType = String(
    formData.get("usage_type") ??
      "both"
  );

  if (!name) {
    return {
      success: false,
      message:
        "Informe o nome da forma de pagamento.",
    };
  }

  const code =
    normalizeCode(
      rawCode || name
    );

  if (!code) {
    return {
      success: false,
      message:
        "Informe um identificador válido.",
    };
  }

  if (
    ![
      "income",
      "expense",
      "both",
    ].includes(usageType)
  ) {
    return {
      success: false,
      message:
        "Uso inválido.",
    };
  }

  const { data: existing } =
    await supabase
      .from(
        "financial_payment_methods"
      )
      .select("id")
      .eq("code", code)
      .maybeSingle();

  if (existing) {
    return {
      success: false,
      message:
        "Já existe uma forma de pagamento com esse identificador.",
    };
  }

  const { error } =
    await supabase
      .from(
        "financial_payment_methods"
      )
      .insert({
        name,
        code,
        usage_type:
          usageType,
        active: true,
      });

  if (error) {
    console.error(
      "Erro ao cadastrar forma de pagamento:",
      error
    );

    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/formas-pagamento"
  );

  return {
    success: true,
  };
}

export async function updatePaymentMethod(
  methodId: string,
  values: {
    name: string;
    code: string;
    usageType: string;
    active: boolean;
  }
) {
  const supabase =
    await createClient();

  const name =
    values.name.trim();

  const code =
    normalizeCode(
      values.code
    );

  if (
    !name ||
    !code
  ) {
    return {
      success: false,
      message:
        "Informe nome e identificador.",
    };
  }

  if (
    ![
      "income",
      "expense",
      "both",
    ].includes(
      values.usageType
    )
  ) {
    return {
      success: false,
      message:
        "Uso inválido.",
    };
  }

  const {
    data: duplicate,
  } = await supabase
    .from(
      "financial_payment_methods"
    )
    .select("id")
    .eq("code", code)
    .neq("id", methodId)
    .maybeSingle();

  if (duplicate) {
    return {
      success: false,
      message:
        "Já existe outra forma de pagamento com esse identificador.",
    };
  }

  const { error } =
    await supabase
      .from(
        "financial_payment_methods"
      )
      .update({
        name,
        code,
        usage_type:
          values.usageType,
        active:
          values.active,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", methodId);

  if (error) {
    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/formas-pagamento"
  );

  return {
    success: true,
  };
}

export async function deletePaymentMethod(
  methodId: string
) {
  const supabase =
    await createClient();

  const {
    data: method,
    error: methodError,
  } = await supabase
    .from(
      "financial_payment_methods"
    )
    .select(`
      id,
      code
    `)
    .eq("id", methodId)
    .maybeSingle();

  if (
    methodError ||
    !method
  ) {
    return {
      success: false,
      message:
        "Forma de pagamento não encontrada.",
    };
  }

  /*
   * Como financial_transactions ainda
   * guarda payment_method como texto,
   * verificamos pelo code.
   */
  const {
    count,
    error: countError,
  } = await supabase
    .from(
      "financial_transactions"
    )
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "payment_method",
      method.code
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
        "Esta forma de pagamento já foi utilizada. Desative-a em vez de excluí-la.",
    };
  }

  const { error } =
    await supabase
      .from(
        "financial_payment_methods"
      )
      .delete()
      .eq("id", methodId);

  if (error) {
    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/formas-pagamento"
  );

  return {
    success: true,
  };
}

function normalizeCode(
  value: string
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    );
}