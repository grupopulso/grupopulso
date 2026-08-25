import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowLeft,
  Building2,
  Save,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";

import {
  updateCompany,
} from "./actions";

import {
  requireAdmin,
} from "@/app/lib/permissions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function EmpresaPage({
  params,
  searchParams,
}: PageProps) {
    await requireAdmin();

  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const {
    data: company,
    error,
  } = await supabase
    .from("companies")
    .select(`
      id,
      name,
      slug,
      color,
      active
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(
      "Erro ao carregar empresa:",
      error
    );
  }

  if (!company) {
    notFound();
  }

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
              Editar empresa
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Atualize os dados da empresa.
            </p>
          </div>
        </div>

        {query.error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {query.error === "dados"
              ? "Informe nome e slug."
              : "Não foi possível salvar as alterações."}
          </div>
        )}

        <form
          action={updateCompany.bind(
            null,
            company.id
          )}
          className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="space-y-6 p-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nome *
              </label>

              <input
                name="name"
                defaultValue={company.name}
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#15704f]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Identificador
              </label>

              <input
                name="slug"
                defaultValue={company.slug}
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#15704f]"
              />

              <p className="mt-2 text-xs text-slate-400">
                Ex.: o-estafeta, atthus, pottencializa
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Cor da empresa
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="color"
                  name="color"
                  defaultValue={
                    company.color ??
                    "#15704f"
                  }
                  className="h-11 w-16 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                />

                <p className="text-sm text-slate-500">
                  Utilizada nos indicadores e identificações visuais.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={company.active}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Empresa ativa
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Empresas inativas deixam de aparecer nas seleções principais.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Link
              href="/empresas"
              className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600"
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
        </form>
      </div>
    </main>
  );
}