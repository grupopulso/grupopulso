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

type AddContractPublicationInput = {
  editionId: string;

  contractId: string;

  sectionId?:
    | string
    | null;

  adPositionId?:
    | string
    | null;

  sizeDescription?:
    | string
    | null;

  amount: number;

  notes?:
    | string
    | null;
};

type UpdateContractPublicationInput = {
  publicationId: string;

  editionId: string;

  sectionId?:
    | string
    | null;

  adPositionId?:
    | string
    | null;

  sizeDescription?:
    | string
    | null;

  amount: number;

  notes?:
    | string
    | null;
};

/*
 * =====================================================
 * ADICIONAR PUBLICAÇÃO
 * =====================================================
 */

export async function addContractPublicationToEdition(
  input:
    AddContractPublicationInput
) {
  const access =
    await requireEstafetaAccess();

  const supabase =
    await createClient();

  /*
   * =====================================================
   * VALIDAÇÕES BÁSICAS
   * =====================================================
   */

  if (
    !input.editionId
  ) {
    return {
      success: false,

      error:
        "Edição inválida.",
    };
  }

  if (
    !input.contractId
  ) {
    return {
      success: false,

      error:
        "Contrato inválido.",
    };
  }

  if (
    !Number.isFinite(
      input.amount
    ) ||
    input.amount <
      0
  ) {
    return {
      success: false,

      error:
        "Informe um valor válido para a publicação.",
    };
  }

  /*
   * =====================================================
   * EDIÇÃO
   * =====================================================
   */

  const editionResult =
    await validateEdition(
      supabase,
      access
        .estafetaCompany
        .id,
      input.editionId
    );

  if (
    !editionResult.success
  ) {
    return editionResult;
  }

  /*
   * =====================================================
   * CONTRATO
   * =====================================================
   */

  const {
    data:
      contract,
    error:
      contractError,
  } =
    await supabase
      .from(
        "contracts"
      )
      .select(`
        id,
        company_id,
        client_id,
        status,
        start_date,
        end_date
      `)
      .eq(
        "id",
        input.contractId
      )
      .eq(
        "company_id",
        access
          .estafetaCompany
          .id
      )
      .maybeSingle();

  if (
    contractError ||
    !contract
  ) {
    return {
      success: false,

      error:
        "Contrato não encontrado ou não pertence ao O Estafeta.",
    };
  }

  if (
    contract.status !==
    "active"
  ) {
    return {
      success: false,

      error:
        "Somente contratos ativos podem ser vinculados à edição.",
    };
  }

  /*
   * =====================================================
   * EVITAR DUPLICIDADE
   * =====================================================
   */

  const {
    data:
      existingPublication,
    error:
      existingError,
  } =
    await supabase
      .from(
        "contract_edition_publications"
      )
      .select(`
        id
      `)
      .eq(
        "edition_id",
        input.editionId
      )
      .eq(
        "contract_id",
        input.contractId
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  if (
    existingError
  ) {
    console.error(
      "Erro ao verificar publicação existente:",
      existingError
    );

    return {
      success: false,

      error:
        "Não foi possível verificar se o contrato já está vinculado à edição.",
    };
  }

  if (
    existingPublication
  ) {
    return {
      success: false,

      error:
        "Este contrato já possui uma publicação vinculada a esta edição.",
    };
  }

  /*
   * =====================================================
   * VALIDAR CADERNO / POSIÇÃO
   * =====================================================
   */

  const placementResult =
    await validatePublicationPlacement(
      supabase,
      {
        editionId:
          input.editionId,

        sectionId:
          input.sectionId,

        adPositionId:
          input.adPositionId,

        /*
         * Ao criar não existe publicação
         * atual para ignorar.
         */

        ignorePublicationId:
          null,
      }
    );

  if (
    !placementResult.success
  ) {
    return placementResult;
  }

  /*
   * =====================================================
   * CRIAR
   * =====================================================
   */

  const {
    data:
      publication,
    error:
      insertError,
  } =
    await supabase
      .from(
        "contract_edition_publications"
      )
      .insert({
        contract_id:
          input.contractId,

        edition_id:
          input.editionId,

        section_id:
          placementResult.sectionId,

        ad_position_id:
          placementResult.adPositionId,

        size_description:
          input.sizeDescription
            ?.trim() ||
          null,

        amount:
          roundMoney(
            input.amount
          ),

        notes:
          input.notes
            ?.trim() ||
          null,

        active:
          true,
      })
      .select(`
        id
      `)
      .single();

  if (
    insertError ||
    !publication
  ) {
    console.error(
      "Erro ao adicionar publicação à edição:",
      insertError
    );

    return {
      success: false,

      error:
        insertError
          ?.message ??
        "Não foi possível adicionar a publicação à edição.",
    };
  }

  revalidateEditionPaths(
    input.editionId,
    input.contractId
  );

  return {
    success: true,

    publicationId:
      publication.id,
  };
}

/*
 * =====================================================
 * EDITAR PUBLICAÇÃO
 * =====================================================
 */

export async function updateContractPublicationInEdition(
  input:
    UpdateContractPublicationInput
) {
  const access =
    await requireEstafetaAccess();

  const supabase =
    await createClient();

  /*
   * =====================================================
   * VALIDAÇÕES BÁSICAS
   * =====================================================
   */

  if (
    !input.publicationId
  ) {
    return {
      success: false,

      error:
        "Publicação inválida.",
    };
  }

  if (
    !input.editionId
  ) {
    return {
      success: false,

      error:
        "Edição inválida.",
    };
  }

  if (
    !Number.isFinite(
      input.amount
    ) ||
    input.amount <
      0
  ) {
    return {
      success: false,

      error:
        "Informe um valor válido para a publicação.",
    };
  }

  /*
   * =====================================================
   * EDIÇÃO
   * =====================================================
   */

  const editionResult =
    await validateEdition(
      supabase,
      access
        .estafetaCompany
        .id,
      input.editionId
    );

  if (
    !editionResult.success
  ) {
    return editionResult;
  }

  /*
   * =====================================================
   * PUBLICAÇÃO ATUAL
   * =====================================================
   */

  const {
    data:
      publication,
    error:
      publicationError,
  } =
    await supabase
      .from(
        "contract_edition_publications"
      )
      .select(`
        id,
        contract_id,
        edition_id,
        active,
        section_id,
        ad_position_id
      `)
      .eq(
        "id",
        input.publicationId
      )
      .eq(
        "edition_id",
        input.editionId
      )
      .maybeSingle();

  if (
    publicationError ||
    !publication
  ) {
    return {
      success: false,

      error:
        "Publicação não encontrada.",
    };
  }

  if (
    !publication.active
  ) {
    return {
      success: false,

      error:
        "Esta publicação já foi desvinculada da edição.",
    };
  }

  /*
   * =====================================================
   * CONFIRMAR CONTRATO / EMPRESA
   * =====================================================
   */

  const {
    data:
      contract,
    error:
      contractError,
  } =
    await supabase
      .from(
        "contracts"
      )
      .select(`
        id,
        company_id,
        status
      `)
      .eq(
        "id",
        publication.contract_id
      )
      .eq(
        "company_id",
        access
          .estafetaCompany
          .id
      )
      .maybeSingle();

  if (
    contractError ||
    !contract
  ) {
    return {
      success: false,

      error:
        "O contrato desta publicação não foi encontrado.",
    };
  }

  /*
   * O contrato pode ter sido encerrado
   * depois que a publicação foi criada.
   *
   * Ainda permitimos editar a publicação
   * existente, pois ela pertence ao
   * histórico/planejamento da edição.
   */

  /*
   * =====================================================
   * VALIDAR CADERNO / POSIÇÃO
   * =====================================================
   */

  const placementResult =
    await validatePublicationPlacement(
      supabase,
      {
        editionId:
          input.editionId,

        sectionId:
          input.sectionId,

        adPositionId:
          input.adPositionId,

        /*
         * IMPORTANTE:
         *
         * A própria publicação não pode
         * consumir uma vaga ao validar a
         * posição em que ela já está.
         */

        ignorePublicationId:
          input.publicationId,
      }
    );

  if (
    !placementResult.success
  ) {
    return placementResult;
  }

  /*
   * =====================================================
   * ATUALIZAR
   * =====================================================
   */

  const {
    error:
      updateError,
  } =
    await supabase
      .from(
        "contract_edition_publications"
      )
      .update({
        section_id:
          placementResult.sectionId,

        ad_position_id:
          placementResult.adPositionId,

        size_description:
          input.sizeDescription
            ?.trim() ||
          null,

        amount:
          roundMoney(
            input.amount
          ),

        notes:
          input.notes
            ?.trim() ||
          null,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        input.publicationId
      )
      .eq(
        "edition_id",
        input.editionId
      )
      .eq(
        "active",
        true
      );

  if (
    updateError
  ) {
    console.error(
      "Erro ao atualizar publicação:",
      updateError
    );

    return {
      success: false,

      error:
        updateError.message,
    };
  }

  revalidateEditionPaths(
    input.editionId,
    publication.contract_id
  );

  return {
    success: true,
  };
}

/*
 * =====================================================
 * REMOVER VÍNCULO
 * =====================================================
 */

export async function removeContractPublicationFromEdition(
  publicationId:
    string,
  editionId:
    string
) {
  const access =
    await requireEstafetaAccess();

  if (
    !publicationId ||
    !editionId
  ) {
    return {
      success: false,

      error:
        "Publicação inválida.",
    };
  }

  const supabase =
    await createClient();

  /*
   * =====================================================
   * EDIÇÃO
   * =====================================================
   */

  const editionResult =
    await validateEdition(
      supabase,
      access
        .estafetaCompany
        .id,
      editionId
    );

  if (
    !editionResult.success
  ) {
    return editionResult;
  }

  /*
   * =====================================================
   * PUBLICAÇÃO
   * =====================================================
   */

  const {
    data:
      publication,
    error:
      publicationError,
  } =
    await supabase
      .from(
        "contract_edition_publications"
      )
      .select(`
        id,
        contract_id,
        edition_id,
        active
      `)
      .eq(
        "id",
        publicationId
      )
      .eq(
        "edition_id",
        editionId
      )
      .maybeSingle();

  if (
    publicationError ||
    !publication
  ) {
    return {
      success: false,

      error:
        "Publicação não encontrada.",
    };
  }

  if (
    !publication.active
  ) {
    return {
      success: false,

      error:
        "Esta publicação já está desvinculada.",
    };
  }

  /*
   * =====================================================
   * INATIVAR
   * =====================================================
   */

  const {
    error:
      updateError,
  } =
    await supabase
      .from(
        "contract_edition_publications"
      )
      .update({
        active:
          false,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        publicationId
      )
      .eq(
        "edition_id",
        editionId
      );

  if (
    updateError
  ) {
    return {
      success: false,

      error:
        updateError.message,
    };
  }

  revalidateEditionPaths(
    editionId,
    publication.contract_id
  );

  return {
    success: true,
  };
}

/*
 * =====================================================
 * VALIDAR EDIÇÃO
 * =====================================================
 */

async function validateEdition(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  companyId:
    string,
  editionId:
    string
) {
  const {
    data:
      edition,
    error,
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
      .eq(
        "company_id",
        companyId
      )
      .maybeSingle();

  if (
    error ||
    !edition
  ) {
    return {
      success:
        false as const,

      error:
        "Edição não encontrada.",
    };
  }

  if (
    edition.status !==
    "open"
  ) {
    return {
      success:
        false as const,

      error:
        "Esta operação só pode ser realizada em uma edição aberta.",
    };
  }

  return {
    success:
      true as const,

    edition,
  };
}

/*
 * =====================================================
 * VALIDAR CADERNO / POSIÇÃO
 * =====================================================
 */

async function validatePublicationPlacement(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  input: {
    editionId: string;

    sectionId?:
      | string
      | null;

    adPositionId?:
      | string
      | null;

    ignorePublicationId:
      | string
      | null;
  }
) {
  const sectionId =
    input.sectionId
      ?.trim() ||
    null;

  const adPositionId =
    input.adPositionId
      ?.trim() ||
    null;

  /*
   * =====================================================
   * CADERNO
   * =====================================================
   */

  if (
    sectionId
  ) {
    const {
      data:
        section,
      error:
        sectionError,
    } =
      await supabase
        .from(
          "edition_sections"
        )
        .select(`
          id,
          edition_id,
          active
        `)
        .eq(
          "id",
          sectionId
        )
        .eq(
          "edition_id",
          input.editionId
        )
        .maybeSingle();

    if (
      sectionError ||
      !section ||
      !section.active
    ) {
      return {
        success:
          false as const,

        error:
          "O caderno selecionado é inválido ou está inativo.",
      };
    }
  }

  /*
   * =====================================================
   * SEM POSIÇÃO
   * =====================================================
   */

  if (
    !adPositionId
  ) {
    return {
      success:
        true as const,

      sectionId,

      adPositionId:
        null,
    };
  }

  /*
   * =====================================================
   * POSIÇÃO
   * =====================================================
   */

  const {
    data:
      position,
    error:
      positionError,
  } =
    await supabase
      .from(
        "edition_ad_positions"
      )
      .select(`
        id,
        edition_id,
        section_id,
        name,
        capacity,
        manually_blocked,
        blocked_reason,
        active
      `)
      .eq(
        "id",
        adPositionId
      )
      .eq(
        "edition_id",
        input.editionId
      )
      .maybeSingle();

  if (
    positionError ||
    !position
  ) {
    return {
      success:
        false as const,

      error:
        "A posição selecionada é inválida.",
    };
  }

  if (
    !position.active
  ) {
    return {
      success:
        false as const,

      error:
        "A posição selecionada está inativa.",
    };
  }

  /*
   * =====================================================
   * BLOQUEIO MANUAL
   * =====================================================
   *
   * Se estiver editando uma publicação
   * que JÁ usa essa posição, permitimos
   * manter a posição mesmo que o admin
   * tenha bloqueado depois.
   *
   * Porém não permitimos mover uma nova
   * publicação para uma posição bloqueada.
   */

  let publicationUsesCurrentPosition =
    false;

  if (
    input.ignorePublicationId
  ) {
    const {
      data:
        currentPublication,
    } =
      await supabase
        .from(
          "contract_edition_publications"
        )
        .select(`
          id,
          ad_position_id
        `)
        .eq(
          "id",
          input.ignorePublicationId
        )
        .eq(
          "edition_id",
          input.editionId
        )
        .maybeSingle();

    publicationUsesCurrentPosition =
      currentPublication
        ?.ad_position_id ===
      adPositionId;
  }

  if (
    position.manually_blocked &&
    !publicationUsesCurrentPosition
  ) {
    return {
      success:
        false as const,

      error:
        position.blocked_reason
          ? `A posição "${position.name}" está bloqueada: ${position.blocked_reason}`
          : `A posição "${position.name}" está bloqueada.`,
    };
  }

  /*
   * =====================================================
   * CADERNO DA POSIÇÃO
   * =====================================================
   */

  if (
    sectionId &&
    position.section_id !==
      sectionId
  ) {
    return {
      success:
        false as const,

      error:
        "A posição selecionada não pertence ao caderno informado.",
    };
  }

  if (
    !sectionId &&
    position.section_id !==
      null
  ) {
    return {
      success:
        false as const,

      error:
        "Esta posição pertence a um caderno. Selecione o caderno correspondente.",
    };
  }

  /*
   * =====================================================
   * CAPACIDADE
   * =====================================================
   */

  if (
    position.capacity !==
    null
  ) {
    /*
     * =========================================
     * USO POR CONTRATOS
     * =========================================
     */

    let contractUsageQuery =
      supabase
        .from(
          "contract_edition_publications"
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
          input.editionId
        )
        .eq(
          "ad_position_id",
          adPositionId
        )
        .eq(
          "active",
          true
        );

    /*
     * Ao editar, exclui a própria
     * publicação da contagem.
     */

    if (
      input.ignorePublicationId
    ) {
      contractUsageQuery =
        contractUsageQuery
          .neq(
            "id",
            input.ignorePublicationId
          );
    }

    const {
      count:
        contractUsageCount,
      error:
        contractUsageError,
    } =
      await contractUsageQuery;

    if (
      contractUsageError
    ) {
      console.error(
        "Erro ao verificar ocupação por contratos:",
        contractUsageError
      );

      return {
        success:
          false as const,

        error:
          "Não foi possível verificar a ocupação da posição.",
      };
    }

    /*
     * =========================================
     * USO POR VENDAS AVULSAS
     * =========================================
     */

    const {
      data:
        saleItems,
      error:
        saleItemsError,
    } =
      await supabase
        .from(
          "edition_sale_items"
        )
        .select(`
          id,

          sale:edition_sales!inner (
            id,
            edition_id,
            status
          )
        `)
        .eq(
          "ad_position_id",
          adPositionId
        )
        .eq(
          "sale.edition_id",
          input.editionId
        )
        .eq(
          "sale.status",
          "confirmed"
        );

    if (
      saleItemsError
    ) {
      console.error(
        "Erro ao verificar vendas da posição:",
        saleItemsError
      );

      return {
        success:
          false as const,

        error:
          "Não foi possível verificar a ocupação da posição.",
      };
    }

    /*
     * =================================================
     * TOTAL SEM A PRÓPRIA PUBLICAÇÃO
     * =================================================
     */

    const totalUsageBeforeThisPublication =
      Number(
        contractUsageCount ??
          0
      ) +
      (
        saleItems ??
        []
      ).length;

    if (
      totalUsageBeforeThisPublication >=
      Number(
        position.capacity
      )
    ) {
      return {
        success:
          false as const,

        error:
          `A posição "${position.name}" já atingiu sua capacidade.`,
      };
    }
  }

  return {
    success:
      true as const,

    sectionId,

    adPositionId,
  };
}

/*
 * =====================================================
 * REVALIDAÇÃO
 * =====================================================
 */

function revalidateEditionPaths(
  editionId:
    string,
  contractId:
    string
) {
  revalidatePath(
    "/edicoes"
  );

  revalidatePath(
    `/edicoes/${editionId}`
  );

  revalidatePath(
    `/contratos/${contractId}`
  );
}

/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

function roundMoney(
  value:
    number
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