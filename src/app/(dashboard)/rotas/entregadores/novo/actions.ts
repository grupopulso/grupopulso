"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";

export async function createDriver(
  formData: FormData
) {
  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const name = String(
    formData.get("name") ?? ""
  ).trim();

  const companyId =
    String(
      formData.get("company_id") ?? ""
    ).trim() ||
    selectedCompanyId;

  const phone = String(
    formData.get("phone") ?? ""
  ).trim();

  const whatsapp = String(
    formData.get("whatsapp") ?? ""
  ).trim();

  const notes = String(
    formData.get("notes") ?? ""
  ).trim();

  if (!name) {
    redirect(
      "/rotas/entregadores/novo?error=nome"
    );
  }

  if (!companyId) {
    redirect(
      "/rotas/entregadores/novo?error=empresa"
    );
  }

  const { error } = await supabase
    .from("delivery_drivers")
    .insert({
      company_id: companyId,
      name,
      phone: phone || null,
      whatsapp: whatsapp || null,
      notes: notes || null,
      active: true,
    });

  if (error) {
    console.error(
      "Erro ao cadastrar entregador:",
      error
    );

    redirect(
      "/rotas/entregadores/novo?error=salvar"
    );
  }

  redirect("/rotas/entregadores");
}