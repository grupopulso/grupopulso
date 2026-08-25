"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireAdmin,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

export async function updateCompany(
  companyId: string,
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
  ).trim();

  const color = String(
    formData.get("color") ?? ""
  ).trim();

  const active =
    formData.get("active") === "on";

  if (!name || !slug) {
    redirect(
      `/empresas/${companyId}?error=dados`
    );
  }

const {
  data: oldCompany,
} = await supabase
  .from("companies")
  .select(`
    id,
    name,
    slug,
    color,
    active
  `)
  .eq("id", companyId)
  .maybeSingle();
  const { error } = await supabase
    .from("companies")
    .update({
      name,
      slug,
      color: color || null,
      active,
    })
    .eq("id", companyId);

  if (error) {
    console.error(
      "Erro ao atualizar empresa:",
      error
    );

    redirect(
      `/empresas/${companyId}?error=salvar`
    );
  }

  revalidatePath("/empresas");
  revalidatePath(`/empresas/${companyId}`);

  await createAuditLog({
  module: "settings",
  action: "update",
  entityType: "company",
  entityId: companyId,
  description: `Empresa ${name} foi atualizada.`,
  oldData:
    oldCompany ?? undefined,
  newData: {
    name,
    slug,
    color:
      color || null,
    active,
  },
});

  redirect("/empresas");
}