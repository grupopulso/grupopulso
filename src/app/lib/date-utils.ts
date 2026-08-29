/*
 * =====================================================
 * UTILITÁRIOS DE DATA (string "YYYY-MM-DD")
 * =====================================================
 *
 * Funções puras compartilhadas por diferentes pontos
 * do sistema que geram datas de vencimento a partir
 * de uma data-base (criação de contrato, renovação,
 * etc). Ficam fora de qualquer arquivo "use server"
 * porque não são Server Actions — são só utilitários.
 */

export function addMonthsClamped(
  date: string,
  months: number
) {
  const [
    year,
    month,
    day,
  ] = date
    .split("-")
    .map(Number);

  const target = new Date(
    Date.UTC(
      year,
      month - 1 + months,
      1
    )
  );

  const targetYear =
    target.getUTCFullYear();

  const targetMonth =
    target.getUTCMonth();

  const lastDay = new Date(
    Date.UTC(
      targetYear,
      targetMonth + 1,
      0
    )
  ).getUTCDate();

  const targetDay = Math.min(
    day,
    lastDay
  );

  return [
    String(targetYear),
    String(targetMonth + 1).padStart(2, "0"),
    String(targetDay).padStart(2, "0"),
  ].join("-");
}

export function addDays(
  date: string,
  days: number
) {
  const base = new Date(
    `${date}T00:00:00Z`
  );

  if (
    Number.isNaN(base.getTime())
  ) {
    return "";
  }

  base.setUTCDate(
    base.getUTCDate() + days
  );

  return base
    .toISOString()
    .slice(0, 10);
}

/*
 * Gera as datas de vencimento das parcelas a partir do
 * primeiro vencimento e de um intervalo fixo em dias
 * (padrão 30). A parcela 1 fica exatamente no primeiro
 * vencimento; as demais somam `intervalDays` a cada passo.
 */
export function buildDueDates(
  firstDueDate: string,
  count: number,
  intervalDays: number
): string[] {
  const safeInterval =
    Number.isFinite(intervalDays) &&
    intervalDays >= 1
      ? Math.floor(intervalDays)
      : 30;

  const safeCount =
    Number.isInteger(count) && count > 0
      ? count
      : 0;

  if (!isValidDateOnly(firstDueDate)) {
    return Array.from(
      { length: safeCount },
      () => ""
    );
  }

  return Array.from(
    { length: safeCount },
    (_, index) =>
      index === 0
        ? firstDueDate
        : addDays(
            firstDueDate,
            safeInterval * index
          )
  );
}

/*
 * Distribui um valor total em N parcelas em centavos,
 * jogando os centavos que sobram nas primeiras parcelas.
 */
export function distributeAmount(
  total: number,
  count: number
): number[] {
  if (
    !Number.isInteger(count) ||
    count <= 0
  ) {
    return [];
  }

  const totalCents = Math.round(
    Number(total) * 100
  );

  const base = Math.floor(
    totalCents / count
  );

  const remainder =
    totalCents - base * count;

  return Array.from(
    { length: count },
    (_, index) =>
      (base +
        (index < remainder ? 1 : 0)) /
      100
  );
}

/*
 * Valida uma string de data no formato "YYYY-MM-DD".
 */
export function isValidDateOnly(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(
      new Date(
        `${value}T00:00:00Z`
      ).getTime()
    )
  );
}

export function diffInDays(
  startDate: string,
  endDate: string
) {
  const start = new Date(
    `${startDate}T00:00:00Z`
  );

  const end = new Date(
    `${endDate}T00:00:00Z`
  );

  return Math.round(
    (end.getTime() -
      start.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}
