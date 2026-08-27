import Link from "next/link";

import {
  ArrowLeft,
  Save,
  Truck,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";

import { createDriver } from "./actions";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NovoEntregadorPage({
  searchParams,
}: PageProps) {
  await requireModulePermission(
    "routes",
    "create"
  );

  const params = await searchParams;

  const supabase = await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  const { data: companies } =
    await supabase
      .from("companies")
      .select(`
        id,
        name,
        color
      `)
      .order("name");

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/rotas/entregadores"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para entregadores
        </Link>

        <div className="mt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
              <Truck className="h-5 w-5 text-[#15704f]" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Novo entregador
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Cadastre um entregador para vinculá-lo às rotas.
              </p>
            </div>
          </div>
        </div>

        {params.error && (
          <ErrorMessage
            error={params.error}
          />
        )}

        <form
          action={createDriver}
          className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-100 p-6">
            <h2 className="font-semibold text-slate-900">
              Dados do entregador
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Informe os dados básicos do responsável pelas entregas.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nome *
              </label>

              <input
                type="text"
                name="name"
                required
                placeholder="Nome do entregador"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#15704f] focus:ring-2 focus:ring-[#15704f]/10"
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
                  selectedCompanyId ?? ""
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#15704f]"
              >
                <option
                  value=""
                  disabled
                >
                  Selecione uma empresa
                </option>

                {companies?.map(
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

              {selectedCompanyId && (
                <p className="mt-2 text-xs text-slate-400">
                  A empresa selecionada no filtro global foi preenchida automaticamente.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Telefone
                </label>

                <input
                  type="text"
                  name="phone"
                  placeholder="(54) 99999-9999"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#15704f]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  WhatsApp
                </label>

                <input
                  type="text"
                  name="whatsapp"
                  placeholder="(54) 99999-9999"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#15704f]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Observações
              </label>

              <textarea
                name="notes"
                rows={4}
                placeholder="Informações adicionais sobre o entregador..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#15704f]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
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
              Salvar entregador
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
      "Informe o nome do entregador.",
    empresa:
      "Selecione uma empresa.",
    salvar:
      "Não foi possível cadastrar o entregador. Tente novamente.",
  };

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {messages[error] ??
        "Ocorreu um erro ao salvar."}
    </div>
  );
}