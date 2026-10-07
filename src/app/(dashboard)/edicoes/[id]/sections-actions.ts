"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  createAdminClient,
} from "@/app/lib/supabase/admin";

import {
  createAuditLog,
} from "@/app/lib/audit";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import {
  loadSectionTemplate,
} from "@/app/lib/section-template";

import {
  addContractPublicationToEdition,
} from "./actions";

/*
 * =====================================================
 * TIPOS
 * =====================================================
 */

type CreateSectionInput = {
  editionId: string;
  name: string;
  description?: string;
  salesGoal?: number;

  /*
   * Traz também as publicações do caderno de mesmo nome da
   * edição anterior (só de contratos ainda vigentes).
   */
  copyPublications?: boolean;
};

type UpdateSectionInput = {
  id: string;
  editionId: string;
  name: string;
  description?: string;
  salesGoal?: number;
};

/*
 * =====================================================
 * POSIÇÕES PADRÃO
 * =====================================================
 */

const DEFAULT_AD_POSITIONS = [
  {
    code: "cover",
    name: "Capa",
    capacity: null,
  },
  {
    code: "back_cover",
    name: "Contracapa",
    capacity: null,
  },
  {
    code: "inside_bw",
    name: "Interno preto e branco",
    capacity: null,
  },
  {
    code: "inside_color",
    name: "Interno colorido",
    capacity: null,
  },
  {
    code: "overcover",
    name: "Sobrecapa",
    capacity: null,
  },
  {
    /*
     * Espaço dos colunistas — funciona como uma
     * "capa" reservada, mas comporta vários nomes.
     */
    code: "columnist",
    name: "Coluna",
    capacity: null,
  },
] as const;

/*
 * =====================================================
 * CRIAR CADERNO
 * =====================================================
 */

