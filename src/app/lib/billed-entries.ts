import type { createClient } from "@/app/lib/supabase/server";

import {
  competenceQueryRangeForYear,
  getEntryCompetenceMonth,
} from "@/app/lib/competence-date";

type Db = Awaited<
  ReturnType<typeof createClient>
>;

export type BilledEntry = {
  id: string;
  companyId: string;
  description: string;
  dueDate: string;
  amount: number;
  clientName: string | null;
  contractId: string | null;
  contractTitle: string | null;
  billingFrequency: string | null;
  competence: {
    year: number;
    month: number;
  };
};

/*
 * Lançamentos de receita que compõem o "Faturado" de uma empresa
 * num período (metas). Conta por COMPETÊNCIA, não por vencimento -
 * regra em @/app/lib/competence-date (difere entre O Estafeta e as
 * demais empresas). É a fonte única: o card de /metas soma estes
 * mesmos lançamentos e o detalhamento da empresa lista cada um,
 * então os dois sempre batem.
 */
export async function loadBilledEntries(
  supabase: Db,
  input: {
    companyIds: string[];
    companySlugById: Map<string, string>;
    year: number;
    month: number;
    isAnnual: boolean;
  }
): Promise<BilledEntry[]> {
  if (input.companyIds.length === 0) {
    return [];
  }

  const dueRange =
    competenceQueryRangeForYear(
      input.year
    );

  const { data: entries, error } =
    await supabase
      .from("financial_entries")
      .select(`
        id,
        company_id,
        description,
        due_date,
        competence_date,
        amount,
        status,
        contract_id,

        client:clients (
          name
        ),

        contract:contracts (
          title,
          billing_frequency,
          start_date
        )
      `)
      .eq("type", "income")
      .neq("status", "cancelled")
      .gte("due_date", dueRange.start)
      .lte("due_date", dueRange.end)
      .in("company_id", input.companyIds);

  if (error) {
    console.error(
      "Erro ao carregar faturamento:",
      error
    );

    return [];
  }

  const result: BilledEntry[] = [];

  for (const entry of entries ?? []) {
    const contract = getFirst(
      entry.contract
    );

    const client = getFirst(
      entry.client
    );

    const competence =
      getEntryCompetenceMonth({
        dueDate: entry.due_date,
        competenceDate:
          entry.competence_date,
        billingFrequency:
          contract?.billing_frequency ??
          null,
        contractStartDate:
          contract?.start_date ?? null,
        companySlug:
          input.companySlugById.get(
            entry.company_id
          ) ?? null,
      });

    if (!competence) {
      continue;
    }

    const inPeriod = input.isAnnual
      ? competence.year === input.year
      : competence.year === input.year &&
        competence.month === input.month;

    if (!inPeriod) {
      continue;
    }

    result.push({
      id: entry.id,
      companyId: entry.company_id,
      description: entry.description,
      dueDate: entry.due_date,
      amount: Number(entry.amount ?? 0),
      clientName: client?.name ?? null,
      contractId: entry.contract_id,
      contractTitle:
        contract?.title ?? null,
      billingFrequency:
        contract?.billing_frequency ??
        null,
      competence,
    });
  }

  return result;
}

function getFirst<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? (value[0] ?? null)
    : value;
}
