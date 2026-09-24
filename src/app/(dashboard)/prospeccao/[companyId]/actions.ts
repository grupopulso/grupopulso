"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

type Failure = {
  success: false;
  error: string;
};

export async function createProspectingList(input: {
  companyId: string;
  name: string;
}): Promise<
  | { success: true; listId: string }
  | Failure
> {
  const access =
    await requireModulePermission(
      "prospecting",
      "create"
    );

  await requireCompanyAccess(
    input.companyId
  );

  const name = input.name.trim();

  if (!name) {
    return {
      success: false,
      error:
        "Informe o nome da lista.",
    };
  }

  const adminDb = createAdminClient();

  const { data, error } =
    await adminDb
      .from("prospecting_lists")
      .insert({
        company_id: input.companyId,
        name,
        created_by:
          access.user.id,
      })
      .select("id")
      .single();

  if (error || !data) {
    console.error(
      "Erro ao criar lista de prospecção:",
      error
    );

    return {
      success: false,
      error:
        error?.message ??
        "Não foi possível criar a lista.",
    };
  }

  revalidatePath(
    `/prospeccao/${input.companyId}`
  );

  return {
    success: true,
    listId: data.id,
  };
}

export async function deleteProspectingList(
  companyId: string,
  listId: string
): Promise<{ success: true } | Failure> {
  await requireModulePermission(
    "prospecting",
    "delete"
  );

  await requireCompanyAccess(
    companyId
  );

  const adminDb = createAdminClient();

  const { error } = await adminDb
    .from("prospecting_lists")
    .delete()
    .eq("id", listId)
    .eq("company_id", companyId);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath(
    `/prospeccao/${companyId}`
  );

  return { success: true };
}
