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
  companyId: string;
  year: number;
  month: number;
  targetAmount: number;
};

type SaveGoalResult =
  | { success: true }
  | { success: false; error: string };

export async function saveCompanyGoal(
  input: SaveGoalInput
): Promise<SaveGoalResult> {
  await requireAdmin();

  const {
    companyId,
    year,
    month,
    targetAmount,
  } = input;

  if (!companyId) {
    return {
      success: false,
      error: "Empresa inválida.",
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

  /*
   * A meta é sempre mensal (1–12). A meta anual não é um
   * registro separado — é a soma das 12 metas mensais.
   */
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
    data: company,
    error: companyError,
  } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !company) {
    return {
      success: false,
      error:
        "Empresa não encontrada.",
    };
  }

  const target =
    Math.round(targetAmount * 100) /
    100;

  const { error } = await supabase
    .from("company_goals")
    .upsert(
      {
        company_id: companyId,
        year,
        month,
        target_amount: target,
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict:
          "company_id,year,month",
      }
    );

  if (error) {
    console.error(
      "Erro ao salvar meta da empresa:",
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
    entityType: "company_goal",
    entityId: companyId,
    description:
      `Meta de ${company.name} para ${String(
        month
      ).padStart(2, "0")}/${year} definida em ${formatCurrency(
        target
      )}.`,
    newData: {
      company_id: companyId,
      year,
      month,
      target_amount: target,
    },
  });

  revalidatePath("/metas");

  return { success: true };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
