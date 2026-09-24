import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import AddLeadForm from "./add-lead-form";
import LeadRow from "./lead-row";

type PageProps = {
  params: Promise<{
    companyId: string;
    listId: string;
  }>;
};

export default async function ProspeccaoListaPage({
  params,
}: PageProps) {
  await requireModulePermission(
    "prospecting",
    "view"
  );

  const { companyId, listId } =
    await params;

  await requireCompanyAccess(companyId);

  /*
   * Via service role: a permissão já foi checada acima.
   */
  const adminDb = createAdminClient();

  const [
    { data: list },
    { data: leads },
    { data: sellers },
  ] = await Promise.all([
    adminDb
      .from("prospecting_lists")
      .select("id, name, company_id")
      .eq("id", listId)
      .eq("company_id", companyId)
      .maybeSingle(),

    adminDb
      .from("prospecting_leads")
      .select(`
        id,
        client_name,
        seller_user_id,
        value,
        size,
        status,
        billing_note
      `)
      .eq("list_id", listId)
      .order("client_name"),

    adminDb
      .from("user_profiles")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  if (!list) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href={`/prospeccao/${companyId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <h1 className="mt-5 text-2xl font-semibold text-slate-900">
          {list.name}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {(leads ?? []).length}{" "}
          cliente(s) nesta lista.
        </p>

        <AddLeadForm
          companyId={companyId}
          listId={listId}
          sellers={sellers ?? []}
        />

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <Header>
                    Cliente
                  </Header>
                  <Header>
                    Vendedor
                  </Header>
                  <Header>Valor</Header>
                  <Header>
                    Tamanho
                  </Header>
                  <Header>
                    Situação
                  </Header>
                  <Header>
                    Cobrança
                  </Header>
                  <Header>
                    {""}
                  </Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {(leads ?? []).map(
                  (lead) => (
                    <LeadRow
                      key={lead.id}
                      companyId={
                        companyId
                      }
                      listId={listId}
                      lead={lead}
                      sellers={
                        sellers ?? []
                      }
                    />
                  )
                )}

                {(leads ?? [])
                  .length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-slate-400"
                    >
                      Nenhum cliente
                      adicionado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function Header({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
