import { createAdminClient } from "@/app/lib/supabase/admin";
import { createAuditLog } from "@/app/lib/audit";
import {
  O_ESTAFETA_COMPANY_ID,
  resolveCompanyPlaceholderSellerIds,
} from "@/app/lib/company-placeholder-sellers";

type ReassignResult =
  | {
      success: true;
      contractsMoved: number;
      salesMoved: number;
    }
  | {
      success: false;
      message: string;
    };

/*
 * Reatribui os contratos (por empresa) e as vendas de edição de um
 * usuário inativo para o "vendedor da empresa" correspondente. Só
 * funciona a partir do mês seguinte ao da saída (regra combinada
 * com o cliente em 24/09) e só uma vez por saída — reativar o
 * usuário limpa a marcação e permite reatribuir de novo numa
 * futura saída.
 *
 * Sem checagem de permissão aqui de propósito: é chamada tanto
 * pela action do admin (que já confere requireAdmin) quanto pelo
 * cron mensal (que confere o CRON_SECRET, não tem sessão de
 * usuário).
 */
export async function reassignInactiveUser(
  adminDb: ReturnType<
    typeof createAdminClient
  >,
  userId: string
): Promise<ReassignResult> {
  const { data: profile } = await adminDb
    .from("user_profiles")
    .select(
      "id, name, active, deactivated_at, reassigned_at"
    )
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return {
      success: false,
      message: "Usuário não encontrado.",
    };
  }

  if (profile.active) {
    return {
      success: false,
      message:
        "Este usuário está ativo — nada a reatribuir.",
    };
  }

  if (!profile.deactivated_at) {
    return {
      success: false,
      message:
        "Data de saída não registrada para este usuário.",
    };
  }

  if (profile.reassigned_at) {
    return {
      success: false,
      message:
        "Os contratos e vendas deste usuário já foram reatribuídos.",
    };
  }

  const now = new Date();

  const startOfCurrentMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const deactivatedAt = new Date(
    profile.deactivated_at
  );

  if (deactivatedAt >= startOfCurrentMonth) {
    return {
      success: false,
      message:
        "A reatribuição só pode ser feita a partir do mês seguinte à saída.",
    };
  }

  const placeholderIdByCompany =
    await resolveCompanyPlaceholderSellerIds(
      adminDb
    );

  if (
    Object.keys(placeholderIdByCompany)
      .length === 0
  ) {
    return {
      success: false,
      message:
        "Nenhum usuário \"vendedor da empresa\" foi encontrado. Crie os usuários placeholder (Vendedor Atthus, Vendedor Pottencializa, Vendedor O Estafeta) antes de reatribuir.",
    };
  }

  let contractsMoved = 0;

  for (const [
    companyId,
    placeholderId,
  ] of Object.entries(
    placeholderIdByCompany
  )) {
    const {
      data: moved,
      error: moveError,
    } = await adminDb
      .from("contracts")
      .update({
        responsible_user_id:
          placeholderId,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "responsible_user_id",
        userId
      )
      .eq(
        "company_id",
        companyId
      )
      .select("id");

    if (moveError) {
      return {
        success: false,
        message: `Erro ao reatribuir contratos: ${moveError.message}`,
      };
    }

    contractsMoved +=
      moved?.length ?? 0;
  }

  let salesMoved = 0;

  const oEstafetaPlaceholderId =
    placeholderIdByCompany[
      O_ESTAFETA_COMPANY_ID
    ];

  if (oEstafetaPlaceholderId) {
    const {
      data: movedSales,
      error: salesError,
    } = await adminDb
      .from("edition_sales")
      .update({
        seller_user_id:
          oEstafetaPlaceholderId,
      })
      .eq(
        "seller_user_id",
        userId
      )
      .select("id");

    if (salesError) {
      return {
        success: false,
        message: `Erro ao reatribuir vendas de edição: ${salesError.message}`,
      };
    }

    salesMoved =
      movedSales?.length ?? 0;
  }

  await adminDb
    .from("user_profiles")
    .update({
      reassigned_at:
        new Date().toISOString(),
    })
    .eq("id", userId);

  await createAuditLog({
    module: "settings",
    action: "update",
    entityType: "user",
    entityId: userId,
    description: `Contratos e vendas de "${
      profile.name ?? "usuário"
    }" (inativo) foram reatribuídos para os vendedores das respectivas empresas: ${contractsMoved} contrato(s) e ${salesMoved} venda(s) de edição.`,
    oldData: {
      responsibleUserId: userId,
    },
    newData: {
      contractsMoved,
      salesMoved,
    },
  });

  return {
    success: true,
    contractsMoved,
    salesMoved,
  };
}
