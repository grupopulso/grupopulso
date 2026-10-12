/*
 * O PostgREST (Supabase) devolve no máximo 1000 linhas por select e
 * NÃO avisa quando corta - com a lista ordenada por nome, somem os
 * últimos da ordem alfabética (clientes depois da letra "T").
 * Esta função busca em páginas até esgotar os resultados.
 *
 * Uso: a consulta precisa ter ordenação ESTÁVEL (inclua .order("id")
 * como desempate), senão linhas podem repetir/pular entre páginas.
 *
 *   const { data } = await fetchAllRows((from, to) =>
 *     db.from("clients").select("id, name")
 *       .order("name").order("id").range(from, to)
 *   );
 */

const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  buildPage: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<{
  data: T[];
  error: { message: string } | null;
}> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildPage(
      from,
      from + PAGE_SIZE - 1
    );

    if (error) {
      return { data: rows, error };
    }

    rows.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return { data: rows, error: null };
}
