"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";

import {
  requireAdmin,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

export async function createCompany(
  formData: FormData
) {
  await requireAdmin();

  const supabase =
    await createClient();

  const name = String(
    formData.get("name") ?? ""
  ).trim();

  const slug = String(
    formData.get("slug") ?? ""
  )
    .trim()
    .toLowerCase();

  const color = String(
    formData.get("color") ?? ""
  ).trim();

  if (!name) {
    redirect(
      "/empresas/nova?error=nome"
    );
  }

  if (!slug) {
    redirect(
      "/empresas/nova?error=slug"
    );
  }

  const normalizedSlug = slug
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const { data: existing } =
    await supabase
      .from("companies")
      .select("id")
      .eq(
        "slug",
        normalizedSlug
      )
      .maybeSingle();

  if (existing) {
    redirect(
      "/empresas/nova?error=duplicada"
    );
  }

  const {
    data: company,
    error,
  } = await supabase
    .from("companies")
    .insert({
      name,
      slug: normalizedSlug,
      color:
        color || "#15704f",
      active: true,
    })
    .select("id")
    .single();

  if (error || !company) {
    console.error(
      "Erro ao cadastrar empresa:",
      error
    );

    redirect(
      "/empresas/nova?error=salvar"
    );
  }

  revalidatePath("/empresas");
await createAuditLog({
  module: "settings",
  action: "create",
  entityType: "company",
  entityId: company.id,
  description: `Empresa ${name} foi cadastrada.`,
  newData: {
    name,
    slug: normalizedSlug,
    color:
      color || "#15704f",
  },
});
  redirect(
    `/empresas/${company.id}`
  );
}