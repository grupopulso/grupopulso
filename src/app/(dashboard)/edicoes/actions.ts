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

type CreateEditionSectionInput = {
  name: string;

  description?:
    | string
    | null;

  salesGoal: number;
};

type CreateEditionInput = {
  companyId: string;

  name: string;

  editionNumber?: string;

  publicationDate: string;

  salesGoal: number;

  /*
   * Nº de páginas da edição (mapa da edição).
   * Opcional — 16, 24, 36…
   */
  pageCount?: number | null;

  sections?:
    CreateEditionSectionInput[];

  notes?: string;
};

type UpdateEditionInput = {
  id: string;

  name: string;

  editionNumber?: string;

  publicationDate: string;

  /*
   * Opcional por enquanto para
   * manter compatibilidade com
   * a tela antiga de edição.
   */
  salesGoal?: number;

  notes?: string;
};

/*
 * =====================================================
 * POSIÇÕES PADRÃO
 * =====================================================
 */

const DEFAULT_AD_POSITIONS = [
  {
    code:
      "cover",

    name:
      "Capa",

    capacity:
      null,
  },

  {
    code:
      "back_cover",

    name:
      "Contracapa",

    capacity:
      null,
  },

  {
    code:
      "inside_bw",

    name:
      "Interno preto e branco",

    capacity:
      null,
  },

  {
    code:
      "inside_color",

    name:
      "Interno colorido",

    capacity:
      null,
  },

  {
    code:
      "overcover",

    name:
      "Sobrecapa",

    capacity:
      null,
  },

  {
    /*
     * Espaço dos colunistas — funciona como uma
     * "capa" reservada, mas comporta vários nomes.
     */
    code:
      "columnist",

    name:
      "Coluna",

    capacity:
      null,
  },
] as const;

/*
 * =====================================================
 * CRIAR EDIÇÃO
 * =====================================================
 */

