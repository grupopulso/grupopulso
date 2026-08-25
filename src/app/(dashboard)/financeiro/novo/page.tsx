import FinancialEntryForm from "@/app/components/financial-entry-form";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

type NovoLancamentoPageProps = {
  searchParams: Promise<{
    clientId?: string;
  }>;
};

export default async function NovoLancamentoPage({
  searchParams,
}: NovoLancamentoPageProps) {
  await requireModulePermission(
    "financial",
    "create"
  );

  const params =
    await searchParams;

  const initialClientId =
    params.clientId ??
    "";

  return (
    <FinancialEntryForm
      initialClientId={
        initialClientId
      }
    />
  );
}