export async function createEditionSection(
  input: CreateSectionInput
) {
  const access =
    await requireEstafetaAccess();

  const name =
    input.name.trim();

  const description =
    input.description
      ?.trim() ||
    null;

  const salesGoal =
    roundMoney(
      Number(
        input.salesGoal ??
          0
      )
    );

  if (
    !input.editionId
  ) {
    return {
      success: false,
      message:
        "Edição inválida.",
    };
  }

  if (
    !name
  ) {
    return {
      success: false,
      message:
        "Informe o nome do caderno.",
    };
  }

  if (
    !Number.isFinite(
      salesGoal
    ) ||
    salesGoal < 0
  ) {
    return {
      success: false,
      message:
        "Informe uma meta válida para o caderno.",
    };
  }

  const supabase =
    await createClient();

  /*
   * =====================================================
   * CONFIRMAR EDIÇÃO
   * =====================================================
   */

  const {
    data: edition,
    error:
      editionError,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .select(`
        id,
        company_id,
        status,
        publication_date
      `)
      .eq(
        "id",
        input.editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (
    editionError ||
    !edition
  ) {
    return {
      success: false,
      message:
        "Edição não encontrada.",
    };
  }

  if (
    edition.status !==
    "open"
  ) {
    return {
      success: false,
      message:
        "Só é possível adicionar cadernos em uma edição aberta.",
    };
  }

  /*
   * =====================================================
   * EVITAR NOME DUPLICADO
   * =====================================================
   */

  const {
    data: existing,
    error:
      existingError,
  } =
    await supabase
      .from(
        "edition_sections"
      )
      .select(`
        id
      `)
      .eq(
        "edition_id",
        input.editionId
      )
      .ilike(
        "name",
        name
      )
      .maybeSingle();

  if (
    existingError
  ) {
    console.error(
      "Erro ao verificar caderno:",
      existingError
    );

    return {
      success: false,
      message:
        "Não foi possível verificar o caderno.",
    };
  }

  if (
    existing
  ) {
    return {
      success: false,
      message:
        "Já existe um caderno com este nome nesta edição.",
    };
  }

  /*
   * =====================================================
   * APROVEITAR O CADERNO DE EDIÇÕES ANTERIORES
   * =====================================================
   *
   * Caderno de mesmo nome na edição mais recente: mantém
   * descrição, meta (quando não informadas) e as posições
   * com suas capacidades.
   */

  const template =
    await loadSectionTemplate(
      supabase,
      {
        companyId:
          edition.company_id,

        name,

        excludeEditionId:
          input.editionId,
      }
    );

  const finalDescription =
    description ??
    template?.description ??
    null;

  const finalSalesGoal =
    salesGoal > 0
      ? salesGoal
      : template?.salesGoal ??
        0;

  /*
   * =====================================================
   * CRIAR CADERNO
   * =====================================================
   */

  const {
    data: section,
    error:
      sectionError,
  } =
    await supabase
      .from(
        "edition_sections"
      )
      .insert({
        edition_id:
          input.editionId,

        name,

        description:
          finalDescription,

        sales_goal:
          finalSalesGoal,

        active:
          true,
      })
      .select(`
        id
      `)
      .single();

  if (
    sectionError ||
    !section
  ) {
    console.error(
      "Erro ao criar caderno:",
      sectionError
    );

    return {
      success: false,
      message:
        sectionError
          ?.message ??
        "Não foi possível criar o caderno.",
    };
  }

  /*
   * =====================================================
   * CRIAR POSIÇÕES PADRÃO
   * =====================================================
   */

  const positionRows =
    template
      ? template.positions.map(
          (
            position
          ) => ({
            edition_id:
              input.editionId,

            section_id:
              section.id,

            position_code:
              position.position_code,

            name:
              position.name,

            capacity:
              position.capacity,

            manually_blocked:
              false,

            blocked_reason:
              null,

            active:
              position.active,
          })
        )
      : DEFAULT_AD_POSITIONS.map(
          (
            position
          ) => ({
            edition_id:
              input.editionId,

            section_id:
              section.id,

            position_code:
              position.code,

            name:
              position.name,

            capacity:
              position.capacity,

            manually_blocked:
              false,

            blocked_reason:
              null,

            active:
              true,
          })
        );

  const {
    error:
      positionsError,
  } =
    await supabase
      .from(
        "edition_ad_positions"
      )
      .insert(
        positionRows
      );

  if (
    positionsError
  ) {
    console.error(
      "Erro ao criar posições do caderno:",
      positionsError
    );

    /*
     * Remove o caderno se não
     * conseguirmos terminar sua
     * configuração.
     */

    const {
      error:
        rollbackError,
    } =
      await supabase
        .from(
          "edition_sections"
        )
        .delete()
        .eq(
          "id",
          section.id
        )
        .eq(
          "edition_id",
          input.editionId
        );

    if (
      rollbackError
    ) {
      console.error(
        "Erro no rollback do caderno:",
        rollbackError
      );
    }

    return {
      success: false,
      message:
        "Não foi possível configurar as posições comerciais do caderno.",
    };
  }

  /*
   * =====================================================
   * TRAZER AS PUBLICAÇÕES DA EDIÇÃO ANTERIOR (opcional)
   * =====================================================
   *
   * Passa por addContractPublicationToEdition, que já valida
   * contrato ativo, posição, bloqueio e capacidade. Contrato
   * cuja vigência terminou antes desta edição não é trazido.
   */

  let publicationsCopied = 0;
  let publicationsSkipped = 0;

  if (
    input.copyPublications &&
    template
  ) {
    const {
      data: sourcePublications,
    } =
      await supabase
        .from(
          "contract_edition_publications"
        )
        .select(`
          contract_id,
          ad_position_id,
          size_description,
          amount,
          notes,
          contract:contracts (
            end_date
          )
        `)
        .eq(
          "section_id",
          template.sourceSectionId
        )
        .eq(
          "active",
          true
        );

    const sourceCodeById =
      new Map(
        template.positions.map(
          (position) => [
            position.id,
            position.position_code,
          ]
        )
      );

    const {
      data: targetPositions,
    } =
      await supabase
        .from(
          "edition_ad_positions"
        )
        .select(
          "id, position_code"
        )
        .eq(
          "section_id",
          section.id
        );

    const targetIdByCode =
      new Map(
        (targetPositions ?? []).map(
          (position) => [
            position.position_code,
            position.id,
          ]
        )
      );

    for (
      const publication of
        sourcePublications ?? []
    ) {
      const contract =
        Array.isArray(
          publication.contract
        )
          ? publication.contract[0]
          : publication.contract;

      if (
        contract?.end_date &&
        edition.publication_date &&
        contract.end_date <
          edition.publication_date
      ) {
        publicationsSkipped++;

        continue;
      }

      const sourceCode =
        publication.ad_position_id
          ? sourceCodeById.get(
              publication.ad_position_id
            )
          : null;

      const result =
        await addContractPublicationToEdition({
          editionId:
            input.editionId,

          contractId:
            publication.contract_id,

          sectionId:
            section.id,

          adPositionId:
            sourceCode
              ? targetIdByCode.get(
                  sourceCode
                ) ?? null
              : null,

          sizeDescription:
            publication.size_description,

          amount: Number(
            publication.amount ??
              0
          ),

          notes:
            publication.notes,
        });

      if (
        result.success
      ) {
        publicationsCopied++;
      } else {
        publicationsSkipped++;
      }
    }
  }

  revalidateEdition(
    input.editionId
  );

  return {
    success: true,
    id:
      section.id,
    publicationsCopied,
    publicationsSkipped,
  };
}

/*
 * =====================================================
 * EDITAR CADERNO
 * =====================================================
 */

export async function updateEditionSection(
  input: UpdateSectionInput
) {
  const access =
    await requireEstafetaAccess();

  const name =
    input.name.trim();

  const salesGoal =
    input.salesGoal ===
    undefined
      ? undefined
      : roundMoney(
          Number(
            input.salesGoal
          )
        );

  if (
    !input.id ||
    !input.editionId
  ) {
    return {
      success: false,
      message:
        "Caderno inválido.",
    };
  }

  if (
    !name
  ) {
    return {
      success: false,
      message:
        "Informe o nome do caderno.",
    };
  }

  if (
    salesGoal !==
      undefined &&
    (
      !Number.isFinite(
        salesGoal
      ) ||
      salesGoal < 0
    )
  ) {
    return {
      success: false,
      message:
        "Informe uma meta válida para o caderno.",
    };
  }

  const supabase =
    await createClient();

  /*
   * =====================================================
   * CONFIRMAR EDIÇÃO
   * =====================================================
   */

  const {
    data: edition,
    error:
      editionError,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .select(`
        id,
        status
      `)
      .eq(
        "id",
        input.editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (
    editionError ||
    !edition
  ) {
    return {
      success: false,
      message:
        "Edição não encontrada.",
    };
  }

  if (
    edition.status !==
    "open"
  ) {
    return {
      success: false,
      message:
        "Esta edição não pode mais ser alterada.",
    };
  }

  /*
   * =====================================================
   * CONFIRMAR CADERNO
   * =====================================================
   */

  const {
    data:
      currentSection,
    error:
      currentSectionError,
  } =
    await supabase
      .from(
        "edition_sections"
      )
      .select(`
        id,
        sales_goal
      `)
      .eq(
        "id",
        input.id
      )
      .eq(
        "edition_id",
        input.editionId
      )
      .maybeSingle();

  if (
    currentSectionError ||
    !currentSection
  ) {
    return {
      success: false,
      message:
        "Caderno não encontrado.",
    };
  }

  /*
   * =====================================================
   * EVITAR NOME DUPLICADO
   * =====================================================
   */

  const {
    data:
      duplicateSection,
    error:
      duplicateError,
  } =
    await supabase
      .from(
        "edition_sections"
      )
      .select(`
        id
      `)
      .eq(
        "edition_id",
        input.editionId
      )
      .ilike(
        "name",
        name
      )
      .neq(
        "id",
        input.id
      )
      .maybeSingle();

  if (
    duplicateError
  ) {
    console.error(
      "Erro ao verificar nome do caderno:",
      duplicateError
    );

    return {
      success: false,
      message:
        "Não foi possível verificar o nome do caderno.",
    };
  }

  if (
    duplicateSection
  ) {
    return {
      success: false,
      message:
        "Já existe outro caderno com este nome nesta edição.",
    };
  }

  /*
   * =====================================================
   * ATUALIZAR
   * =====================================================
   */

  const {
    error,
  } =
    await supabase
      .from(
        "edition_sections"
      )
      .update({
        name,

        description:
          input.description
            ?.trim() ||
          null,

        sales_goal:
          salesGoal ??
          Number(
            currentSection.sales_goal ??
              0
          ),
      })
      .eq(
        "id",
        input.id
      )
      .eq(
        "edition_id",
        input.editionId
      );

  if (
    error
  ) {
    console.error(
      "Erro ao editar caderno:",
      error
    );

    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidateEdition(
    input.editionId
  );

  return {
    success: true,
  };
}

/*
 * =====================================================
 * ATIVAR / DESATIVAR CADERNO
 * =====================================================
 */

export async function setEditionSectionActive(
  sectionId: string,
  editionId: string,
  active: boolean
) {
  const access =
    await requireEstafetaAccess();

  if (
    !sectionId ||
    !editionId
  ) {
    return {
      success: false,
      message:
        "Caderno inválido.",
    };
  }

  const supabase =
    await createClient();

  const {
    data: edition,
    error:
      editionError,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .select(`
        id,
        status
      `)
      .eq(
        "id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (
    editionError ||
    !edition
  ) {
    return {
      success: false,
      message:
        "Edição não encontrada.",
    };
  }

  if (
    edition.status !==
    "open"
  ) {
    return {
      success: false,
      message:
        "Esta edição não pode mais ser alterada.",
    };
  }

  const {
    error,
  } =
    await supabase
      .from(
        "edition_sections"
      )
      .update({
        active,
      })
      .eq(
        "id",
        sectionId
      )
      .eq(
        "edition_id",
        editionId
      );

  if (
    error
  ) {
    console.error(
      "Erro ao alterar status do caderno:",
      error
    );

    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidateEdition(
    editionId
  );

  return {
    success: true,
  };
}

/*
 * =====================================================
 * BLOQUEAR / DESBLOQUEAR POSIÇÃO
 * =====================================================
 */

export async function setEditionAdPositionBlocked(
  positionId: string,
  editionId: string,
  blocked: boolean,
  reason?: string
) {
  const access =
    await requireEstafetaAccess();

  if (
    !positionId ||
    !editionId
  ) {
    return {
      success: false,
      message:
        "Posição inválida.",
    };
  }

  const supabase =
    await createClient();

  /*
   * A edição precisa pertencer
   * ao Estafeta e estar aberta.
   */

  const {
    data: edition,
    error:
      editionError,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .select(`
        id,
        status
      `)
      .eq(
        "id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (
    editionError ||
    !edition
  ) {
    return {
      success: false,
      message:
        "Edição não encontrada.",
    };
  }

  if (
    edition.status !==
    "open"
  ) {
    return {
      success: false,
      message:
        "As posições de uma edição fechada não podem ser alteradas.",
    };
  }

  /*
   * Confirma que a posição pertence
   * à edição informada.
   */

  const {
    data: position,
    error:
      positionError,
  } =
    await supabase
      .from(
        "edition_ad_positions"
      )
      .select(`
        id
      `)
      .eq(
        "id",
        positionId
      )
      .eq(
        "edition_id",
        editionId
      )
      .maybeSingle();

  if (
    positionError ||
    !position
  ) {
    return {
      success: false,
      message:
        "Posição comercial não encontrada.",
    };
  }

  const {
    error,
  } =
    await supabase
      .from(
        "edition_ad_positions"
      )
      .update({
        manually_blocked:
          blocked,

        blocked_reason:
          blocked
            ? reason
                ?.trim() ||
              "Esgotado."
            : null,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        positionId
      )
      .eq(
        "edition_id",
        editionId
      );

  if (
    error
  ) {
    console.error(
      "Erro ao alterar posição:",
      error
    );

    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidateEdition(
    editionId
  );

  return {
    success: true,
  };
}

/*
 * =====================================================
 * ALTERAR CAPACIDADE DA POSIÇÃO
 * =====================================================
 */

export async function updateEditionAdPositionCapacity(
  positionId: string,
  editionId: string,
  capacity:
    | number
    | null
) {
  const access =
    await requireEstafetaAccess();

  if (
    !positionId ||
    !editionId
  ) {
    return {
      success: false,
      message:
        "Posição inválida.",
    };
  }

  if (
    capacity !==
      null &&
    (
      !Number.isInteger(
        capacity
      ) ||
      capacity < 1
    )
  ) {
    return {
      success: false,
      message:
        "A capacidade deve ser maior que zero ou ilimitada.",
    };
  }

  const supabase =
    await createClient();

  const {
    data: edition,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .select(`
        id,
        status
      `)
      .eq(
        "id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (
    !edition
  ) {
    return {
      success: false,
      message:
        "Edição não encontrada.",
    };
  }

  if (
    edition.status !==
    "open"
  ) {
    return {
      success: false,
      message:
        "Esta edição não pode mais ser alterada.",
    };
  }

  const {
    error,
  } =
    await supabase
      .from(
        "edition_ad_positions"
      )
      .update({
        capacity,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        positionId
      )
      .eq(
        "edition_id",
        editionId
      );

  if (
    error
  ) {
    console.error(
      "Erro ao atualizar capacidade:",
      error
    );

    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidateEdition(
    editionId
  );

  return {
    success: true,
  };
}

/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

/*
 * =====================================================
 * MOVER CADERNO PARA OUTRA EDIÇÃO (outra data)
 * =====================================================
 *
 * Pedido do Leandro (07/10): trocar a data de um caderno
 * "especial" levando tudo o que tem dentro. O caderno muda de
 * edição junto com as posições, as publicações de contrato e as
 * vendas avulsas que estão nele (ids preservados, então os
 * vínculos de posição continuam valendo).
 *
 * Venda é de UMA edição só: se uma venda tem itens em outros
 * cadernos (ou sem caderno), mover o caderno partiria a venda
 * entre duas edições - nesse caso bloqueia e diz quais vendas.
 *
 * Financeiro e comissões não mudam (não têm vínculo com a
 * edição), igual ao "mover venda". O texto dos lançamentos
 * ("Edição 1803 - Publicidade...") e a data de competência
 * gravada neles continuam os da criação.
 */

export async function moveEditionSection(
  input: {
    sectionId: string;
    editionId: string;
    targetEditionId: string;
  }
) {
  const access =
    await requireEstafetaAccess();

  const isAdmin =
    access.profile.role === "admin";

  const db = createAdminClient();

  if (
    !input.sectionId ||
    !input.editionId ||
    !input.targetEditionId
  ) {
    return {
      success: false as const,
      message: "Dados inválidos.",
    };
  }

  if (
    input.editionId ===
    input.targetEditionId
  ) {
    return {
      success: false as const,
      message:
        "O caderno já está nesta edição.",
    };
  }

  const { data: section } = await db
    .from("edition_sections")
    .select("id, name, edition_id")
    .eq("id", input.sectionId)
    .eq("edition_id", input.editionId)
    .maybeSingle();

  if (!section) {
    return {
      success: false as const,
      message: "Caderno não encontrado.",
    };
  }

  const { data: editions } = await db
    .from("newspaper_editions")
    .select("id, name, status")
    .in("id", [
      input.editionId,
      input.targetEditionId,
    ])
    .eq(
      "company_id",
      access.estafetaCompany.id
    );

  const source = editions?.find(
    (item) => item.id === input.editionId
  );

  const target = editions?.find(
    (item) =>
      item.id === input.targetEditionId
  );

  if (!source || !target) {
    return {
      success: false as const,
      message: "Edição não encontrada.",
    };
  }

  if (
    !isAdmin &&
    (source.status !== "open" ||
      target.status !== "open")
  ) {
    return {
      success: false as const,
      message:
        "As duas edições precisam estar abertas para mover o caderno.",
    };
  }

  const { data: sameName } = await db
    .from("edition_sections")
    .select("id")
    .eq("edition_id", target.id)
    .ilike(
      "name",
      section.name.replace(
        /[\\%_]/g,
        (char: string) => `\\${char}`
      )
    )
    .maybeSingle();

  if (sameName) {
    return {
      success: false as const,
      message: `A ${target.name} já tem um caderno chamado "${section.name}".`,
    };
  }

  /*
   * VENDAS AVULSAS COM ITENS NESTE CADERNO
   */

  const { data: sectionItems } = await db
    .from("edition_sale_items")
    .select("sale_id")
    .eq("section_id", section.id);

  const saleIds = Array.from(
    new Set(
      (sectionItems ?? []).map(
        (item) => item.sale_id
      )
    )
  );

  let moveSaleIds: string[] = [];
  let cancelledSaleIds: string[] = [];

  if (saleIds.length > 0) {
    const [
      { data: sales },
      { data: allItems },
    ] = await Promise.all([
      db
        .from("edition_sales")
        .select(
          "id, status, edition_id, client:clients(name)"
        )
        .in("id", saleIds),

      db
        .from("edition_sale_items")
        .select("sale_id, section_id")
        .in("sale_id", saleIds),
    ]);

    const mixed = (sales ?? []).filter(
      (sale) =>
        sale.status !== "cancelled" &&
        (allItems ?? []).some(
          (item) =>
            item.sale_id === sale.id &&
            item.section_id !== section.id
        )
    );

    if (mixed.length > 0) {
      const names = mixed
        .slice(0, 3)
        .map((sale) => {
          const client = Array.isArray(
            sale.client
          )
            ? sale.client[0]
            : sale.client;

          return client?.name ?? "venda";
        })
        .join(", ");

      return {
        success: false as const,
        message: `Não dá para mover: ${mixed.length} venda(s) (${names}) têm itens em outros cadernos além deste. Ajuste a venda para ficar só neste caderno e tente de novo.`,
      };
    }

    const strange = (sales ?? []).find(
      (sale) =>
        sale.status !== "cancelled" &&
        sale.edition_id !== source.id
    );

    if (strange) {
      return {
        success: false as const,
        message:
          "Há uma venda neste caderno que pertence a outra edição. Corrija antes de mover.",
      };
    }

    moveSaleIds = (sales ?? [])
      .filter(
        (sale) =>
          sale.status !== "cancelled"
      )
      .map((sale) => sale.id);

    cancelledSaleIds = (sales ?? [])
      .filter(
        (sale) =>
          sale.status === "cancelled"
      )
      .map((sale) => sale.id);
  }

  const { data: positions } = await db
    .from("edition_ad_positions")
    .select("id")
    .eq("section_id", section.id)
    .eq("edition_id", source.id);

  const positionIds = (positions ?? []).map(
    (item) => item.id
  );

  const { data: publications } = await db
    .from("contract_edition_publications")
    .select("id")
    .eq("section_id", section.id)
    .eq("edition_id", source.id);

  const publicationIds = (
    publications ?? []
  ).map((item) => item.id);

  /*
   * MOVE (com desfazer se algum passo falhar)
   */

  const done: (() => Promise<unknown>)[] =
    [];

  async function rollback() {
    for (const undo of done.reverse()) {
      try {
        await undo();
      } catch (error) {
        console.error(
          "Erro ao desfazer o move do caderno:",
          error
        );
      }
    }
  }

  const now = new Date().toISOString();

  const step1 = await db
    .from("edition_sections")
    .update({ edition_id: target.id })
    .eq("id", section.id);

  if (step1.error) {
    return {
      success: false as const,
      message: step1.error.message,
    };
  }

  done.push(async () =>
    db
      .from("edition_sections")
      .update({ edition_id: source.id })
      .eq("id", section.id)
  );

  if (positionIds.length > 0) {
    const step2 = await db
      .from("edition_ad_positions")
      .update({
        edition_id: target.id,
        updated_at: now,
      })
      .in("id", positionIds);

    if (step2.error) {
      await rollback();

      return {
        success: false as const,
        message:
          "Não foi possível mover as posições do caderno.",
      };
    }

    done.push(async () =>
      db
        .from("edition_ad_positions")
        .update({ edition_id: source.id })
        .in("id", positionIds)
    );
  }

  if (publicationIds.length > 0) {
    const step3 = await db
      .from("contract_edition_publications")
      .update({
        edition_id: target.id,
        updated_at: now,
      })
      .in("id", publicationIds);

    if (step3.error) {
      await rollback();

      return {
        success: false as const,
        message:
          "Não foi possível mover as publicações do caderno.",
      };
    }

    done.push(async () =>
      db
        .from("contract_edition_publications")
        .update({ edition_id: source.id })
        .in("id", publicationIds)
    );
  }

  if (moveSaleIds.length > 0) {
    const step4 = await db
      .from("edition_sales")
      .update({
        edition_id: target.id,
        updated_at: now,
      })
      .in("id", moveSaleIds);

    if (step4.error) {
      await rollback();

      return {
        success: false as const,
        message:
          "Não foi possível mover as vendas do caderno.",
      };
    }

    done.push(async () =>
      db
        .from("edition_sales")
        .update({ edition_id: source.id })
        .in("id", moveSaleIds)
    );
  }

  /*
   * Vendas canceladas não acompanham o caderno: só soltam o
   * vínculo com ele (o caderno agora é de outra edição).
   */
  if (cancelledSaleIds.length > 0) {
    await db
      .from("edition_sale_items")
      .update({
        section_id: null,
        ad_position_id: null,
      })
      .in("sale_id", cancelledSaleIds)
      .eq("section_id", section.id);
  }

  await createAuditLog({
    module: "editions",
    action: "update",
    entityType: "edition_section",
    entityId: section.id,
    description: `Caderno "${section.name}" movido da ${source.name} para a ${target.name}.`,
    oldData: { edition_id: source.id },
    newData: {
      edition_id: target.id,
      positions: positionIds.length,
      publications: publicationIds.length,
      sales: moveSaleIds.length,
    },
  });

  revalidateEdition(source.id);
  revalidateEdition(target.id);

  revalidatePath("/edicoes/vendas");

  return {
    success: true as const,
    targetName: target.name,
    publications: publicationIds.length,
    sales: moveSaleIds.length,
  };
}

function revalidateEdition(
  editionId: string
) {
  revalidatePath(
    "/edicoes"
  );

  revalidatePath(
    `/edicoes/${editionId}`
  );

  revalidatePath(
    `/edicoes/${editionId}/vendas/nova`
  );
}

function roundMoney(
  value: number
) {
  return (
    Math.round(
      (
        Number(
          value
        ) +
        Number.EPSILON
      ) *
        100
    ) /
    100
  );
}

/*
 * =====================================================
 * EXCLUIR CADERNO
 * =====================================================
 *
 * Só permite excluir um caderno de uma edição aberta e
 * que ainda não tenha vendas nem publicações de contrato
 * vinculadas a ele. As posições padrão do caderno são
 * removidas junto.
 */

export async function deleteEditionSection(
  sectionId: string,
  editionId: string
) {
  const access =
    await requireEstafetaAccess();

  if (!sectionId || !editionId) {
    return {
      success: false,
      message: "Caderno inválido.",
    };
  }

  const supabase =
    await createClient();

  const {
    data: edition,
  } = await supabase
    .from("newspaper_editions")
    .select("id, status")
    .eq("id", editionId)
    .eq(
      "company_id",
      access.estafetaCompany.id
    )
    .maybeSingle();

  if (!edition) {
    return {
      success: false,
      message: "Edição não encontrada.",
    };
  }

  if (edition.status !== "open") {
    return {
      success: false,
      message:
        "Esta edição não pode mais ser alterada.",
    };
  }

  const { data: section } = await supabase
    .from("edition_sections")
    .select("id")
    .eq("id", sectionId)
    .eq("edition_id", editionId)
    .maybeSingle();

  if (!section) {
    return {
      success: false,
      message: "Caderno não encontrado.",
    };
  }

  const { count: saleItemCount } =
    await supabase
      .from("edition_sale_items")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("section_id", sectionId);

  if ((saleItemCount ?? 0) > 0) {
    return {
      success: false,
      message:
        "Este caderno já tem vendas vinculadas. Remova as vendas antes de excluir.",
    };
  }

  const { count: publicationCount } =
    await supabase
      .from(
        "contract_edition_publications"
      )
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("section_id", sectionId);

  if ((publicationCount ?? 0) > 0) {
    return {
      success: false,
      message:
        "Este caderno tem publicações de contrato vinculadas. Mova-as antes de excluir.",
    };
  }

  await supabase
    .from("edition_ad_positions")
    .delete()
    .eq("section_id", sectionId);

  const { error } = await supabase
    .from("edition_sections")
    .delete()
    .eq("id", sectionId);

  if (error) {
    console.error(
      "Erro ao excluir caderno:",
      error
    );

    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath(
    `/edicoes/${editionId}`
  );

  return { success: true };
}