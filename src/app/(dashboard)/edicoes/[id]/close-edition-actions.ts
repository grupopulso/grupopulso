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

export async function closeEditionWithValidation(
  editionId: string
) {
  const access =
    await requireEstafetaAccess();

  const supabase =
    await createClient();

  if (!editionId) {
    return {
      success: false,
      error: "Edição inválida.",
      issues: [],
    };
  }

  /*
   * =====================================================
   * EDIÇÃO
   * =====================================================
   */

  const {
    data: edition,
    error: editionError,
  } =
    await supabase
      .from("newspaper_editions")
      .select(`
        id,
        company_id,
        name,
        status
      `)
      .eq("id", editionId)
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
      error:
        "Edição não encontrada.",
      issues: [],
    };
  }

  if (
    edition.status ===
    "closed"
  ) {
    return {
      success: false,
      error:
        "Esta edição já está fechada.",
      issues: [],
    };
  }

  if (
    edition.status ===
    "cancelled"
  ) {
    return {
      success: false,
      error:
        "Uma edição cancelada não pode ser fechada.",
      issues: [],
    };
  }

  /*
   * =====================================================
   * PUBLICAÇÕES DE CONTRATOS
   * =====================================================
   */

  const {
    data:
      contractPublications,
    error:
      contractPublicationsError,
  } =
    await supabase
      .from(
        "contract_edition_publications"
      )
      .select(`
        id,
        ad_position_id,
        size_description,
        active
      `)
      .eq(
        "edition_id",
        editionId
      )
      .eq(
        "active",
        true
      );

  if (
    contractPublicationsError
  ) {
    console.error(
      "Erro ao validar publicações de contrato:",
      contractPublicationsError
    );

    return {
      success: false,
      error:
        "Não foi possível validar as publicações dos contratos.",
      issues: [],
    };
  }

  const activeContractPublications =
    contractPublications ??
    [];

  const contractWithoutPosition =
    activeContractPublications.filter(
      (
        publication
      ) =>
        !publication
          .ad_position_id
    );

  const contractWithoutSize =
    activeContractPublications.filter(
      (
        publication
      ) =>
        !publication
          .size_description
          ?.trim()
    );

  /*
   * =====================================================
   * VENDAS AVULSAS
   * =====================================================
   */

  const {
    data: sales,
    error: salesError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .select(`
        id,
        status
      `)
      .eq(
        "edition_id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      );

  if (
    salesError
  ) {
    return {
      success: false,
      error:
        "Não foi possível validar as vendas avulsas.",
      issues: [],
    };
  }

  const draftSales =
    (
      sales ??
      []
    ).filter(
      (
        sale
      ) =>
        sale.status ===
        "draft"
    );

  /*
   * =====================================================
   * ITENS CONFIRMADOS
   * =====================================================
   */

  const {
    data:
      confirmedSaleItems,
    error:
      saleItemsError,
  } =
    await supabase
      .from(
        "edition_sale_items"
      )
      .select(`
        id,
        ad_position_id,
        size_description,

        sale:edition_sales!inner (
          id,
          edition_id,
          company_id,
          status
        )
      `)
      .eq(
        "sale.edition_id",
        editionId
      )
      .eq(
        "sale.company_id",
        access.estafetaCompany.id
      )
      .eq(
        "sale.status",
        "confirmed"
      );

  if (
    saleItemsError
  ) {
    console.error(
      "Erro ao validar itens avulsos:",
      saleItemsError
    );

    return {
      success: false,
      error:
        "Não foi possível validar os anúncios avulsos.",
      issues: [],
    };
  }

  const standaloneItems =
    confirmedSaleItems ??
    [];

  const standaloneWithoutPosition =
    standaloneItems.filter(
      (
        item
      ) =>
        !item
          .ad_position_id
    );

  const standaloneWithoutSize =
    standaloneItems.filter(
      (
        item
      ) =>
        !item
          .size_description
          ?.trim()
    );

  /*
   * =====================================================
   * POSIÇÕES UTILIZADAS
   * =====================================================
   */

  const usedPositionIds =
    [
      ...new Set(
        [
          ...activeContractPublications.map(
            (
              publication
            ) =>
              publication
                .ad_position_id
          ),

          ...standaloneItems.map(
            (
              item
            ) =>
              item
                .ad_position_id
          ),
        ].filter(
          (
            value
          ): value is string =>
            Boolean(
              value
            )
        )
      ),
    ];

  let blockedPositions =
    0;

  let inactivePositions =
    0;

  if (
    usedPositionIds.length >
    0
  ) {
    const {
      data: positions,
      error:
        positionsError,
    } =
      await supabase
        .from(
          "edition_ad_positions"
        )
        .select(`
          id,
          active,
          manually_blocked
        `)
        .eq(
          "edition_id",
          editionId
        )
        .in(
          "id",
          usedPositionIds
        );

    if (
      positionsError
    ) {
      return {
        success: false,
        error:
          "Não foi possível validar as posições da edição.",
        issues: [],
      };
    }

    blockedPositions =
      (
        positions ??
        []
      ).filter(
        (
          position
        ) =>
          position
            .manually_blocked
      ).length;

    inactivePositions =
      (
        positions ??
        []
      ).filter(
        (
          position
        ) =>
          !position.active
      ).length;
  }

  /*
   * =====================================================
   * PENDÊNCIAS
   * =====================================================
   */

  const issues:
    string[] =
    [];

  if (
    contractWithoutPosition.length >
    0
  ) {
    issues.push(
      `${contractWithoutPosition.length} publicação(ões) de contrato sem posição definida.`
    );
  }

  if (
    contractWithoutSize.length >
    0
  ) {
    issues.push(
      `${contractWithoutSize.length} publicação(ões) de contrato sem tamanho definido.`
    );
  }

  if (
    standaloneWithoutPosition.length >
    0
  ) {
    issues.push(
      `${standaloneWithoutPosition.length} anúncio(s) avulso(s) sem posição definida.`
    );
  }

  if (
    standaloneWithoutSize.length >
    0
  ) {
    issues.push(
      `${standaloneWithoutSize.length} anúncio(s) avulso(s) sem tamanho definido.`
    );
  }

  if (
    draftSales.length >
    0
  ) {
    issues.push(
      `${draftSales.length} venda(s) avulsa(s) ainda estão em rascunho.`
    );
  }

  if (
    blockedPositions >
    0
  ) {
    issues.push(
      `${blockedPositions} posição(ões) utilizadas estão bloqueadas.`
    );
  }

  if (
    inactivePositions >
    0
  ) {
    issues.push(
      `${inactivePositions} posição(ões) utilizadas estão inativas.`
    );
  }

  if (
    issues.length >
    0
  ) {
    return {
      success: false,
      error:
        "A edição possui pendências e não pode ser fechada.",
      issues,
    };
  }

  /*
   * =====================================================
   * FECHAR
   * =====================================================
   */

  const {
    data:
      updatedEdition,
    error:
      updateError,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .update({
        status:
          "closed",

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
      )
      .eq(
        "status",
        "open"
      )
      .select(`
        id
      `)
      .maybeSingle();

  if (
    updateError
  ) {
    return {
      success: false,
      error:
        updateError.message,
      issues: [],
    };
  }

  if (
    !updatedEdition
  ) {
    return {
      success: false,
      error:
        "A edição não pôde ser fechada porque seu status foi alterado.",
      issues: [],
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
    issues: [],
  };

  
}

export async function reopenEdition(
  editionId: string
) {
  const access =
    await requireEstafetaAccess();

  const supabase =
    await createClient();

  if (!editionId) {
    return {
      success: false,
      error: "Edição inválida.",
    };
  }

  /*
   * Buscar edição
   */

  const {
    data: edition,
    error: editionError,
  } =
    await supabase
      .from("newspaper_editions")
      .select(`
        id,
        company_id,
        status
      `)
      .eq("id", editionId)
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
      error:
        "Edição não encontrada.",
    };
  }

  if (
    edition.status !==
    "closed"
  ) {
    return {
      success: false,
      error:
        "Somente edições fechadas podem ser reabertas.",
    };
  }

  /*
   * Reabrir
   */

  const {
    data: updatedEdition,
    error: updateError,
  } =
    await supabase
      .from("newspaper_editions")
      .update({
        status: "open",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", editionId)
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .eq(
        "status",
        "closed"
      )
      .select("id")
      .maybeSingle();

  if (updateError) {
    console.error(
      "Erro ao reabrir edição:",
      updateError
    );

    return {
      success: false,
      error:
        updateError.message,
    };
  }

  if (!updatedEdition) {
    return {
      success: false,
      error:
        "Não foi possível reabrir a edição.",
    };
  }

  revalidatePath(
    "/edicoes"
  );

  revalidatePath(
    `/edicoes/${editionId}`
  );

  revalidatePath(
    `/edicoes/${editionId}/espelho`
  );

  return {
    success: true,
  };
}