"use server";

import { createAdminClient } from "@/app/lib/supabase/admin";
import { requireAuthenticatedUser } from "@/app/lib/permissions";
import { hasAnsweredFeedback } from "@/app/lib/feedback";
import {
  FEEDBACK_MODULES,
  getFeedbackModulesForUser,
} from "@/app/lib/feedback-modules";

/*
 * Envio da avaliação do sistema: nota de 0 a 5 por módulo
 * (0 = não uso) + "o que pode melhorar". Quem ainda não respondeu
 * vê a janela ao entrar (feedback-prompt.tsx).
 */

export async function submitSystemFeedback(
  input: {
    ratings: Record<string, number>;
    comment: string;
  }
): Promise<
  { success: true } | { success: false; message: string }
> {
  const access =
    await requireAuthenticatedUser();

  const ratings: Record<string, number> = {};

  for (const item of FEEDBACK_MODULES) {
    const raw = input.ratings?.[item.key];

    if (raw === undefined) {
      continue;
    }

    const value = Math.round(Number(raw));

    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 5
    ) {
      return {
        success: false,
        message: "Nota inválida.",
      };
    }

    ratings[item.key] = value;
  }

  const comment = (input.comment ?? "")
    .trim()
    .slice(0, 1000);

  /*
   * Obrigatória: precisa ter nota (0 vale, = não uso) em todos os
   * módulos que o usuário enxerga; sem nenhum módulo, o comentário
   * é obrigatório.
   */
  const expected = getFeedbackModulesForUser(
    access.profile.role,
    access.permissions
  );

  const missing = expected.filter(
    (item) => ratings[item.key] === undefined
  );

  if (missing.length > 0) {
    return {
      success: false,
      message: `Dê nota para todos os módulos (falta: ${missing
        .map((item) => item.label)
        .join(", ")}).`,
    };
  }

  if (expected.length === 0 && !comment) {
    return {
      success: false,
      message:
        "Escreva o que pode melhorar para enviar a avaliação.",
    };
  }

  if (await hasAnsweredFeedback(access.user.id)) {
    return {
      success: false,
      message:
        "Você já enviou sua avaliação. Obrigado!",
    };
  }

  const adminDb = createAdminClient();

  const { error } = await adminDb
    .from("audit_logs")
    .insert({
      user_id: access.user.id,
      module: "feedback",
      action: "create",
      entity_type: "system_feedback",
      description: "Avaliação do sistema",
      new_data: {
        ratings,
        comment: comment || null,
      },
    });

  if (error) {
    console.error(
      "Erro ao salvar avaliação:",
      error
    );

    return {
      success: false,
      message:
        "Não foi possível enviar a avaliação. Tente de novo.",
    };
  }

  return { success: true };
}
