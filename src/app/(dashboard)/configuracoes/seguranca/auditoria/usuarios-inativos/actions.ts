"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/app/lib/supabase/admin";
import { requireAdmin } from "@/app/lib/permissions";
import { reassignInactiveUser } from "@/app/lib/reassign-inactive-user";

export async function reassignInactiveUserAssets(
  userId: string
) {
  await requireAdmin();

  const adminDb = createAdminClient();

  const result =
    await reassignInactiveUser(
      adminDb,
      userId
    );

  if (result.success) {
    revalidatePath(
      "/configuracoes/seguranca/auditoria/usuarios-inativos"
    );

    revalidatePath("/contratos");
  }

  return result;
}

/*
 * Usuários desativados ANTES dessa funcionalidade existir não têm
 * `deactivated_at` gravado (a coluna só é preenchida a partir do
 * momento em que alguém desmarca "Usuário ativo" pela tela). Sem
 * essa data não dá pra saber se já passou o mês da saída, então o
 * admin define manualmente uma única vez.
 */
export async function setUserDeactivationDate(
  userId: string,
  dateOnly: string
): Promise<
  | { success: true }
  | { success: false; message: string }
> {
  await requireAdmin();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateOnly
    )
  ) {
    return {
      success: false,
      message:
        "Informe uma data válida.",
    };
  }

  const adminDb = createAdminClient();

  const { data: profile } =
    await adminDb
      .from("user_profiles")
      .select("id, active")
      .eq("id", userId)
      .maybeSingle();

  if (!profile) {
    return {
      success: false,
      message:
        "Usuário não encontrado.",
    };
  }

  if (profile.active) {
    return {
      success: false,
      message:
        "Este usuário está ativo.",
    };
  }

  const { error } = await adminDb
    .from("user_profiles")
    .update({
      deactivated_at: `${dateOnly}T00:00:00.000Z`,
    })
    .eq("id", userId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath(
    "/configuracoes/seguranca/auditoria/usuarios-inativos"
  );

  return { success: true };
}
