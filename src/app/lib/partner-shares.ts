/*
 * Cálculo da divisão de lucro entre sócios (Agência Atthus e
 * Pottencializa): 25% para o caixa da empresa, 75% dividido entre
 * os sócios conforme o percentual de cada um, descontados os
 * adiantamentos que cada sócio já tirou no mês.
 *
 * Segue o mesmo princípio já usado em contract-status.ts e
 * financial-entry-status.ts: calcular na hora a partir dos dados
 * reais, sem guardar um valor consolidado que possa ficar
 * desatualizado.
 */

export type MonthRange = {
  key: string;
  label: string;
  start: string;
  end: string;
  previousKey: string;
  nextKey: string;
};

export function getMonthRange(
  monthParam?: string | null
): MonthRange {
  const now = new Date();

  const match =
    /^(\d{4})-(\d{2})$/.exec(
      monthParam ?? ""
    );

  const year = match
    ? Number(match[1])
    : now.getFullYear();

  const monthIndex = match
    ? Number(match[2]) - 1
    : now.getMonth();

  const start = new Date(
    Date.UTC(year, monthIndex, 1)
  );

  const end = new Date(
    Date.UTC(year, monthIndex + 1, 0)
  );

  const previous = new Date(
    Date.UTC(year, monthIndex - 1, 1)
  );

  const next = new Date(
    Date.UTC(year, monthIndex + 1, 1)
  );

  const format = (date: Date) =>
    date.toISOString().slice(0, 10);

  const toKey = (date: Date) =>
    format(date).slice(0, 7);

  const label = new Intl.DateTimeFormat(
    "pt-BR",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(start);

  return {
    key: toKey(start),
    label,
    start: format(start),
    end: format(end),
    previousKey: toKey(previous),
    nextKey: toKey(next),
  };
}

export function calculateProfitSplit(
  received: number,
  paid: number
) {
  const profit = received - paid;

  const reserve = profit * 0.25;

  const partnersPool = profit * 0.75;

  return {
    profit,
    reserve,
    partnersPool,
  };
}

export function calculatePartnerBalance(
  partnersPool: number,
  percentage: number,
  withdrawalsTotal: number
) {
  const gross =
    partnersPool * (percentage / 100);

  const balance =
    gross - withdrawalsTotal;

  return {
    gross,
    balance,
  };
}
