import Link from "next/link";

import {
  ArrowLeft,
  Newspaper,
} from "lucide-react";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import EditionForm from "./edition-form";

export default async function NewEditionPage() {
  const access =
    await requireEstafetaAccess();

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-5xl">

        {/* VOLTAR */}

        <div className="mb-7">
          <Link
            href="/edicoes"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />

            Edições
          </Link>
        </div>

        {/* CABEÇALHO */}

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
            <Newspaper className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Nova edição
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Crie uma edição do O Estafeta para registrar as vendas de publicidade.
            </p>
          </div>
        </div>

        {/* FORMULÁRIO */}

        <EditionForm
          company={{
            id:
              access.estafetaCompany.id,

            name:
              access.estafetaCompany.name,
          }}
        />
      </div>
    </main>
  );
}