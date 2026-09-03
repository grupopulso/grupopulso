/*
 * =====================================================
 * COMPETÊNCIA DE FATURAMENTO
 * =====================================================
 *
 * Regra do negócio (O Estafeta / Grupo Pulso):
 *
 * - SERVIÇO RECORRENTE (contrato com billing_frequency
 *   diferente de "one_time" — mensal, trimestral, semestral,
 *   anual, personalizado): cada parcela é a cobrança de UM
 *   mês de serviço prestado. A competência dela é o mês de
 *   início do contrato deslocado pelo número de parcelas já
 *   decorridas até o vencimento dessa parcela (1ª parcela =
 *   mês de início, 2ª = mês seguinte, e assim por diante).
 *   Um contrato de R$12.000 em 12x soma R$1.000 em cada um
 *   dos 12 meses a partir do início do contrato.
 *
 *   Isso substitui a regra antiga de "sempre o mês anterior
 *   ao vencimento": na prática os contratos de anúncio (ex.:
 *   anúncio semanal com início em 01/09 e 1ª parcela vencendo
 *   em 10/09) cobram no mesmo mês em que o serviço é prestado,
 *   não um mês depois — usar due_date - 1 mês jogava parcelas
 *   pra ANTES do contrato existir e destoava muito do valor
 *   vinculado às edições (contract_edition_publications).
 *
 * - ITEM ÚNICO (contrato com billing_frequency "one_time",
 *   ou lançamento sem contrato vinculado — ex.: comissão):
 *   foi vendido como uma coisa só, parcelado só pra facilitar
 *   o pagamento. TODO o valor conta no mês da venda (a data
 *   de início do contrato), não importa em quantas vezes foi
 *   parcelado nem quando cada parcela vence. Um anúncio de
 *   R$5.000 vendido em janeiro e pago em 4x conta R$5.000 de
 *   faturamento em janeiro, não R$1.250 espalhado por 4 meses.
 */

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
 * Competência de uma parcela de serviço recorrente: mês de
 * início do contrato + quantidade de meses decorridos até o
 * vencimento dessa parcela.
 */
export function getRecurringCompetenceMonth(
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
 * Competência de um lançamento financeiro, já decidindo
 * entre a regra de serviço recorrente e a de item único.
 *
 * `billingFrequency` e `contractStartDate` vêm do contrato
 * vinculado ao lançamento (financial_entries.contract_id) —
 * decidem qual regra aplicar e, pra recorrente, a partir de
 * quando contar os meses.
 *
 * Pra item único, a competência é a própria coluna
 * `financial_entries.competence_date` — ela já é gravada
 * corretamente na criação pra cobrir os dois casos:
 *   - parcela de contrato: competence_date = data de início
 *     do contrato (mesma pra todas as parcelas);
 *   - venda avulsa de publicidade numa edição: competence_date
 *     = data de publicação da edição.
 * Só cai pro due_date se por algum motivo competence_date
 * estiver vazio.
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

  if (isRecurring) {
    return (
      getRecurringCompetenceMonth(
        params.contractStartDate ??
          null,
        params.dueDate
      ) ??
      monthYearFromDate(
        params.dueDate
      )
    );
  }

  return monthYearFromDate(
    params.competenceDate ??
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
