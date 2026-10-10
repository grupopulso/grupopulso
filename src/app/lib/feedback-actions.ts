"use server";

import { createAdminClient } from "@/app/lib/supabase/admin";
import { requireAuthenticatedUser } from "@/app/lib/permissions";
import { hasAnsweredFeedback } from "@/app/lib/feedback";
import { FEEDBACK_MODULES } from "@/app/lib/feedback-modules";

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

  const hasRating = Object.values(
    ratings
  ).some((value) => value > 0);

  if (!hasRating && !comment) {
    return {
      success: false,
      message:
        "Dê nota para pelo menos um módulo ou escreva o que pode melhorar.",
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
