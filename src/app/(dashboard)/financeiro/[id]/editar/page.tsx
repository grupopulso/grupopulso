import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { getExpenseEditData } from "../edit-actions";

import EditExpenseForm from "./edit-expense-form";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarDespesaPage({
  params,
}: PageProps) {
  const { id } = await params;

  const data =
    await getExpenseEditData(id);

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/financeiro/${id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao lançamento
        </Link>

        <h1 className="mt-5 text-2xl font-semibold text-slate-900">
          Editar despesa
        </h1>

        {!data.success ? (
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            {data.error}
          </p>
        ) : data.lockedReason ? (
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            {data.lockedReason}
          </p>
        ) : (
          <EditExpenseForm
            entryId={id}
            entry={data.entry}
            suppliers={data.suppliers}
            categories={data.categories}
            costCenters={data.costCenters}
            financialAccounts={
              data.financialAccounts
            }
            paymentMethods={
              data.paymentMethods
            }
          />
        )}
      </div>
    </main>
  );
}
