import Link from "next/link";

import { Building2, Radar } from "lucide-react";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function ProspeccaoPage() {
  const access =
    await requireModulePermission(
      "prospecting",
      "view"
    );

  /*
   * Via service role: a permissão já foi checada acima.
   */
  const adminDb = createAdminClient();

  let companiesQuery = adminDb
    .from("companies")
    .select("id, name, color")
    .eq("active", true)
    .order("name");

  if (
    access.profile.role !== "admin"
  ) {
    companiesQuery = companiesQuery.in(
      "id",
      access.companyIds.length > 0
        ? access.companyIds
        : [
            "00000000-0000-0000-0000-000000000000",
          ]
    );
  }

  const { data: companies } =
    await companiesQuery;

  const companyIds = (
    companies ?? []
  ).map((company) => company.id);

  const { data: lists } =
    companyIds.length > 0
      ? await adminDb
          .from("prospecting_lists")
          .select("id, company_id")
          .in(
            "company_id",
            companyIds
          )
      : { data: [] };

  const listCountByCompany = new Map<
    string,
    number
  >();

  for (const list of lists ??
    []) {
    listCountByCompany.set(
      list.company_id,
      (listCountByCompany.get(
        list.company_id
      ) ?? 0) + 1
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <Radar className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Prospecção
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Listas de clientes a prospectar, por empresa —
              evita que dois vendedores ofereçam pro mesmo
              cliente.
            </p>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {(companies ?? []).map(
            (company) => (
              <Link
                key={company.id}
                href={`/prospeccao/${company.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-[#15704f]/40 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor:
                        (company.color ??
                          "#94a3b8") +
                        "20",
                    }}
                  >
                    <Building2
                      className="h-5 w-5"
                      style={{
                        color:
                          company.color ??
                          "#64748b",
                      }}
                    />
                  </span>

                  <p className="font-semibold text-slate-900">
                    {company.name}
                  </p>
                </div>

                <p className="mt-4 text-sm text-slate-500">
                  {listCountByCompany.get(
                    company.id
                  ) ?? 0}{" "}
                  lista(s) de prospecção
                </p>
              </Link>
            )
          )}

          {(companies ?? [])
            .length === 0 && (
            <p className="col-span-3 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
              Nenhuma empresa disponível.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
