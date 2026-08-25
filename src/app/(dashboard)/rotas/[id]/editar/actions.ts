"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";

export async function updateRoute(
  routeId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const name = String(
    formData.get("name") ?? ""
  ).trim();

  const companyId = String(
    formData.get("company_id") ?? ""
  ).trim();

  const driverId = String(
    formData.get("driver_id") ?? ""
  ).trim();

  const region = String(
    formData.get("region") ?? ""
  ).trim();

  const description = String(
    formData.get("description") ?? ""
  ).trim();

  const active =
    formData.get("active") === "on";

  if (!name) {
    redirect(
      `/rotas/${routeId}/editar?error=nome`
    );
  }

  if (!companyId) {
    redirect(
      `/rotas/${routeId}/editar?error=empresa`
    );
  }

  if (driverId) {
    const { data: driver } =
      await supabase
        .from("delivery_drivers")
        .select(`
          id,
          company_id
        `)
        .eq("id", driverId)
        .maybeSingle();

    if (
      !driver ||
      driver.company_id !== companyId
    ) {
      redirect(
        `/rotas/${routeId}/editar?error=entregador`
      );
    }
  }

  const { error } = await supabase
    .from("delivery_routes")
    .update({
      name,
      company_id: companyId,
      driver_id: driverId || null,
      region: region || null,
      description:
        description || null,
      active,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", routeId);

  if (error) {
    console.error(
      "Erro ao atualizar rota:",
      error
    );

    redirect(
      `/rotas/${routeId}/editar?error=salvar`
    );
  }

  revalidatePath("/rotas");
  revalidatePath(
    `/rotas/${routeId}`
  );

  redirect(
    `/rotas/${routeId}`
  );
}

export async function deleteRoute(
  routeId: string
) {
  const supabase = await createClient();

  /*
   * delivery_route_clients será
   * removido automaticamente porque
   * criamos a FK com ON DELETE CASCADE.
   */

  const { error } = await supabase
    .from("delivery_routes")
    .delete()
    .eq("id", routeId);

  if (error) {
    console.error(
      "Erro ao excluir rota:",
      error
    );

    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/rotas");

  redirect("/rotas");
}