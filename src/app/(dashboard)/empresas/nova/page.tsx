import Link from "next/link";

import {
  ArrowLeft,
  Building2,
  Save,
} from "lucide-react";

import { createCompany } from "./actions";
import {
  requireAdmin,
} from "@/app/lib/permissions";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NovaEmpresaPage({
  searchParams,
}: PageProps) {
    await requireAdmin();

  const params =
    await searchParams;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/empresas"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para empresas
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <Building2 className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Nova empresa
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre uma nova empresa para integrar a gestão do Grupo Pulso.
            </p>
          </div>
        </div>

        {params.error && (
          <ErrorMessage
            error={
              params.error
            }
          />
        )}

        <form
          action={
            createCompany
          }
          className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-100 p-6">
            <h2 className="font-semibold text-slate-900">
              Dados da empresa
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Essas informações serão utilizadas nos filtros e identificação visual do sistema.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nome da empresa *
              </label>

              <input
                name="name"
                type="text"
                required
                placeholder="Ex.: Nova empresa"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#15704f] focus:ring-2 focus:ring-[#15704f]/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Identificador *
              </label>

              <input
                name="slug"
                type="text"
                required
                placeholder="Ex.: nova-empresa"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#15704f] focus:ring-2 focus:ring-[#15704f]/10"
              />

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Use um identificador simples. Ex.: o-estafeta, atthus, pottenciaza.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Cor de identificação
              </label>

              <div className="flex items-center gap-4">
                <input
                  type="color"
                  name="color"
                  defaultValue="#15704f"
                  className="h-12 w-16 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                />

                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Cor da empresa
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Será usada em indicadores, tabelas e identificações no sistema.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-800">
                Após o cadastro
              </p>

              <p className="mt-1 text-xs leading-5 text-blue-700">
                A empresa será criada como ativa e poderá receber clientes, produtos, contratos, lançamentos financeiros, entregadores e rotas.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Link
              href="/empresas"
              className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
            >
              <Save className="h-4 w-4" />
              Cadastrar empresa
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
      "Informe o nome da empresa.",

    slug:
      "Informe o identificador da empresa.",

    duplicada:
      "Já existe uma empresa com esse identificador.",

    salvar:
      "Não foi possível cadastrar a empresa. Tente novamente.",
  };

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {messages[error] ??
        "Ocorreu um erro ao cadastrar a empresa."}
    </div>
  );
}