"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

/*
 * Divisão de lucro entre sócios existe hoje só para a Agência
 * Atthus e a Pottencializa (regra combinada com o cliente em
 * 27/08). Trava aqui evita que a funcionalidade seja usada, por
 * engano ou não, com outra empresa do grupo.
 */
const PARTNER_COMPANY_IDS = [
  "a500a41f-9d6b-4cd6-af06-5920a0631dc1", // Agência Atthus
  "9d08d74c-c5fe-48c9-b0c5-382cea273d99", // Pottencializa
];

function isPartnerCompany(
  companyId: string
) {
  return PARTNER_COMPANY_IDS.includes(
    companyId
  );
}

function buildSociosRedirect(
  month: string,
  error?: string
) {
  const params = new URLSearchParams();

  if (month) {
    params.set("mes", month);
  }

  if (error) {
    params.set("error", error);
  }

  const queryString =
    params.toString();

  return queryString
    ? `/financeiro/socios?${queryString}`
    : "/financeiro/socios";
}

export async function createPartnerWithdrawal(
  formData: FormData
) {
  await requireModulePermission(
    "financial",
    "create"
  );

  const companyId = String(
    formData.get("company_id") ?? ""
  ).trim();

  const userId = String(
    formData.get("user_id") ?? ""
  ).trim();

  const amountRaw = String(
    formData.get("amount") ?? ""
  ).trim();

  const withdrawalDate = String(
    formData.get("withdrawal_date") ?? ""
  ).trim();

  const notes = String(
    formData.get("notes") ?? ""
  ).trim();

  const month = String(
    formData.get("mes") ?? ""
  ).trim();

  const amount = Number(
    amountRaw.replace(",", ".")
  );

  if (
    !companyId ||
    !userId ||
    !withdrawalDate ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    redirect(
      buildSociosRedirect(
        month,
        "campos"
      )
    );
  }

  if (!isPartnerCompany(companyId)) {
    redirect(
      buildSociosRedirect(
        month,
        "empresa"
      )
    );
  }

  await requireCompanyAccess(companyId);

  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("company_partners")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (!partner) {
    redirect(
      buildSociosRedirect(
        month,
        "socio"
      )
    );
  }

  const { data: partnerProfile } =
    await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();

  const { data: entry, error: entryError } =
    await supabase
      .from("financial_entries")
      .insert({
        company_id: companyId,
        type: "expense",
        description: `Adiantamento de sócio${
          partnerProfile?.name
            ? `: ${partnerProfile.name}`
            : ""
        }`,
        issue_date: withdrawalDate,
        competence_date: withdrawalDate,
        due_date: withdrawalDate,
        amount,
        amount_paid: amount,
        interest: 0,
        fine: 0,
        discount: 0,
        status: "paid",
        recurring: false,
        recurrence_frequency: null,
        notes: notes || null,
      })
      .select("id")
      .single();

  if (entryError || !entry) {
    console.error(
      "Erro ao criar lançamento do adiantamento:",
      entryError
    );

    redirect(
      buildSociosRedirect(
        month,
        "salvar"
      )
    );
  }

  const { error: withdrawalError } =
    await supabase
      .from("partner_withdrawals")
      .insert({
        company_id: companyId,
        user_id: userId,
        amount,
        withdrawal_date: withdrawalDate,
        notes: notes || null,
        financial_entry_id: entry.id,
      });

  if (withdrawalError) {
    console.error(
      "Erro ao registrar adiantamento:",
      withdrawalError
    );

    /*
     * Evita deixar um lançamento financeiro órfão
     * caso o registro do adiantamento em si falhe.
     */
    await supabase
      .from("financial_entries")
      .delete()
      .eq("id", entry.id);

    redirect(
      buildSociosRedirect(
        month,
        "salvar"
      )
    );
  }

  revalidatePath("/financeiro/socios");
  revalidatePath("/financeiro");

  redirect(
    buildSociosRedirect(month)
  );
}

