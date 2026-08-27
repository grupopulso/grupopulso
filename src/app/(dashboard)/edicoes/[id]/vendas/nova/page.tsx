import Link from "next/link";

import {
  ArrowLeft,
  ShoppingCart,
} from "lucide-react";

import { notFound } from "next/navigation";

import { SaleForm } from "./sale-form";
import { loadSaleFormData } from "../../../vendas/load-sale-form-data";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function NewEditionSalePage({
  params,
}: PageProps) {
  const { id: editionId } =
    await params;

  const result =
    await loadSaleFormData(editionId);

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "not-open") {
    return (
      <main className="min-h-screen bg-[#f5f7f6] p-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/edicoes/${editionId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para edição
          </Link>

          <div className="mt-7 rounded-2xl border border-amber-100 bg-white p-8">
            <h1 className="text-xl font-semibold text-slate-900">
              Edição não está aberta
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Novas vendas só podem ser registradas em uma edição aberta.
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
          href={`/edicoes/${data.edition.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para edição
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
