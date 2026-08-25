"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

const POTTENCIALIZA_COMPANY_ID =
  "9d08d74c-c5fe-48c9-b0c5-382cea273d99";

export async function updateTv(
  input: {
    id: string;
    name: string;
    location: string;
    description: string;
    active: boolean;
  }
) {
  await requireModulePermission(
    "settings",
    "edit"
  );

  const supabase =
    await createClient();

  if (
    !input.id ||
    !input.name.trim()
  ) {
    return {
      success: false,
      error:
        "Informe o nome da TV.",
    };
  }

  const {
    error,
  } = await supabase
    .from(
      "pottencializa_tvs"
    )
    .update({
      name:
        input.name.trim(),

      location:
        input.location.trim() ||
        null,

      description:
        input.description.trim() ||
        null,

      active:
        input.active,

      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      input.id
    )
    .eq(
      "company_id",
      POTTENCIALIZA_COMPANY_ID
    );

  if (error) {
    return {
      success: false,
      error:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/tvs"
  );

  return {
    success: true,
  };
}

export async function createTv(
  input: {
    name: string;
    location: string;
    description: string;
  }
) {
  await requireModulePermission(
    "settings",
    "create"
  );

  const supabase =
    await createClient();

  if (
    !input.name.trim()
  ) {
    return {
      success: false,
      error:
        "Informe o nome da TV.",
    };
  }

  const {
    error,
  } = await supabase
    .from(
      "pottencializa_tvs"
    )
    .insert({
      company_id:
        POTTENCIALIZA_COMPANY_ID,

      name:
        input.name.trim(),

      location:
        input.location.trim() ||
        null,

      description:
        input.description.trim() ||
        null,

      active:
        true,
    });

  if (error) {
    return {
      success: false,
      error:
        error.message,
    };
  }

  revalidatePath(
    "/configuracoes/tvs"
  );

  return {
    success: true,
  };
}