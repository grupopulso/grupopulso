import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Newspaper,
  ShoppingCart,
} from "lucide-react";

import { notFound } from "next/navigation";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import { SaleForm } from "../../[id]/vendas/nova/sale-form";
import { loadSaleFormData } from "../load-sale-form-data";

type PageProps = {
  searchParams: Promise<{
    edicao?: string;
  }>;
};

export default async function NovaVendaPage({
  searchParams,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const { edicao } =
    await searchParams;

  /*
   * =====================================================
   * SEM EDIÇÃO SELECIONADA → ESCOLHER
   * =====================================================
   */

  if (!edicao) {
    const supabase =
      createAdminClient();

    const { data: editions } =
      await supabase
        .from("newspaper_editions")
        .select(`
          id,
          name,
          edition_number,
          publication_date,
          status
        `)
        .eq(
          "company_id",
          access.estafetaCompany.id
        )
        .eq("status", "open")
        .order("publication_date", {
          ascending: true,
        });

    return (
      <main className="min-h-screen bg-[#f5f7f6] p-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/edicoes/vendas"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para vendas
          </Link>

          <div className="mt-7 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
              <ShoppingCart className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Nova venda de publicidade
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Selecione em qual edição esta venda será publicada.
              </p>
            </div>
          </div>

          {(editions ?? []).length > 0 ? (
            <div className="mt-7 grid gap-3">
              {(editions ?? []).map(
                (edition) => (
                  <Link
                    key={edition.id}
                    href={`/edicoes/vendas/nova?edicao=${edition.id}`}
                    className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-[#15704f]/40 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-[#15704f]">
                        <Newspaper className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {edition.name}
                        </p>

                        <div className="mt-1 flex items-center gap-x-4 text-xs text-slate-400">
                          {edition.edition_number && (
                            <span>
                              Nº {edition.edition_number}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(
                              edition.publication_date
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#15704f]" />
                  </Link>
                )
              )}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Newspaper className="mx-auto h-7 w-7 text-slate-300" />

              <h2 className="mt-3 font-semibold text-slate-800">
                Nenhuma edição aberta
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Só é possível registrar vendas em uma edição aberta. Crie ou reabra uma edição primeiro.
              </p>

              <Link
                href="/edicoes/nova"
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
              >
                Nova edição
              </Link>
            </div>
          )}
        </div>
      </main>
    );
  }

  /*
   * =====================================================
   * COM EDIÇÃO → FORMULÁRIO
   * =====================================================
   */

  const result =
    await loadSaleFormData(edicao);

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "not-open") {
    return (
      <main className="min-h-screen bg-[#f5f7f6] p-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/edicoes/vendas/nova"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Escolher outra edição
          </Link>

          <div className="mt-7 rounded-2xl border border-amber-100 bg-white p-8">
            <h1 className="text-xl font-semibold text-slate-900">
              Edição não está aberta
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Novas vendas só podem ser registradas em{" "}
              <span className="font-medium text-slate-700">
                {result.editionName}
              </span>{" "}
              enquanto ela estiver aberta.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { data } = result;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/edicoes/vendas/nova"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Trocar de edição
        </Link>

        <div className="mt-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
            <ShoppingCart className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Nova venda
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {data.edition.name}

              {data.edition.edition_number
                ? ` • Edição nº ${data.edition.edition_number}`
                : ""}

              {data.edition.companyName
                ? ` • ${data.edition.companyName}`
                : ""}
            </p>
          </div>
        </div>

        <SaleForm
          editionId={data.edition.id}
          clients={data.clients}
          sellers={data.sellers}
          products={data.products}
          sections={data.sections}
          generalPositions={
            data.generalPositions
          }
          paymentMethods={
            data.paymentMethods
          }
          initialSellerId={
            data.initialSellerId
          }
          sellerLocked={data.sellerLocked}
        />
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
