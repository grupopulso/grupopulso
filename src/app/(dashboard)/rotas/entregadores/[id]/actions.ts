"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";

export async function updateDriver(
  driverId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const name = String(
    formData.get("name") ?? ""
  ).trim();

  const companyId = String(
    formData.get("company_id") ?? ""
  ).trim();

  const phone = String(
    formData.get("phone") ?? ""
  ).trim();

  const whatsapp = String(
    formData.get("whatsapp") ?? ""
  ).trim();

  const notes = String(
    formData.get("notes") ?? ""
  ).trim();

  const active =
    formData.get("active") === "on";

  if (!name) {
    redirect(
      `/rotas/entregadores/${driverId}?error=nome`
    );
  }

  if (!companyId) {
    redirect(
      `/rotas/entregadores/${driverId}?error=empresa`
    );
  }

  const { error } = await supabase
    .from("delivery_drivers")
    .update({
      name,
      company_id: companyId,
      phone: phone || null,
      whatsapp: whatsapp || null,
      notes: notes || null,
      active,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", driverId);

  if (error) {
    console.error(
      "Erro ao atualizar entregador:",
      error
    );

    redirect(
      `/rotas/entregadores/${driverId}?error=salvar`
    );
  }

  revalidatePath(
    "/rotas/entregadores"
  );

  revalidatePath("/rotas");

  redirect(
    "/rotas/entregadores"
  );
}

export async function deleteDriver(
  driverId: string
) {
  const supabase = await createClient();

  /*
   * As rotas não serão excluídas.
   * Como a FK foi criada com
   * ON DELETE SET NULL, elas ficam
   * simplesmente sem entregador.
   */

  const { error } = await supabase
    .from("delivery_drivers")
    .delete()
    .eq("id", driverId);

  if (error) {
    console.error(
      "Erro ao excluir entregador:",
      error
    );

    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath(
    "/rotas/entregadores"
  );

  revalidatePath("/rotas");

  redirect(
    "/rotas/entregadores"
  );
}