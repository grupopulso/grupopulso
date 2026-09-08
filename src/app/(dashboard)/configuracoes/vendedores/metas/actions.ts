"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireAdmin,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

type SaveGoalInput = {
  userId: string;
  year: number;
  month: number;
  targetAmount: number;
};

type SaveGoalResult =
  | { success: true }
  | { success: false; error: string };

/*
 * Meta é só mensal por vendedor — não por empresa. Ele pode
 * usar vendas de qualquer uma das empresas em que atua pra
 * bater essa única meta do mês.
 */
export async function saveSellerGoal(
  input: SaveGoalInput
): Promise<SaveGoalResult> {
  await requireAdmin();

  const {
    userId,
    year,
    month,
    targetAmount,
  } = input;

  if (!userId) {
    return {
      success: false,
      error:
        "Vendedor inválido.",
    };
  }

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  ) {
    return {
      success: false,
      error: "Ano inválido.",
    };
  }

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return {
      success: false,
      error: "Mês inválido.",
    };
  }

  if (
    !Number.isFinite(targetAmount) ||
    targetAmount < 0
  ) {
    return {
      success: false,
      error:
        "Informe um valor de meta válido.",
    };
  }

  const supabase =
    await createClient();

  const {
    data: setting,
    error: settingError,
  } = await supabase
    .from("seller_settings")
    .select("user_id")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (settingError || !setting) {
    return {
      success: false,
      error:
        "Vendedor não encontrado ou inativo.",
    };
  }

  const { data: profile } =
    await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();

  const target =
    Math.round(targetAmount * 100) /
    100;

  const { error } = await supabase
    .from("seller_goals")
    .upsert(
      {
        user_id: userId,
        year,
        month,
        target_amount: target,
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict:
          "user_id,year,month",
      }
    );

  if (error) {
    console.error(
      "Erro ao salvar meta do vendedor:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }

  await createAuditLog({
    module: "financial",
    action: "update",
    entityType: "seller_goal",
    entityId: userId,
    description:
      `Meta de ${profile?.name ?? "vendedor"} para ${String(
        month
      ).padStart(2, "0")}/${year} definida em ${formatCurrency(
        target
      )}.`,
    newData: {
      user_id: userId,
      year,
      month,
      target_amount: target,
    },
  });

  revalidatePath(
    "/configuracoes/vendedores/metas"
  );

  revalidatePath("/meu-painel");

  revalidatePath(
    "/relatorios/vendedores"
  );

  return { success: true };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
