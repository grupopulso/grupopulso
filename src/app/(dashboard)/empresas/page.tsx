import Link from "next/link";

import {
  Building2,
  ChevronRight,
  Plus,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireAdmin,
} from "@/app/lib/permissions";

export default async function EmpresasPage() {
  await requireAdmin();

  const supabase =
    await createClient();

  const {
    data: companies,
    error,
  } = await supabase
    .from("companies")
    .select(`
      id,
      name,
      slug,
      color,
      active,
      created_at
    `)
    .order("name");

  if (error) {
    console.error(
      "Erro ao carregar empresas:",
      error
    );
  }

  const total =
    companies?.length ?? 0;

  const active =
    companies?.filter(
      (company) => company.active
    ).length ?? 0;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Empresas
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Gerencie as empresas vinculadas ao Grupo Pulso.
            </p>
          </div>

          <Link
            href="/empresas/nova"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <Plus className="h-4 w-4" />
            Nova empresa
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
          <SummaryCard
            label="Empresas cadastradas"
            value={String(total)}
          />

          <SummaryCard
            label="Empresas ativas"
            value={String(active)}
          />
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {companies?.map((company) => (
            <Link
              key={company.id}
              href={`/empresas/${company.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-[#15704f]/30 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: `${company.color ?? "#15704f"}18`,
                    }}
                  >
                    <Building2
                      className="h-6 w-6"
                      style={{
                        color:
                          company.color ??
                          "#15704f",
                      }}
                    />
                  </div>

                  <div>
                    <h2 className="font-semibold text-slate-900 group-hover:text-[#15704f]">
                      {company.name}
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      {company.slug}
                    </p>
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#15704f]" />
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    company.active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {company.active
                    ? "Ativa"
                    : "Inativa"}
                </span>
              </div>
            </Link>
          ))}

          {!companies?.length && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
              <Building2 className="mx-auto h-8 w-8 text-slate-300" />

              <p className="mt-4 text-sm font-semibold text-slate-600">
                Nenhuma empresa cadastrada.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}