export async function deletePartnerWithdrawal(
  withdrawalId: string
) {
  await requireModulePermission(
    "financial",
    "delete"
  );

  const supabase = await createClient();

  const { data: withdrawal } = await supabase
    .from("partner_withdrawals")
    .select(
      "id, company_id, financial_entry_id"
    )
    .eq("id", withdrawalId)
    .maybeSingle();

  if (!withdrawal) {
    return {
      success: false,
      message:
        "Adiantamento não encontrado.",
    };
  }

  if (
    !isPartnerCompany(
      withdrawal.company_id
    )
  ) {
    return {
      success: false,
      message: "Empresa inválida.",
    };
  }

  await requireCompanyAccess(
    withdrawal.company_id
  );

  const { error } = await supabase
    .from("partner_withdrawals")
    .delete()
    .eq("id", withdrawalId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  if (withdrawal.financial_entry_id) {
    await supabase
      .from("financial_entries")
      .delete()
      .eq(
        "id",
        withdrawal.financial_entry_id
      );
  }

  revalidatePath("/financeiro/socios");
  revalidatePath("/financeiro");

  return {
    success: true,
  };
}

/*
 * =====================================================
 * APORTE DE CAPITAL DOS SÓCIOS
 * =====================================================
 *
 * Entrada de dinheiro que um sócio coloca na empresa.
 * Gera um lançamento de receita já quitado (só para o
 * caixa) — mas a tela de sócios EXCLUI esse lançamento
 * do "Recebido", da mesma forma que exclui o adiantamento
 * do "Pago": aporte não é receita operacional e não
 * entra na divisão de lucro.
 */

export async function createPartnerContribution(
  formData: FormData
) {
  await requireModulePermission(
    "financial",
    "create"
  );

  const companyId = String(
    formData.get("company_id") ?? ""
  ).trim();

  const userId = String(
    formData.get("user_id") ?? ""
  ).trim();

  const amountRaw = String(
    formData.get("amount") ?? ""
  ).trim();

  const contributionDate = String(
    formData.get("contribution_date") ?? ""
  ).trim();

  const notes = String(
    formData.get("notes") ?? ""
  ).trim();

  const month = String(
    formData.get("mes") ?? ""
  ).trim();

  const amount = Number(
    amountRaw.replace(",", ".")
  );

  if (
    !companyId ||
    !userId ||
    !contributionDate ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    redirect(
      buildSociosRedirect(month, "campos")
    );
  }

  if (!isPartnerCompany(companyId)) {
    redirect(
      buildSociosRedirect(month, "empresa")
    );
  }

  await requireCompanyAccess(companyId);

  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("company_partners")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (!partner) {
    redirect(
      buildSociosRedirect(month, "socio")
    );
  }

  const { data: partnerProfile } =
    await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();

  const { data: entry, error: entryError } =
    await supabase
      .from("financial_entries")
      .insert({
        company_id: companyId,
        type: "income",
        description: `Aporte de capital de sócio${
          partnerProfile?.name
            ? `: ${partnerProfile.name}`
            : ""
        }`,
        issue_date: contributionDate,
        competence_date: contributionDate,
        due_date: contributionDate,
        amount,
        amount_paid: amount,
        interest: 0,
        fine: 0,
        discount: 0,
        status: "paid",
        recurring: false,
        recurrence_frequency: null,
        notes: notes || null,
      })
      .select("id")
      .single();

  if (entryError || !entry) {
    console.error(
      "Erro ao criar lançamento do aporte:",
      entryError
    );

    redirect(
      buildSociosRedirect(month, "salvar")
    );
  }

  const { error: contributionError } =
    await supabase
      .from("partner_contributions")
      .insert({
        company_id: companyId,
        user_id: userId,
        amount,
        contribution_date: contributionDate,
        notes: notes || null,
        financial_entry_id: entry.id,
      });

  if (contributionError) {
    console.error(
      "Erro ao registrar aporte:",
      contributionError
    );

    await supabase
      .from("financial_entries")
      .delete()
      .eq("id", entry.id);

    redirect(
      buildSociosRedirect(month, "salvar")
    );
  }

  revalidatePath("/financeiro/socios");
  revalidatePath("/financeiro");

  redirect(buildSociosRedirect(month));
}

export async function deletePartnerContribution(
  contributionId: string
) {
  await requireModulePermission(
    "financial",
    "delete"
  );

  const supabase = await createClient();

  const { data: contribution } =
    await supabase
      .from("partner_contributions")
      .select(
        "id, company_id, financial_entry_id"
      )
      .eq("id", contributionId)
      .maybeSingle();

  if (!contribution) {
    return {
      success: false,
      message: "Aporte não encontrado.",
    };
  }

  if (
    !isPartnerCompany(
      contribution.company_id
    )
  ) {
    return {
      success: false,
      message: "Empresa inválida.",
    };
  }

  await requireCompanyAccess(
    contribution.company_id
  );

  const { error } = await supabase
    .from("partner_contributions")
    .delete()
    .eq("id", contributionId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  if (contribution.financial_entry_id) {
    await supabase
      .from("financial_entries")
      .delete()
      .eq(
        "id",
        contribution.financial_entry_id
      );
  }

  revalidatePath("/financeiro/socios");
  revalidatePath("/financeiro");

  return { success: true };
}

export async function saveCompanyPartner(
  formData: FormData
) {
  await requireModulePermission(
    "financial",
    "edit"
  );

  const companyId = String(
    formData.get("company_id") ?? ""
  ).trim();

  const userId = String(
    formData.get("user_id") ?? ""
  ).trim();

  const month = String(
    formData.get("mes") ?? ""
  ).trim();

  if (!companyId || !userId) {
    redirect(
      buildSociosRedirect(
        month,
        "socio-campos"
      )
    );
  }

  if (!isPartnerCompany(companyId)) {
    redirect(
      buildSociosRedirect(
        month,
        "empresa"
      )
    );
  }

  await requireCompanyAccess(companyId);

  const supabase = await createClient();

  /*
   * Não existe percentual customizado: os 75% dos
   * sócios são sempre divididos em partes iguais entre
   * os sócios ativos (regra combinada com o cliente em
   * 27/08). O valor gravado aqui é só para satisfazer a
   * coluna (obrigatória, > 0); o cálculo de verdade, na
   * tela, sempre recalcula na hora com base em quantos
   * sócios estão ativos naquele momento — então continua
   * correto mesmo depois de ativar/desativar alguém.
   */
  const { count: activeCount } = await supabase
    .from("company_partners")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("company_id", companyId)
    .eq("active", true);

  const estimatedPercentage = Number(
    (
      100 /
      ((activeCount ?? 0) + 1)
    ).toFixed(2)
  );

  const { error } = await supabase
    .from("company_partners")
    .upsert(
      {
        company_id: companyId,
        user_id: userId,
        percentage: estimatedPercentage,
        active: true,
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict: "company_id,user_id",
      }
    );

  if (error) {
    console.error(
      "Erro ao salvar sócio:",
      error
    );

    redirect(
      buildSociosRedirect(
        month,
        "socio-salvar"
      )
    );
  }

  revalidatePath("/financeiro/socios");

  redirect(
    buildSociosRedirect(month)
  );
}

export async function togglePartnerActive(
  partnerId: string,
  active: boolean
) {
  await requireModulePermission(
    "financial",
    "edit"
  );

  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("company_partners")
    .select("id, company_id")
    .eq("id", partnerId)
    .maybeSingle();

  if (!partner) {
    return {
      success: false,
      message: "Sócio não encontrado.",
    };
  }

  if (
    !isPartnerCompany(
      partner.company_id
    )
  ) {
    return {
      success: false,
      message: "Empresa inválida.",
    };
  }

  await requireCompanyAccess(
    partner.company_id
  );

  const { error } = await supabase
    .from("company_partners")
    .update({
      active,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", partnerId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/financeiro/socios");

  return {
    success: true,
  };
}

export async function deleteCompanyPartner(
  partnerId: string
) {
  await requireModulePermission(
    "financial",
    "edit"
  );

  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("company_partners")
    .select(
      "id, company_id, user_id"
    )
    .eq("id", partnerId)
    .maybeSingle();

  if (!partner) {
    return {
      success: false,
      message: "Sócio não encontrado.",
    };
  }

  if (
    !isPartnerCompany(
      partner.company_id
    )
  ) {
    return {
      success: false,
      message: "Empresa inválida.",
    };
  }

  await requireCompanyAccess(
    partner.company_id
  );

  /*
   * Não deixa remover um sócio que já tem adiantamentos
   * registrados — isso quebraria o histórico. Nesse caso
   * o certo é desativar.
   */
  const { count: withdrawalsCount } =
    await supabase
      .from("partner_withdrawals")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "company_id",
        partner.company_id
      )
      .eq("user_id", partner.user_id);

  if ((withdrawalsCount ?? 0) > 0) {
    return {
      success: false,
      message:
        "Este sócio já possui adiantamentos registrados. Desative-o em vez de excluir.",
    };
  }

  const { error } = await supabase
    .from("company_partners")
    .delete()
    .eq("id", partnerId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/financeiro/socios");

  return { success: true };
}
