import FinancialEntryForm from "@/app/components/financial-entry-form";

import {
  requireFinancialCreateAccess,
} from "@/app/lib/permissions";

type NovoLancamentoPageProps = {
  searchParams: Promise<{
    clientId?: string;
    tipo?: string;
  }>;
};

export default async function NovoLancamentoPage({
  searchParams,
}: NovoLancamentoPageProps) {
  const { canIncome, canExpense } =
    await requireFinancialCreateAccess();

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
      canIncome={canIncome}
      canExpense={canExpense}
    />
  );
}
