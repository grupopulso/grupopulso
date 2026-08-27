"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

export async function updateRoute(
  routeId: string,
  formData: FormData
) {
  await requireModulePermission(
    "routes",
    "edit"
  );

  const supabase = await createClient();

  const { data: existingRoute } =
    await supabase
      .from("delivery_routes")
      .select("company_id")
      .eq("id", routeId)
      .maybeSingle();

  if (!existingRoute) {
    redirect(
      `/rotas/${routeId}/editar?error=salvar`
    );
  }

  /*
   * Garante acesso à empresa atual
   * da rota.
   */
  await requireCompanyAccess(
    existingRoute.company_id
  );

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

  /*
   * Garante acesso também à empresa
   * de destino, caso o usuário esteja
   * trocando a empresa da rota.
   */
  await requireCompanyAccess(companyId);

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
  await requireModulePermission(
    "routes",
    "delete"
  );

  const supabase = await createClient();

  const { data: existingRoute } =
    await supabase
      .from("delivery_routes")
      .select("company_id")
      .eq("id", routeId)
      .maybeSingle();

  if (!existingRoute) {
    return {
      success: false,
      message: "Rota não encontrada.",
    };
  }

  await requireCompanyAccess(
    existingRoute.company_id
  );

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