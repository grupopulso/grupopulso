/*
 * =====================================================
 * ORDENAÇÃO GEOGRÁFICA DE PARADAS DE ROTA
 * =====================================================
 *
 * Sem geocodificação, o melhor palpite automático é:
 * manter juntas as paradas de uma mesma rua e ordená-las
 * pelo número, respeitando a direção (crescente/decrescente)
 * que a rota já segue naquela rua. Rua nova entra no fim.
 *
 * Ex.: rota tem "Av Pres. Vargas, 520" e "Av Pres. Vargas, 530".
 * Ao adicionar "Av Pres. Vargas, 525", ele é encaixado entre
 * os dois — e não no fim da fila.
 */

const STREET_PREFIXES: [RegExp, string][] = [
  [/\b(avenida|aven|ave|av)\b\.?/g, "av"],
  [/\b(rua|r)\b\.?/g, "rua"],
  [/\b(travessa|trav|tv)\b\.?/g, "tv"],
  [/\b(rodovia|rod|br)\b\.?/g, "rod"],
  [/\b(estrada|estr|est)\b\.?/g, "estr"],
  [/\b(alameda|al)\b\.?/g, "al"],
  [/\b(praca|pca)\b\.?/g, "praca"],
  [/\b(servidao|serv)\b\.?/g, "serv"],
  [/\b(linha|lnh)\b\.?/g, "linha"],
];

export function normalizeStreet(
  value: string | null | undefined
): string {
  let text = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of STREET_PREFIXES) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\s+/g, " ").trim();
}

export function parseStreetNumber(
  value: string | null | undefined
): number | null {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

export type RouteStopLike = {
  street: string | null;
  number: string | null;
};

/*
 * Índice (na lista, que está na ordem atual da rota) onde a
 * nova parada deve ser inserida via Array.splice.
 */
export function findRouteInsertIndex(
  stops: RouteStopLike[],
  newStreet: string | null,
  newNumber: string | null
): number {
  if (stops.length === 0) {
    return 0;
  }

  const key = normalizeStreet(newStreet);
  const newNum = parseStreetNumber(newNumber);

  if (!key || newNum === null) {
    return stops.length;
  }

  const sameStreet = stops
    .map((stop, index) => ({ stop, index }))
    .filter(
      (item) =>
        normalizeStreet(item.stop.street) === key
    );

  if (sameStreet.length === 0) {
    return stops.length;
  }

  const firstNum = parseStreetNumber(
    sameStreet[0].stop.number
  );
  const lastNum = parseStreetNumber(
    sameStreet[sameStreet.length - 1].stop.number
  );

  const ascending =
    firstNum === null || lastNum === null
      ? true
      : lastNum >= firstNum;

  for (const { stop, index } of sameStreet) {
    const num = parseStreetNumber(stop.number);
    if (num === null) continue;

    const goesBefore = ascending
      ? newNum < num
      : newNum > num;

    if (goesBefore) {
      return index;
    }
  }

  return (
    sameStreet[sameStreet.length - 1].index + 1
  );
}

export function compareByStreetThenNumber(
  a: RouteStopLike,
  b: RouteStopLike
): number {
  const streetA = normalizeStreet(a.street);
  const streetB = normalizeStreet(b.street);

  if (streetA !== streetB) {
    return streetA.localeCompare(
      streetB,
      "pt-BR"
    );
  }

  const numA =
    parseStreetNumber(a.number) ??
    Number.MAX_SAFE_INTEGER;
  const numB =
    parseStreetNumber(b.number) ??
    Number.MAX_SAFE_INTEGER;

  return numA - numB;
}
