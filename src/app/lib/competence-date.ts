/*
 * =====================================================
 * COMPETÊNCIA DE FATURAMENTO
 * =====================================================
 *
 * A regra muda pra O Estafeta (jornal) porque seus contratos
 * recorrentes são majoritariamente anúncios vinculados a
 * edições (contract_edition_publications): a parcela cobra o
 * MESMO mês em que o anúncio é publicado, não o mês seguinte.
 * Nas outras empresas (Atthus, Pottencializa), os serviços
 * recorrentes seguem faturamento em atraso — a parcela cobra
 * o mês ANTERIOR ao vencimento.
 *
 * - SERVIÇO RECORRENTE (contrato com billing_frequency
 *   diferente de "one_time"):
 *
 *   - O Estafeta: cada parcela conta no mês de início do
 *     contrato + o número de parcelas já decorridas até o
 *     vencimento dela (1ª parcela = mês de início). Um
 *     contrato de anúncio semanal iniciado em 01/09 com 1ª
 *     parcela vencendo em 10/09 conta como faturamento de
 *     setembro, batendo com o valor vinculado às edições que
 *     de fato saíram naquele mês.
 *
 *   - Atthus / Pottencializa: cada parcela conta no mês
 *     ANTERIOR ao vencimento (regra de faturamento em atraso).
 *     Um contrato de R$12.000 em 12x soma R$1.000 no mês
 *     anterior ao vencimento de cada parcela.
 *
 * - ITEM ÚNICO (contrato com billing_frequency "one_time",
 *   ou lançamento sem contrato vinculado — ex.: comissão):
 *
 *   - O Estafeta: foi vendido como uma coisa só, parcelado só
 *     pra facilitar o pagamento — TODO o valor conta de uma
 *     vez no mês da venda (financial_entries.competence_date,
 *     gravada na criação = início do contrato ou publicação
 *     da edição). Um anúncio de R$5.000 vendido em janeiro e
 *     pago em 4x conta R$5.000 em janeiro, não R$1.250
 *     espalhado por 4 meses.
 *
 *   - Atthus / Pottencializa: cada parcela conta no próprio
 *     mês do SEU vencimento — sem lump-sum e sem deslocamento.
 *     Uma identidade visual de R$4.000 vendida em janeiro e
 *     paga em 4x conta R$1.000 em cada um dos 4 meses em que
 *     as parcelas vencem.
 */

const ESTAFETA_COMPANY_SLUG =
  "o-estafeta";

function monthYearFromDate(
  date: string | null | undefined
): {
  year: number;
  month: number;
} | null {
  if (!date || date.length < 7) {
    return null;
  }

  const year = Number(
    date.slice(0, 4)
  );

  const month = Number(
    date.slice(5, 7)
  );

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return { year, month };
}

/*
 * Desloca o mês do vencimento pra trás em 1 (com rollover de
 * ano em janeiro) — competência de faturamento em atraso,
 * usada pras empresas que não são O Estafeta.
 */
function shiftMonthBack(
  dueDate: string | null
): {
  year: number;
  month: number;
} | null {
  const parsed =
    monthYearFromDate(dueDate);

  if (!parsed) {
    return null;
  }

  if (parsed.month === 1) {
    return {
      year: parsed.year - 1,
      month: 12,
    };
  }

  return {
    year: parsed.year,
    month: parsed.month - 1,
  };
}

/*
 * Número de meses inteiros decorridos entre o início do
 * contrato e o vencimento de uma parcela. Compara os dias
 * pra não contar um mês incompleto: um contrato iniciado em
 * 30/08 com parcela vencendo em 05/09 ainda está no mês 0
 * (o dia 5 é anterior ao "aniversário" do dia 30), só vira
 * mês 1 na parcela que vencer a partir de 30/09.
 */
function monthsElapsed(
  startDate: string,
  dueDate: string
): number {
  const start = new Date(
    `${startDate}T00:00:00Z`
  );

  const due = new Date(
    `${dueDate}T00:00:00Z`
  );

  let months =
    (due.getUTCFullYear() -
      start.getUTCFullYear()) *
      12 +
    (due.getUTCMonth() -
      start.getUTCMonth());

  if (
    due.getUTCDate() <
    start.getUTCDate()
  ) {
    months -= 1;
  }

  return Math.max(months, 0);
}

/*
 * Competência de uma parcela de serviço recorrente do O
 * Estafeta: mês de início do contrato + quantidade de meses
 * decorridos até o vencimento dessa parcela.
 */
function getServiceStartCompetenceMonth(
  startDate: string | null,
  dueDate: string | null
): {
  year: number;
  month: number;
} | null {
  const start =
    monthYearFromDate(startDate);

  if (!start || !dueDate) {
    return null;
  }

  const elapsed = monthsElapsed(
    startDate as string,
    dueDate
  );

  const totalMonths =
    start.year * 12 +
    (start.month - 1) +
    elapsed;

  return {
    year: Math.floor(
      totalMonths / 12
    ),
    month:
      (totalMonths % 12) + 1,
  };
}

/*
 * Competência de um lançamento financeiro, já decidindo entre
 * a regra de serviço recorrente e a de item único — e entre a
 * regra do O Estafeta e a das outras empresas.
 *
 * `companySlug` vem de `companies.slug` — só o O Estafeta
 * ("o-estafeta") usa a regra nova (competência = início do
 * serviço). Qualquer outro valor (ou ausência dele) cai na
 * regra de faturamento em atraso.
 */
export function getEntryCompetenceMonth(
  params: {
    dueDate: string | null;
    competenceDate?:
      | string
      | null;
    billingFrequency?:
      | string
      | null;
    contractStartDate?:
      | string
      | null;
    companySlug?:
      | string
      | null;
  }
): {
  year: number;
  month: number;
} | null {
  const isRecurring = Boolean(
    params.billingFrequency &&
      params.billingFrequency !==
        "one_time"
  );

  const isEstafeta =
    params.companySlug ===
    ESTAFETA_COMPANY_SLUG;

  if (isRecurring) {
    if (isEstafeta) {
      return (
        getServiceStartCompetenceMonth(
          params.contractStartDate ??
            null,
          params.dueDate
        ) ??
        monthYearFromDate(
          params.dueDate
        )
      );
    }

    return shiftMonthBack(
      params.dueDate
    );
  }

  if (isEstafeta) {
    return monthYearFromDate(
      params.competenceDate ??
        params.dueDate
    );
  }

  return monthYearFromDate(
    params.dueDate
  );
}

/*
 * Intervalo generoso de due_date usado só pra filtrar a
 * consulta no banco antes de agrupar por competência (que é
 * calculada em código, não no SQL). Cobre o ano-alvo com uma
 * folga de 12 meses pra cada lado — o suficiente pra pegar
 * tanto parcelas recorrentes quanto itens únicos parcelados
 * em vários meses após a venda.
 */
export function competenceQueryRangeForYear(
  year: number
) {
  return {
    start: `${year - 1}-01-01`,
    end: `${year + 1}-12-31`,
  };
}
