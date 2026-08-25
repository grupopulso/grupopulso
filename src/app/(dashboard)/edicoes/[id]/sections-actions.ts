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

type CreateSectionInput = {
  editionId: string;
  name: string;
  description?: string;
};

type UpdateSectionInput = {
  id: string;
  editionId: string;
  name: string;
  description?: string;
};

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

  if (!input.editionId) {
    return {
      success: false,
      message:
        "Edição inválida.",
    };
  }

  if (!name) {
    return {
      success: false,
      message:
        "Informe o nome do caderno.",
    };
  }

  const supabase =
    await createClient();

  /*
   * Confirma que a edição
   * pertence ao O Estafeta
   * e está aberta.
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
   * Evita dois cadernos
   * com o mesmo nome.
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

  if (existingError) {
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

  if (existing) {
    return {
      success: false,
      message:
        "Já existe um caderno com este nome nesta edição.",
    };
  }

  const {
    error,
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

        active:
          true,
      });

  if (error) {
    console.error(
      "Erro ao criar caderno:",
      error
    );

    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    `/edicoes/${input.editionId}`
  );

  revalidatePath(
    `/edicoes/${input.editionId}/vendas/nova`
  );

  return {
    success: true,
  };
}

/*
 * =========================================
 * EDITAR CADERNO
 * =========================================
 */

export async function updateEditionSection(
  input: UpdateSectionInput
) {
  const access =
    await requireEstafetaAccess();

  const name =
    input.name.trim();

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

  if (!name) {
    return {
      success: false,
      message:
        "Informe o nome do caderno.",
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
        input.editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (!edition) {
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
        name,

        description:
          input.description
            ?.trim() ||
          null,
      })
      .eq(
        "id",
        input.id
      )
      .eq(
        "edition_id",
        input.editionId
      );

  if (error) {
    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    `/edicoes/${input.editionId}`
  );

  revalidatePath(
    `/edicoes/${input.editionId}/vendas/nova`
  );

  return {
    success: true,
  };
}

/*
 * =========================================
 * ATIVAR / DESATIVAR
 * =========================================
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

  if (!edition) {
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

  if (error) {
    return {
      success: false,
      message:
        error.message,
    };
  }

  revalidatePath(
    `/edicoes/${editionId}`
  );

  revalidatePath(
    `/edicoes/${editionId}/vendas/nova`
  );

  return {
    success: true,
  };
}