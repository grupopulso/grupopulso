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

  base.setUTCDate(
    base.getUTCDate() + days
  );

  return base
    .toISOString()
    .slice(0, 10);
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
