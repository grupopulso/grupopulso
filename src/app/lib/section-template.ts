import type { createClient } from "@/app/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

export type SectionTemplate = {
  sourceSectionId: string;
  description: string | null;
  salesGoal: number;
  positions: {
    id: string;
    position_code: string;
    name: string;
    capacity: number | null;
    active: boolean;
  }[];
};

/*
 * Ao adicionar um caderno numa edição, aproveita a configuração do
 * caderno de mesmo nome na edição mais recente da empresa (descrição,
 * meta e posições com suas capacidades), em vez de recomeçar do zero
 * com as posições padrão. O bloqueio manual de posição NÃO é herdado:
 * ele vale só pra edição em que foi feito.
 *
 * Retorna null se não existir caderno anterior com esse nome.
 */
export async function loadSectionTemplate(
  supabase: Db,
  input: {
    companyId: string;
    name: string;
    excludeEditionId: string;
  }
): Promise<SectionTemplate | null> {
  const wanted = input.name
    .trim()
    .toLocaleLowerCase("pt-BR");

  if (!wanted) {
    return null;
  }

  const escaped = input.name
    .trim()
    .replace(/[\\%_]/g, (char) => `\\${char}`);

  const { data: candidates, error } =
    await supabase
      .from("edition_sections")
      .select(`
        id,
        name,
        description,
        sales_goal,
        edition:newspaper_editions!inner (
          id,
          company_id,
          publication_date
        )
      `)
      .ilike("name", escaped)
      .eq("edition.company_id", input.companyId)
      .neq("edition_id", input.excludeEditionId)
      .limit(50);

  if (error) {
    console.error(
      "Erro ao buscar caderno anterior:",
      error
    );

    return null;
  }

  const pick = (candidates ?? [])
    .map((row) => {
      const edition = Array.isArray(row.edition)
        ? row.edition[0]
        : row.edition;

      return {
        row,
        publicationDate:
          edition?.publication_date ?? "",
      };
    })
    .filter(
      ({ row }) =>
        row.name
          .trim()
          .toLocaleLowerCase("pt-BR") ===
        wanted
    )
    .sort((a, b) =>
      b.publicationDate.localeCompare(
        a.publicationDate
      )
    )[0];

  if (!pick) {
    return null;
  }

  const { data: positions, error: positionsError } =
    await supabase
      .from("edition_ad_positions")
      .select(
        "id, position_code, name, capacity, active"
      )
      .eq("section_id", pick.row.id);

  if (positionsError || !positions?.length) {
    return null;
  }

  return {
    sourceSectionId: pick.row.id,
    description: pick.row.description ?? null,
    salesGoal: Number(pick.row.sales_goal ?? 0),
    positions: positions.map((position) => ({
      id: position.id,
      position_code: position.position_code,
      name: position.name,
      capacity:
        position.capacity === null
          ? null
          : Number(position.capacity),
      active: Boolean(position.active),
    })),
  };
}
