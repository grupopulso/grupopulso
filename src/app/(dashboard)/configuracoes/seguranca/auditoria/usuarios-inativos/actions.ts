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
