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

type CreateEditionInput = {
  companyId: string;
  name: string;
  editionNumber?: string;
  publicationDate: string;
  notes?: string;
};

type UpdateEditionInput = {
  id: string;
  name: string;
  editionNumber?: string;
  publicationDate: string;
  notes?: string;
};

/*
 * =========================================
 * CRIAR EDIÇÃO
 * =========================================
 */

export async function createEdition(
  input: CreateEditionInput
) {
  const access =
    await requireEstafetaAccess();

  const name =
    input.name.trim();

  const editionNumber =
    input.editionNumber
      ?.trim() || null;

  const notes =
    input.notes
      ?.trim() || null;

  if (!name) {
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

  /*
   * Não confiamos no companyId
   * enviado pelo formulário.
   *
   * A empresa oficial da edição
   * é sempre O Estafeta.
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

  const {
    data: edition,
    error,
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

        status:
          "open",

        notes,
      })
      .select(`
        id
      `)
      .single();

  if (
    error ||
    !edition
  ) {
    console.error(
      "Erro ao criar edição:",
      error
    );

    return {
      success: false,
      message:
        error?.message ??
        "Não foi possível criar a edição.",
    };
  }

  revalidatePath(
    "/edicoes"
  );

  return {
    success: true,
    id: edition.id,
  };
}

/*
 * =========================================
 * EDITAR EDIÇÃO
 * =========================================
 */

export async function updateEdition(
  input: UpdateEditionInput
) {
  const access =
    await requireEstafetaAccess();

  const name =
    input.name.trim();

  if (!input.id) {
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
   * Confirma que a edição pertence
   * realmente ao O Estafeta.
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

  const {
    error,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .update({
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
      })
      .eq(
        "id",
        input.id
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      );

  if (error) {
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
 * =========================================
 * ALTERAR STATUS
 * =========================================
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

  if (!editionId) {
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

  if (error) {
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
 * =========================================
 * FECHAR EDIÇÃO
 * =========================================
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
 * =========================================
 * REABRIR EDIÇÃO
 * =========================================
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
 * =========================================
 * CANCELAR EDIÇÃO
 * =========================================
 */

export async function cancelEdition(
  editionId: string
) {
  const access =
    await requireEstafetaAccess();

  if (!editionId) {
    return {
      success: false,
      message:
        "Edição inválida.",
    };
  }

  const supabase =
    await createClient();

  /*
   * Primeiro confirma que a edição
   * pertence ao O Estafeta.
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
   * Não permitimos cancelar uma
   * edição que já tenha vendas
   * confirmadas.
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

  if (salesError) {
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
    (count ?? 0) >
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