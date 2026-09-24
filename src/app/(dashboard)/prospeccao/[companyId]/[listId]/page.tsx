import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft, BarChart3 } from "lucide-react";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import AddLeadForm from "./add-lead-form";
import LeadsTable from "./leads-table";

/*
 * Lista de prospecção é uma ferramenta viva (evita vendedores
 * ofertando pro mesmo cliente) — nunca pode mostrar uma foto
 * desatualizada, então força sempre buscar do banco de novo.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    companyId: string;
    listId: string;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(value);
}

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

  const allLeads = leads ?? [];
  const allSellers = sellers ?? [];

  /*
   * =========================
   * DASHBOARD POR VENDEDOR
   * =========================
   *
   * Prospectados = clientes atribuídos ao vendedor nesta lista.
   * Vendidos = quantos desses ele fechou o anúncio.
   * Total vendido = soma do valor dos fechados.
   */
  const sellerNameById = new Map(
    allSellers.map((seller) => [
      seller.id,
      seller.name ?? "Vendedor",
    ])
  );

  const statsBySeller = new Map<
    string,
    {
      name: string;
      prospected: number;
      sold: number;
      totalSold: number;
    }
  >();

  for (const lead of allLeads) {
    const sellerId =
      lead.seller_user_id ?? "sem-vendedor";

    const name =
      lead.seller_user_id
        ? sellerNameById.get(
            lead.seller_user_id
          ) ?? "Vendedor"
        : "Sem vendedor";

    const current =
      statsBySeller.get(sellerId) ?? {
        name,
        prospected: 0,
        sold: 0,
        totalSold: 0,
      };

    current.prospected += 1;

    if (lead.status === "closed") {
      current.sold += 1;
      current.totalSold += Number(
        lead.value ?? 0
      );
    }

    statsBySeller.set(
      sellerId,
      current
    );
  }

  const sellerStats = Array.from(
    statsBySeller.values()
  ).sort(
    (a, b) => b.totalSold - a.totalSold
  );

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
          {allLeads.length} cliente(s)
          nesta lista.
        </p>

        {/* DASHBOARD */}

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#15704f]" />

            <h2 className="text-sm font-semibold text-slate-900">
              Dashboard
            </h2>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-4">
                    Vendedor
                  </th>
                  <th className="pb-2 pr-4">
                    Prospectados
                  </th>
                  <th className="pb-2 pr-4">
                    Vendidos
                  </th>
                  <th className="pb-2 pr-4 text-right">
                    Total vendido
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {sellerStats.map(
                  (stat, index) => (
                    <tr key={index}>
                      <td className="py-2 pr-4 font-medium text-slate-800">
                        {stat.name}
                      </td>

                      <td className="py-2 pr-4 text-slate-600">
                        {
                          stat.prospected
                        }
                      </td>

                      <td className="py-2 pr-4 text-slate-600">
                        {stat.sold}
                      </td>

                      <td className="py-2 pr-4 text-right font-semibold text-slate-900">
                        {formatCurrency(
                          stat.totalSold
                        )}
                      </td>
                    </tr>
                  )
                )}

                {sellerStats.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-slate-400"
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

        <LeadsTable
          companyId={companyId}
          listId={listId}
          leads={allLeads}
          sellers={allSellers}
        >
          <AddLeadForm
            companyId={companyId}
            listId={listId}
            sellers={allSellers}
          />
        </LeadsTable>
      </div>
    </main>
  );
}
