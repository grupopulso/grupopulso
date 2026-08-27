"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

export async function createRoute(formData: FormData) {
  await requireModulePermission(
    "routes",
    "create"
  );

  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const name = String(
    formData.get("name") ?? ""
  ).trim();

  const companyId =
    String(
      formData.get("company_id") ?? ""
    ).trim() || selectedCompanyId;

  const driverId = String(
    formData.get("driver_id") ?? ""
  ).trim();

  const region = String(
    formData.get("region") ?? ""
  ).trim();

  const description = String(
    formData.get("description") ?? ""
  ).trim();

  if (!name) {
    redirect("/rotas/nova?error=nome");
  }

  if (!companyId) {
    redirect("/rotas/nova?error=empresa");
  }

  /*
   * Segurança: garante que o usuário
   * realmente tem acesso à empresa
   * informada, em vez de confiar apenas
   * no valor enviado pelo formulário.
   */
  await requireCompanyAccess(companyId);

  /*
   * Segurança adicional:
   * se houver entregador selecionado,
   * confirmamos que ele pertence
   * à mesma empresa da rota.
   */
  if (driverId) {
    const { data: driver } = await supabase
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
        "/rotas/nova?error=entregador"
      );
    }
  }

  const { data: route, error } =
    await supabase
      .from("delivery_routes")
      .insert({
        company_id: companyId,
        driver_id: driverId || null,
        name,
        region: region || null,
        description:
          description || null,
        active: true,
      })
      .select("id")
      .single();

  if (error || !route) {
    console.error(
      "Erro ao cadastrar rota:",
      error
    );

    redirect(
      "/rotas/nova?error=salvar"
    );
  }

  /*
   * Em vez de voltar para a listagem,
   * abrimos diretamente a rota.
   *
   * O próximo passo será adicionar
   * os assinantes.
   */
  redirect(`/rotas/${route.id}`);
}