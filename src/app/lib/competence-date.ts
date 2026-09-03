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
 *   mês de serviço prestado. A competência dela é sempre o
 *   mês ANTERIOR ao vencimento — parcela vencendo em 10/10
 *   conta como faturamento de setembro. Um contrato de
 *   R$12.000 em 12x soma R$1.000 em cada um dos 12 meses.
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
 * Desloca o mês do vencimento pra trás em 1 (com rollover de
 * ano em janeiro) — a competência de uma parcela de serviço
 * recorrente.
 */
export function getCompetenceMonth(
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
 * Competência de um lançamento financeiro, já decidindo
 * entre a regra de serviço recorrente e a de item único.
 *
 * `billingFrequency` vem do contrato vinculado ao lançamento
 * (financial_entries.contract_id) — decide qual das duas
 * regras aplicar.
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
 *
 * Pra serviço recorrente, IGNORA a competence_date gravada
 * (ela é fixa = início do contrato pra toda parcela, não
 * serve pra isso) e desloca o vencimento pra trás em 1 mês.
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
    return getCompetenceMonth(
      params.dueDate
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
 * tanto parcelas recorrentes (competência = due_date - 1 mês)
 * quanto itens únicos parcelados em vários meses após a venda.
 */
export function competenceQueryRangeForYear(
  year: number
) {
  return {
    start: `${year - 1}-01-01`,
    end: `${year + 1}-12-31`,
  };
}
