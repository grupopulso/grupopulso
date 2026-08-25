import Link from "next/link";

import {
  ArrowLeft,
  MapPinned,
  Save,
  Truck,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";

import { createRoute } from "./actions";
import {
  requireModulePermission,
} from "@/app/lib/permissions";


type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NovaRotaPage({
  searchParams,
}: PageProps) {
    await requireModulePermission(
  "routes",
  "create"
);
    
  const params = await searchParams;

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const [
    companiesResult,
    driversResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(`
        id,
        name,
        color
      `)
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

  const companies =
    companiesResult.data ?? [];

  const drivers =
    driversResult.data ?? [];

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/rotas"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para rotas
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <MapPinned className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Nova rota
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre uma nova rota de entrega.
            </p>
          </div>
        </div>

        {params.error && (
          <ErrorMessage
            error={params.error}
          />
        )}

        <form
          action={createRoute}
          className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-100 p-6">
            <h2 className="font-semibold text-slate-900">
              Informações da rota
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Depois de salvar, você poderá adicionar os assinantes e definir a ordem das entregas.
            </p>
          </div>

          <div className="space-y-6 p-6">
            {/* NOME */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nome da rota *
              </label>

              <input
                name="name"
                type="text"
                required
                placeholder="Ex.: Centro - Rota 01"
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#15704f]"
              />
            </div>

            {/* EMPRESA */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Empresa *
              </label>

              <select
                name="company_id"
                required
                defaultValue={
                  selectedCompanyId ??
                  ""
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#15704f]"
              >
                <option
                  value=""
                  disabled
                >
                  Selecione uma empresa
                </option>

                {companies.map(
                  (company) => (
                    <option
                      key={company.id}
                      value={company.id}
                    >
                      {company.name}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* REGIÃO */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Região / Bairro
              </label>

              <input
                name="region"
                type="text"
                placeholder="Ex.: Centro, Bairro São Francisco..."
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#15704f]"
              />
            </div>

            {/* ENTREGADOR */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Entregador responsável
              </label>

              <div className="relative">
                <Truck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <select
                  name="driver_id"
                  defaultValue=""
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-[#15704f]"
                >
                  <option value="">
                    Sem entregador
                  </option>

                  {drivers
                    .filter(
                      (driver) =>
                        !selectedCompanyId ||
                        driver.company_id ===
                          selectedCompanyId
                    )
                    .map(
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

              <p className="mt-2 text-xs text-slate-400">
                O entregador poderá ser alterado posteriormente.
              </p>
            </div>

            {/* DESCRIÇÃO */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Observações da rota
              </label>

              <textarea
                name="description"
                rows={4}
                placeholder="Ex.: iniciar pela Av. Júlio de Castilhos, depois seguir para..."
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#15704f]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Link
              href="/rotas"
              className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
            >
              <Save className="h-4 w-4" />
              Criar rota
            </button>
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
      "Selecione a empresa responsável pela rota.",

    entregador:
      "O entregador selecionado não pertence à empresa da rota.",

    salvar:
      "Não foi possível criar a rota. Tente novamente.",
  };

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {messages[error] ??
        "Ocorreu um erro ao salvar a rota."}
    </div>
  );
}