export async function createEdition(
  input: CreateEditionInput
) {
  const access =
    await requireEstafetaAccess();

  /*
   * =====================================================
   * NORMALIZAÇÃO
   * =====================================================
   */

  const name =
    input.name.trim();

  const editionNumber =
    input.editionNumber
      ?.trim() ||
    null;

  const notes =
    input.notes
      ?.trim() ||
    null;

  const salesGoal =
    roundMoney(
      Number(
        input.salesGoal ??
          0
      )
    );

  const pageCount =
    input.pageCount != null &&
    Number.isFinite(
      Number(input.pageCount)
    ) &&
    Number(input.pageCount) > 0
      ? Math.round(
          Number(input.pageCount)
        )
      : null;

  const sections =
    (
      input.sections ??
      []
    ).map(
      (
        section
      ) => ({
        name:
          section.name
            .trim(),

        description:
          section.description
            ?.trim() ||
          null,

        salesGoal:
          roundMoney(
            Number(
              section.salesGoal ??
                0
            )
          ),
      })
    );

  /*
   * =====================================================
   * VALIDAÇÕES
   * =====================================================
   */

  if (
    !name
  ) {
    return {
      success: false,

      message:
        "Informe o nome da edição.",
    };
  }

  if (
    !input.publicationDate
  ) {
    return {
      success: false,

      message:
        "Informe a data de publicação.",
    };
  }

  if (
    !Number.isFinite(
      salesGoal
    ) ||
    salesGoal <
      0
  ) {
    return {
      success: false,

      message:
        "Informe uma meta válida para a edição.",
    };
  }

  for (
    let index = 0;
    index <
    sections.length;
    index++
  ) {
    const section =
      sections[
        index
      ];

    if (
      !section.name
    ) {
      return {
        success: false,

        message:
          `Informe o nome do caderno ${index + 1}.`,
      };
    }

    if (
      !Number.isFinite(
        section.salesGoal
      ) ||
      section.salesGoal <
        0
    ) {
      return {
        success: false,

        message:
          `Informe uma meta válida para o caderno ${section.name}.`,
      };
    }
  }

  /*
   * =====================================================
   * EMPRESA
   * =====================================================
   *
   * Não confiamos no companyId
   * enviado pelo frontend.
   *
   * Edições pertencem somente
   * ao O Estafeta.
   */

  const estafetaCompanyId =
    access.estafetaCompany.id;

  if (
    input.companyId !==
    estafetaCompanyId
  ) {
    return {
      success: false,

      message:
        "Edições só podem ser criadas para O Estafeta.",
    };
  }

  const supabase =
    await createClient();

  /*
   * =====================================================
   * CRIAR EDIÇÃO
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
      .insert({
        company_id:
          estafetaCompanyId,

        name,

        edition_number:
          editionNumber,

        publication_date:
          input.publicationDate,

        sales_goal:
          salesGoal,

        /*
         * Só envia page_count quando informado — assim
         * a criação de edição continua funcionando mesmo
         * antes da migração que adiciona a coluna.
         */
        ...(pageCount != null
          ? { page_count: pageCount }
          : {}),

        status:
          "open",

        notes,
      })
      .select(`
        id
      `)
      .single();

  if (
    editionError ||
    !edition
  ) {
    console.error(
      "Erro ao criar edição:",
      editionError
    );

    return {
      success: false,

      message:
        editionError
          ?.message ??
        "Não foi possível criar a edição.",
    };
  }

    /*
   * =====================================================
   * CRIAR POSIÇÕES GERAIS DA EDIÇÃO
   * =====================================================
   *
   * Estas posições não pertencem a nenhum caderno.
   *
   * section_id = null
   *
   * Assim uma venda pode ser registrada diretamente
   * na edição sem precisar selecionar um caderno.
   */

  const generalPositionRows =
    DEFAULT_AD_POSITIONS.map(
      (
        position
      ) => ({
        edition_id:
          edition.id,

        section_id:
          null,

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
      generalPositionsError,
  } =
    await supabase
      .from(
        "edition_ad_positions"
      )
      .insert(
        generalPositionRows
      );

  if (
    generalPositionsError
  ) {
    console.error(
      "Erro ao criar posições gerais da edição:",
      generalPositionsError
    );

    await rollbackEdition(
      supabase,
      edition.id
    );

    return {
      success: false,

      message:
        `Não foi possível criar as posições gerais da edição: ${generalPositionsError.message}`,
    };
  }

  /*
   * =====================================================
   * CRIAR CADERNOS
   * =====================================================
   */

  try {
    for (
      const section of
        sections
    ) {
      const {
        data:
          createdSection,

        error:
          sectionError,
      } =
        await supabase
          .from(
            "edition_sections"
          )
          .insert({
            edition_id:
              edition.id,

            name:
              section.name,

            description:
              section.description,

            sales_goal:
              section.salesGoal,

            active:
              true,
          })
          .select(`
            id
          `)
          .single();

      if (
        sectionError ||
        !createdSection
      ) {
        throw new Error(
          sectionError
            ?.message ??
            `Não foi possível criar o caderno ${section.name}.`
        );
      }

      /*
       * ===============================================
       * POSIÇÕES PADRÃO DO CADERNO
       * ===============================================
       */

      const positionRows =
        DEFAULT_AD_POSITIONS.map(
          (
            position
          ) => ({
            edition_id:
              edition.id,

            section_id:
              createdSection.id,

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
        throw new Error(
          `Não foi possível criar as posições do caderno ${section.name}: ${positionsError.message}`
        );
      }
    }
  } catch (
    error
  ) {
    console.error(
      "Erro ao configurar edição:",
      error
    );

    /*
     * =================================================
     * ROLLBACK
     * =================================================
     *
     * Ao remover a edição:
     *
     * newspaper_editions
     *      ↓ CASCADE
     * edition_sections
     *      ↓ CASCADE
     * edition_ad_positions
     */

    await rollbackEdition(
      supabase,
      edition.id
    );

    return {
      success: false,

      message:
        error instanceof
        Error
          ? `Não foi possível concluir a criação da edição: ${error.message}`
          : "Não foi possível configurar os cadernos da edição.",
    };
  }

  /*
   * =====================================================
   * REVALIDAÇÃO
   * =====================================================
   */

  revalidatePath(
    "/edicoes"
  );

  revalidatePath(
    `/edicoes/${edition.id}`
  );

  return {
    success: true,

    id:
      edition.id,
  };
}

/*
 * =====================================================
 * EDITAR EDIÇÃO
 * =====================================================
 */

export async function updateEdition(
  input: UpdateEditionInput
) {
  const access =
    await requireEstafetaAccess();

  const name =
    input.name.trim();

  if (
    !input.id
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
        "Informe o nome da edição.",
    };
  }

  if (
    !input.publicationDate
  ) {
    return {
      success: false,

      message:
        "Informe a data de publicação.",
    };
  }

  if (
    input.salesGoal !==
      undefined &&
    (
      !Number.isFinite(
        input.salesGoal
      ) ||
      input.salesGoal <
        0
    )
  ) {
    return {
      success: false,

      message:
        "Informe uma meta válida para a edição.",
    };
  }

  const supabase =
    await createClient();

  /*
   * =====================================================
   * EDIÇÃO ATUAL
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
        sales_goal
      `)
      .eq(
        "id",
        input.id
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

  /*
   * Confirma O Estafeta.
   */

  if (
    edition.company_id !==
    access.estafetaCompany.id
  ) {
    return {
      success: false,

      message:
        "Esta edição não pertence ao O Estafeta.",
    };
  }

  if (
    edition.status ===
    "cancelled"
  ) {
    return {
      success: false,

      message:
        "Uma edição cancelada não pode ser editada.",
    };
  }

  /*
   * =====================================================
   * ATUALIZAÇÃO
   * =====================================================
   */

  const updateData: {
    name: string;

    edition_number:
      string | null;

    publication_date:
      string;

    sales_goal?:
      number;

    notes:
      string | null;

    updated_at:
      string;
  } = {
    name,

    edition_number:
      input.editionNumber
        ?.trim() ||
      null,

    publication_date:
      input.publicationDate,

    notes:
      input.notes
        ?.trim() ||
      null,

    updated_at:
      new Date()
        .toISOString(),
  };

  /*
   * Mantém compatibilidade com
   * o formulário antigo.
   */

  if (
    input.salesGoal !==
    undefined
  ) {
    updateData.sales_goal =
      roundMoney(
        input.salesGoal
      );
  }

  const {
    error,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .update(
        updateData
      )
      .eq(
        "id",
        input.id
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      );

  if (
    error
  ) {
    console.error(
      "Erro ao editar edição:",
      error
    );

    return {
      success: false,

      message:
        error.message,
    };
  }

  revalidatePath(
    "/edicoes"
  );

  revalidatePath(
    `/edicoes/${input.id}`
  );

  return {
    success: true,
  };
}

/*
 * =====================================================
 * NÚMERO DE PÁGINAS (MAPA DA EDIÇÃO)
 * =====================================================
 */

export async function updateEditionPageCount(
  editionId: string,
  pageCount: number | null
) {
  const access =
    await requireEstafetaAccess();

  if (!editionId) {
    return {
      success: false,
      message: "Edição inválida.",
    };
  }

  const normalized =
    pageCount != null &&
    Number.isFinite(Number(pageCount)) &&
    Number(pageCount) > 0
      ? Math.round(Number(pageCount))
      : null;

  const supabase =
    await createClient();

  const { data: edition } =
    await supabase
      .from("newspaper_editions")
      .select("id, company_id, status")
      .eq("id", editionId)
      .maybeSingle();

  if (
    !edition ||
    edition.company_id !==
      access.estafetaCompany.id
  ) {
    return {
      success: false,
      message: "Edição não encontrada.",
    };
  }

  if (edition.status === "cancelled") {
    return {
      success: false,
      message:
        "Uma edição cancelada não pode ser editada.",
    };
  }

  const { error } = await supabase
    .from("newspaper_editions")
    .update({
      page_count: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", editionId)
    .eq(
      "company_id",
      access.estafetaCompany.id
    );

  if (error) {
    console.error(
      "Erro ao atualizar nº de páginas da edição:",
      error
    );

    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/edicoes");
  revalidatePath(`/edicoes/${editionId}`);

  return { success: true };
}

/*
 * =====================================================
 * ALTERAR META COMERCIAL DA EDIÇÃO
 * =====================================================
 */

export async function updateEditionSalesGoal(
  editionId: string,
  salesGoal: number
) {
  const access =
    await requireEstafetaAccess();

  if (!editionId) {
    return {
      success: false,
      message: "Edição inválida.",
    };
  }

  if (
    !Number.isFinite(Number(salesGoal)) ||
    Number(salesGoal) < 0
  ) {
    return {
      success: false,
      message:
        "Informe um valor de meta válido.",
    };
  }

  const normalized = roundMoney(
    Number(salesGoal)
  );

  const supabase =
    await createClient();

  const { data: edition } =
    await supabase
      .from("newspaper_editions")
      .select("id, company_id, status")
      .eq("id", editionId)
      .maybeSingle();

  if (
    !edition ||
    edition.company_id !==
      access.estafetaCompany.id
  ) {
    return {
      success: false,
      message: "Edição não encontrada.",
    };
  }

  if (edition.status === "cancelled") {
    return {
      success: false,
      message:
        "Uma edição cancelada não pode ser editada.",
    };
  }

  const { error } = await supabase
    .from("newspaper_editions")
    .update({
      sales_goal: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", editionId)
    .eq(
      "company_id",
      access.estafetaCompany.id
    );

  if (error) {
    console.error(
      "Erro ao atualizar meta da edição:",
      error
    );

    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/edicoes");
  revalidatePath(`/edicoes/${editionId}`);

  return { success: true };
}

/*
 * =====================================================
 * ALTERAR STATUS
 * =====================================================
 */

export async function changeEditionStatus(
  editionId: string,
  status:
    | "open"
    | "closed"
    | "cancelled"
) {
  const access =
    await requireEstafetaAccess();

  if (
    !editionId
  ) {
    return {
      success: false,

      message:
        "Edição inválida.",
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
        company_id,
        status
      `)
      .eq(
        "id",
        editionId
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
    edition.company_id !==
    access.estafetaCompany.id
  ) {
    return {
      success: false,

      message:
        "Esta edição não pertence ao O Estafeta.",
    };
  }

  /*
   * Se estiver cancelada,
   * não permitimos reabrir.
   */

  if (
    edition.status ===
      "cancelled" &&
    status !==
      "cancelled"
  ) {
    return {
      success: false,

      message:
        "Uma edição cancelada não pode ser reaberta.",
    };
  }

  const {
    error,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .update({
        status,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      );

  if (
    error
  ) {
    console.error(
      "Erro ao alterar status da edição:",
      error
    );

    return {
      success: false,

      message:
        error.message,
    };
  }

  revalidatePath(
    "/edicoes"
  );

  revalidatePath(
    `/edicoes/${editionId}`
  );

  return {
    success: true,
  };
}

/*
 * =====================================================
 * FECHAR EDIÇÃO
 * =====================================================
 */

export async function closeEdition(
  editionId: string
) {
  return changeEditionStatus(
    editionId,
    "closed"
  );
}

/*
 * =====================================================
 * REABRIR EDIÇÃO
 * =====================================================
 */

export async function reopenEdition(
  editionId: string
) {
  return changeEditionStatus(
    editionId,
    "open"
  );
}

/*
 * =====================================================
 * CANCELAR EDIÇÃO
 * =====================================================
 */

export async function cancelEdition(
  editionId: string
) {
  const access =
    await requireEstafetaAccess();

  if (
    !editionId
  ) {
    return {
      success: false,

      message:
        "Edição inválida.",
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
        editionId
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
    edition.company_id !==
    access.estafetaCompany.id
  ) {
    return {
      success: false,

      message:
        "Esta edição não pertence ao O Estafeta.",
    };
  }

  /*
   * =====================================================
   * VENDAS CONFIRMADAS
   * =====================================================
   */

  const {
    count,
    error:
      salesError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "edition_id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .eq(
        "status",
        "confirmed"
      );

  if (
    salesError
  ) {
    console.error(
      "Erro ao verificar vendas:",
      salesError
    );

    return {
      success: false,

      message:
        "Não foi possível verificar as vendas desta edição.",
    };
  }

  if (
    (
      count ??
      0
    ) >
    0
  ) {
    return {
      success: false,

      message:
        "Esta edição possui vendas confirmadas e não pode ser cancelada.",
    };
  }

  return changeEditionStatus(
    editionId,
    "cancelled"
  );
}

/*
 * =====================================================
 * ROLLBACK DA EDIÇÃO
 * =====================================================
 */

async function rollbackEdition(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  editionId: string
) {
  const {
    error,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .delete()
      .eq(
        "id",
        editionId
      );

  if (
    error
  ) {
    console.error(
      "Erro ao remover edição no rollback:",
      error
    );
  }
}

/*
 * =====================================================
 * DINHEIRO
 * =====================================================
 */

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