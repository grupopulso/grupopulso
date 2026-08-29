import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import ContractForm from "@/app/components/contract-form";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

import { getRenewalPrefill } from "../actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RenovarContratoPage({
  params,
}: PageProps) {
  const access =
    await requireModulePermission(
      "contracts",
      "create"
    );

  const { id } = await params;

  const result =
    await getRenewalPrefill(id);

  const allowedCompanyIds =
    access.profile.role === "admin"
      ? null
      : access.companyIds;

  if (!result.success) {
    return (
      <main className="min-h-screen bg-[#f5f7f6] p-8">
        <div className="mx-auto max-w-2xl">
          <Link
            href={`/contratos/${id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao contrato
          </Link>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h1 className="text-lg font-semibold text-amber-900">
              Não foi possível iniciar a renovação
            </h1>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              {result.error}
            </p>

            {result.alreadyRenewedId && (
              <Link
                href={`/contratos/${result.alreadyRenewedId}`}
                className="mt-4 inline-flex h-10 items-center rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                Ver contrato renovado
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <ContractForm
      allowedCompanyIds={allowedCompanyIds}
      renewal={result.prefill}
    />
  );
}
