import Link from "next/link";

import {
  MapPin,
  Monitor,
  Plus,
} from "lucide-react";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

import TvEditForm from "./tv-edit-form";

const POTTENCIALIZA_COMPANY_ID =
  "9d08d74c-c5fe-48c9-b0c5-382cea273d99";

export default async function TVsPage() {
  await requireModulePermission(
    "settings",
    "view"
  );

  const supabase =
    await createClient();

  const {
    data: tvs,
    error,
  } = await supabase
    .from(
      "pottencializa_tvs"
    )
    .select(`
      id,
      name,
      location,
      description,
      active
    `)
    .eq(
      "company_id",
      POTTENCIALIZA_COMPANY_ID
    )
    .order(
      "name"
    );

  if (error) {
    console.error(
      "Erro ao carregar TVs:",
      error
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
                <Monitor className="h-5 w-5 text-[#15704f]" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  TVs / Telões
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Gerencie os pontos de mídia da Pottencializa.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/configuracoes/tvs/nova"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <Plus className="h-4 w-4" />

            Nova TV
          </Link>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(tvs ?? []).map(
            (tv) => (
              <div
                key={tv.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-[#15704f]" />

                      <h2 className="font-semibold text-slate-900">
                        {tv.name}
                      </h2>
                    </div>

                    <div className="mt-3 flex items-start gap-2 text-sm text-slate-500">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

                      <span>
                        {tv.location ||
                          "Localização não informada"}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      tv.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {tv.active
                      ? "Ativa"
                      : "Inativa"}
                  </span>
                </div>

                {tv.description && (
                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {tv.description}
                  </p>
                )}

                <div className="mt-5 border-t border-slate-100 pt-5">
                  <TvEditForm
                    tv={{
                      id: tv.id,
                      name: tv.name,
                      location:
                        tv.location ??
                        "",
                      description:
                        tv.description ??
                        "",
                      active:
                        tv.active,
                    }}
                  />
                </div>
              </div>
            )
          )}
        </div>

        {!tvs?.length && (
          <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
            Nenhuma TV cadastrada.
          </div>
        )}
      </div>
    </main>
  );
}