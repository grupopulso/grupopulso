import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Users,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";

import RouteSubscribersManager from "@/app/components/route-subscribers-manager";

import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AssinantesRotaPage({
  params,
}: PageProps) {
   await requireModulePermission(
  "routes",
  "edit"
);
  const { id } = await params;

  const supabase = await createClient();

  const { data: route, error: routeError } =
    await supabase
      .from("delivery_routes")
      .select(`
        id,
        company_id,
        name,

        company:companies (
          id,
          name
        )
      `)
      .eq("id", id)
      .maybeSingle();

  if (routeError) {
    console.error(
      "Erro ao carregar rota:",
      routeError
    );
  }

  if (!route) {
    notFound();
  }

  await requireCompanyAccess(
    route.company_id
  );

  const { data: clients, error: clientsError } =
  await supabase
    .from("clients")
    .select(`
      id,
      name,
      cpf_cnpj,
      phone,
      whatsapp,

      client_companies!inner (
        company_id,
        status
      ),

      client_addresses (
        id,
        street,
        number,
        complement,
        neighborhood,
        city,
        state
      )
    `)
    .eq(
      "client_companies.company_id",
      route.company_id
    )
    .order("name");

  if (clientsError) {
    console.error(
      "Erro ao carregar clientes:",
      clientsError
    );
  }

  const { data: currentRelations } =
    await supabase
      .from("delivery_route_clients")
      .select(`
        id,
        client_id,
        address_id,
        delivery_order,
        notes,
        active
      `)
      .eq("route_id", id)
      .eq("active", true)
      .order("delivery_order");

  const company = Array.isArray(route.company)
    ? route.company[0]
    : route.company;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href={`/rotas/${route.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para rota
        </Link>

        <div className="mt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
              <Users className="h-5 w-5 text-[#15704f]" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Assinantes da rota
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {route.name}
                {company?.name
                  ? ` • ${company.name}`
                  : ""}
              </p>
            </div>
          </div>
        </div>

        <RouteSubscribersManager
          routeId={route.id}
          clients={clients ?? []}
          initialRelations={
            currentRelations ?? []
          }
        />
      </div>
    </main>
  );
}