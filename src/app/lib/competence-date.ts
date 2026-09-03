/*
 * "Mês de competência" de um lançamento financeiro = o mês
 * ANTERIOR ao vencimento (due_date). Ex.: parcela vence em
 * 10/10 -> competência é setembro. Isso é o que conta como
 * "faturamento" pra bater meta: o valor de uma parcela
 * mensal de um contrato não entra de uma vez no mês em que o
 * contrato foi fechado (issue_date) nem no mês em que a
 * parcela vence (due_date) — entra, mês a mês, um mês antes
 * de cada vencimento.
 */
export function getCompetenceMonth(
  dueDate: string | null
): {
  year: number;
  month: number;
} | null {
  if (
    !dueDate ||
    dueDate.length < 7
  ) {
    return null;
  }

  const year = Number(
    dueDate.slice(0, 4)
  );

  const month = Number(
    dueDate.slice(5, 7)
  );

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  if (month === 1) {
    return {
      year: year - 1,
      month: 12,
    };
  }

  return {
    year,
    month: month - 1,
  };
}

/*
 * Intervalo de due_date que cobre todos os lançamentos cuja
 * competência cai dentro do ano informado — usado pra
 * filtrar a consulta no banco antes de agrupar por
 * competência.
 */
export function competenceQueryRangeForYear(
  year: number
) {
  return {
    start: `${year}-02-01`,
    end: `${year + 1}-01-31`,
  };
}
