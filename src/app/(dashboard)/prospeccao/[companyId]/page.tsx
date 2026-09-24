import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft, ClipboardList } from "lucide-react";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import NewListForm from "./new-list-form";
import DeleteListButton from "./delete-list-button";

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ProspeccaoEmpresaPage({
  params,
}: PageProps) {
  await requireModulePermission(
    "prospecting",
    "view"
  );

  const { companyId } = await params;

  await requireCompanyAccess(companyId);

  /*
   * Via service role: a permissão já foi checada acima.
   */
  const adminDb = createAdminClient();

  const { data: company } =
    await adminDb
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .maybeSingle();

  if (!company) {
    notFound();
  }

  const { data: lists } =
    await adminDb
      .from("prospecting_lists")
      .select(`
        id,
        name,
        created_at,

        leads:prospecting_leads (
          id,
          status
        )
      `)
      .eq("company_id", companyId)
      .order("created_at", {
        ascending: false,
      });

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/prospeccao"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Prospecção
        </Link>

        <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {company.name}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Listas de prospecção desta empresa.
            </p>
          </div>

          <NewListForm
            companyId={companyId}
          />
        </div>

        <div className="mt-7 space-y-3">
          {(lists ?? []).map((list) => {
            const leads =
              list.leads ?? [];

            const counts = {
              none: leads.filter(
                (lead) =>
                  lead.status ===
                  "none"
              ).length,

              contacted: leads.filter(
                (lead) =>
                  lead.status ===
                  "contacted"
              ).length,

              closed: leads.filter(
                (lead) =>
                  lead.status ===
                  "closed"
              ).length,

              declined: leads.filter(
                (lead) =>
                  lead.status ===
                  "declined"
              ).length,
            };

            return (
              <Link
                key={list.id}
                href={`/prospeccao/${companyId}/${list.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-[#15704f]/40 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <ClipboardList className="h-4.5 w-4.5" />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900">
                      {list.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {leads.length}{" "}
                      cliente(s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <LegendDot
                    count={counts.closed}
                    className="bg-emerald-500"
                  />

                  <LegendDot
                    count={
                      counts.contacted
                    }
                    className="bg-amber-400"
                  />

                  <LegendDot
                    count={
                      counts.declined
                    }
                    className="bg-red-500"
                  />

                  <LegendDot
                    count={counts.none}
                    className="border border-slate-300 bg-white"
                  />

                  <DeleteListButton
                    companyId={
                      companyId
                    }
                    listId={list.id}
                    listName={
                      list.name
                    }
                  />
                </div>
              </Link>
            );
          })}

          {(lists ?? []).length ===
            0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
              Nenhuma lista criada ainda.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function LegendDot({
  count,
  className,
}: {
  count: number;
  className: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span
        className={`h-2.5 w-2.5 rounded-full ${className}`}
      />
      {count}
    </span>
  );
}
