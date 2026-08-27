import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowLeft,
  MapPinned,
  Save,
  Truck,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";

import {
  updateRoute,
} from "./actions";

import DeleteRouteButton from "@/app/components/delete-route-button";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function EditarRotaPage({
  params,
  searchParams,
}: PageProps) {
    await requireModulePermission(
  "routes",
  "edit"
);
  const { id } =
    await params;

  const query =
    await searchParams;

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const [
    routeResult,
    companiesResult,
    driversResult,
  ] = await Promise.all([
    supabase
      .from("delivery_routes")
      .select(`
        id,
        company_id,
        driver_id,
        name,
        description,
        region,
        active
      `)
      .eq("id", id)
      .maybeSingle(),

    supabase
      .from("companies")
      .select(`
        id,
        name,
        color
      `)
      .eq("active", true)
      .order("name"),

    supabase
      .from("delivery_drivers")
      .select(`
        id,
        company_id,
        name,
        active
      `)
      .eq("active", true)
      .order("name"),
  ]);

  const route =
    routeResult.data;

  if (!route) {
    notFound();
  }

  await requireCompanyAccess(
    route.company_id
  );

  if (
    selectedCompanyId &&
    route.company_id !==
      selectedCompanyId
  ) {
    notFound();
  }

  const companies =
    companiesResult.data ?? [];

  const drivers =
    driversResult.data ?? [];

  const availableDrivers =
    drivers.filter(
      (driver) =>
        driver.company_id ===
        route.company_id
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/rotas/${route.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para rota
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <MapPinned className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Editar rota
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Atualize as informações e configurações da rota.
            </p>
          </div>
        </div>

        {query.error && (
          <ErrorMessage
            error={query.error}
          />
        )}

        <form
          action={updateRoute.bind(
            null,
            route.id
          )}
          className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-100 p-6">
            <h2 className="font-semibold text-slate-900">
              Informações da rota
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Altere os dados abaixo e salve para atualizar a rota.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nome da rota *
              </label>

              <input
                name="name"
                defaultValue={
                  route.name
                }
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#15704f]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Empresa *
              </label>

              <select
                name="company_id"
                required
                defaultValue={
                  route.company_id
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#15704f]"
              >
                {companies.map(
                  (company) => (
                    <option
                      key={
                        company.id
                      }
                      value={
                        company.id
                      }
                    >
                      {
                        company.name
                      }
                    </option>
                  )
                )}
              </select>

              <p className="mt-2 text-xs text-amber-600">
                Se trocar a empresa da rota, verifique também o entregador e os assinantes vinculados.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Região / Bairro
              </label>

              <input
                name="region"
                defaultValue={
                  route.region ??
                  ""
                }
                placeholder="Ex.: Centro"
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#15704f]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Entregador responsável
              </label>

              <div className="relative">
                <Truck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <select
                  name="driver_id"
                  defaultValue={
                    route.driver_id ??
                    ""
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-[#15704f]"
                >
                  <option value="">
                    Sem entregador
                  </option>

                  {availableDrivers.map(
                    (driver) => (
                      <option
                        key={
                          driver.id
                        }
                        value={
                          driver.id
                        }
                      >
                        {
                          driver.name
                        }
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Observações
              </label>

              <textarea
                name="description"
                rows={5}
                defaultValue={
                  route.description ??
                  ""
                }
                placeholder="Informações gerais sobre a rota..."
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#15704f]"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={
                    route.active
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Rota ativa
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Rotas inativas continuam cadastradas, mas podem ser separadas das rotas atualmente utilizadas.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <DeleteRouteButton
              routeId={route.id}
              routeName={
                route.name
              }
            />

            <div className="flex gap-3">
              <Link
                href={`/rotas/${route.id}`}
                className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
              >
                <Save className="h-4 w-4" />
                Salvar alterações
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function ErrorMessage({
  error,
}: {
  error: string;
}) {
  const messages: Record<
    string,
    string
  > = {
    nome:
      "Informe o nome da rota.",

    empresa:
      "Selecione uma empresa.",

    entregador:
      "O entregador selecionado não pertence à empresa da rota.",

    salvar:
      "Não foi possível atualizar a rota.",
  };

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {messages[error] ??
        "Ocorreu um erro ao atualizar a rota."}
    </div>
  );
}