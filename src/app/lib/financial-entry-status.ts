export type FinancialEntryStatus =
  | "pending"
  | "overdue"
  | "partial"
  | "paid"
  | "cancelled";

type FinancialEntryAmounts = {
  amount: number | string;
  amount_paid: number | string;
  interest: number | string;
  fine: number | string;
  discount: number | string;
};

type FinancialEntryStatusInput = FinancialEntryAmounts & {
  status: string;
  due_date: string;
};

/*
 * Centraliza a lógica que já existia duplicada (idêntica) em
 * `financeiro/receber/page.tsx` e `financeiro/pagar/page.tsx`.
 * Nenhuma regra foi alterada aqui — só movida pra um lugar só.
 */

export function calculateEntryTotal(
  entry: FinancialEntryAmounts
) {
  return (
    Number(entry.amount) +
    Number(entry.interest) +
    Number(entry.fine) -
    Number(entry.discount)
  );
}

export function calculateEntryOpenAmount(
  entry: FinancialEntryAmounts
) {
  return Math.max(
    calculateEntryTotal(entry) -
      Number(entry.amount_paid),
    0
  );
}

export function getFinancialEntryStatus(
  entry: FinancialEntryStatusInput
): FinancialEntryStatus {
  if (entry.status === "cancelled") {
    return "cancelled";
  }

  const total = calculateEntryTotal(entry);
  const paid = Number(entry.amount_paid);

  if (paid >= total && total > 0) {
    return "paid";
  }

  if (paid > 0) {
    return "partial";
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  if (entry.due_date < today) {
    return "overdue";
  }

  return "pending";
}

export const FINANCIAL_ENTRY_STATUS_LABELS: Record<
  FinancialEntryStatus,
  string
> = {
  pending: "A vencer",
  overdue: "Vencido",
  partial: "Parcial",
  paid: "Pago",
  cancelled: "Cancelado",
};

export const FINANCIAL_ENTRY_STATUS_STYLES: Record<
  FinancialEntryStatus,
  string
> = {
  pending: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
  partial: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
};
