"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

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
    capacity: 1,
  },
  {
    code: "back_cover",
    name: "Contracapa",
    capacity: 1,
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
    capacity: 1,
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

        description,

        sales_goal:
          salesGoal,

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
    DEFAULT_AD_POSITIONS.map(
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

  revalidateEdition(
    input.editionId
  );

  return {
    success: true,
    id:
      section.id,
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
              "Bloqueada pelo administrador."
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