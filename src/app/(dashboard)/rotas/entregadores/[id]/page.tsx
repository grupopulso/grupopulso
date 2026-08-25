import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowLeft,
  Save,
  Truck,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";

import DeleteDriverButton from "@/app/components/delete-driver-button";

import {
  updateDriver,
} from "./actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function EditarEntregadorPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;

  const query =
    await searchParams;

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const [
    driverResult,
    companiesResult,
    routesResult,
  ] = await Promise.all([
    supabase
      .from("delivery_drivers")
      .select(`
        id,
        company_id,
        name,
        phone,
        whatsapp,
        notes,
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
      .from("delivery_routes")
      .select(`
        id,
        name,
        region,
        active
      `)
      .eq("driver_id", id)
      .order("name"),
  ]);

  const driver =
    driverResult.data;

  if (!driver) {
    notFound();
  }

  if (
    selectedCompanyId &&
    driver.company_id !==
      selectedCompanyId
  ) {
    notFound();
  }

  const companies =
    companiesResult.data ?? [];

  const routes =
    routesResult.data ?? [];

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/rotas/entregadores"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para entregadores
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <Truck className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Editar entregador
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Atualize os dados e a situação do entregador.
            </p>
          </div>
        </div>

        {query.error && (
          <ErrorMessage
            error={query.error}
          />
        )}

        <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form
            action={updateDriver.bind(
              null,
              driver.id
            )}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-2"
          >
            <div className="border-b border-slate-100 p-6">
              <h2 className="font-semibold text-slate-900">
                Dados do entregador
              </h2>
            </div>

            <div className="space-y-6 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nome *
                </label>

                <input
                  name="name"
                  required
                  defaultValue={
                    driver.name
                  }
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
                    driver.company_id
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

                {routes.length > 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    Este entregador possui rotas vinculadas. Se trocar a empresa, revise essas rotas.
                  </p>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Telefone
                  </label>

                  <input
                    name="phone"
                    defaultValue={
                      driver.phone ??
                      ""
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#15704f]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    WhatsApp
                  </label>

                  <input
                    name="whatsapp"
                    defaultValue={
                      driver.whatsapp ??
                      ""
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#15704f]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Observações
                </label>

                <textarea
                  name="notes"
                  rows={5}
                  defaultValue={
                    driver.notes ??
                    ""
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#15704f]"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={
                      driver.active
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />

                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Entregador ativo
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Entregadores inativos permanecem cadastrados, mas deixam de aparecer nas seleções principais.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <DeleteDriverButton
                driverId={
                  driver.id
                }
                driverName={
                  driver.name
                }
                routesCount={
                  routes.length
                }
              />

              <div className="flex gap-3">
                <Link
                  href="/rotas/entregadores"
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

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              Rotas vinculadas
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Rotas atualmente atribuídas a este entregador.
            </p>

            <div className="mt-5 space-y-3">
              {routes.map(
                (route) => (
                  <Link
                    key={route.id}
                    href={`/rotas/${route.id}`}
                    className="block rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-[#15704f]/20 hover:bg-[#15704f]/5"
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      {route.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {route.region ||
                        "Sem região"}
                    </p>

                    <span
                      className={`mt-3 inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
                        route.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {route.active
                        ? "Ativa"
                        : "Inativa"}
                    </span>
                  </Link>
                )
              )}

              {!routes.length && (
                <div className="rounded-xl bg-slate-50 p-5 text-center">
                  <p className="text-sm text-slate-400">
                    Nenhuma rota vinculada.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
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
      "Informe o nome do entregador.",

    empresa:
      "Selecione uma empresa.",

    salvar:
      "Não foi possível atualizar o entregador.",
  };

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {messages[error] ??
        "Ocorreu um erro ao atualizar o entregador."}
    </div>
  );
}