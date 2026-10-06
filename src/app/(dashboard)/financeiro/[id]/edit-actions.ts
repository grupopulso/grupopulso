"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminClient,
} from "@/app/lib/supabase/admin";

import {
  requireAuthenticatedUser,
  requireCompanyAccess,
  requireFinancialEntryAccess,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

import {
  isValidDateOnly,
} from "@/app/lib/date-utils";

import {
  calculateEntryTotal,
} from "@/app/lib/financial-entry-status";

type Db = ReturnType<
  typeof createAdminClient
>;

export type ExpenseEditInput = {
  description: string;
  supplierId: string | null;
  categoryId: string | null;
  costCenterId: string | null;
  financialAccountId: string | null;
  paymentMethodId: string | null;
  documentNumber: string | null;
  issueDate: string;
  competenceDate: string | null;
  dueDate: string;
  amount: number;
  interest: number;
  fine: number;
  discount: number;
  notes: string | null;
};

const ENTRY_COLUMNS = `
  id,
  company_id,
  type,
  description,
  document_number,
  issue_date,
  competence_date,
  due_date,
  amount,
  amount_paid,
  interest,
  fine,
  discount,
  status,
  notes,
  supplier_id,
  category_id,
  cost_center_id,
  financial_account_id,
  payment_method_id
`;

/*
 * Despesas que nascem de outro cadastro (pagamento de comissão,
 * retirada de sócio) guardam o valor também no registro de origem.
 * Editar o lançamento aqui deixaria os dois divergentes - então
 * essas ficam travadas e a edição é feita na tela de origem.
 */
async function getEditLockReason(
  adminDb: Db,
  entryId: string
): Promise<string | null> {
  const origins: [string, string][] = [
    [
      "commission_payments",
      "Esta despesa foi gerada pelo pagamento de uma comissão. Edite pela tela de Comissões.",
    ],
    [
      "contract_commission_payments",
      "Esta despesa foi gerada pelo pagamento de uma comissão. Edite pela tela de Comissões.",
    ],
    [
      "partner_withdrawals",
      "Esta despesa é uma retirada de sócio. Edite pela tela de Sócios.",
    ],
  ];

  for (const [table, reason] of origins) {
    const { count } = await adminDb
      .from(table)
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("financial_entry_id", entryId);

    if ((count ?? 0) > 0) {
      return reason;
    }
  }

  return null;
}

function includeCurrent(
  currentId: string | null
) {
  return currentId
    ? `active.eq.true,id.eq.${currentId}`
    : "active.eq.true";
}

/*
 * =====================================================
 * DADOS DA TELA DE EDIÇÃO
 * =====================================================
 */

export async function getExpenseEditData(
  entryId: string
) {
  await requireAuthenticatedUser();

  const adminDb = createAdminClient();

  const { data: entry } = await adminDb
    .from("financial_entries")
    .select(ENTRY_COLUMNS)
    .eq("id", entryId)
    .maybeSingle();

  if (!entry) {
    return {
      success: false as const,
      error: "Lançamento não encontrado.",
    };
  }

  if (entry.type !== "expense") {
    return {
      success: false as const,
      error:
        "Só é possível editar despesas por esta tela.",
    };
  }

  await requireFinancialEntryAccess(
    "expense",
    "edit"
  );

  await requireCompanyAccess(
    entry.company_id
  );

  if (entry.status === "cancelled") {
    return {
      success: false as const,
      error:
        "Uma despesa cancelada não pode ser editada.",
    };
  }

  const lockedReason =
    await getEditLockReason(
      adminDb,
      entry.id
    );

  const [
    suppliers,
    categories,
    costCenters,
    accounts,
    methods,
  ] = await Promise.all([
    adminDb
      .from("suppliers")
      .select("id, name")
      .or(
        includeCurrent(entry.supplier_id)
      )
      .order("name"),

    adminDb
      .from("financial_categories")
      .select("id, name, type")
      .or(
        includeCurrent(entry.category_id)
      )
      .in("type", ["expense", "both"])
      .order("name"),

    adminDb
      .from("cost_centers")
      .select("id, company_id, name")
      .or(
        includeCurrent(
          entry.cost_center_id
        )
      )
      .order("name"),

    adminDb
      .from("financial_accounts")
      .select("id, company_id, name")
      .or(
        includeCurrent(
          entry.financial_account_id
        )
      )
      .order("name"),

    adminDb
      .from("financial_payment_methods")
      .select("id, name, usage_type")
      .or(
        includeCurrent(
          entry.payment_method_id
        )
      )
      .in("usage_type", [
        "expense",
        "both",
      ])
      .order("name"),
  ]);

  const sameCompany = (
    companyId: string | null
  ) =>
    !companyId ||
    companyId === entry.company_id;

  return {
    success: true as const,
    lockedReason,
    entry,
    suppliers: suppliers.data ?? [],
    categories: categories.data ?? [],
    costCenters: (
      costCenters.data ?? []
    ).filter((item) =>
      sameCompany(item.company_id)
    ),
    financialAccounts: (
      accounts.data ?? []
    ).filter((item) =>
      sameCompany(item.company_id)
    ),
    paymentMethods: methods.data ?? [],
  };
}

/*
 * =====================================================
 * EXCLUIR DESPESA
 * =====================================================
 *
 * Só exclui despesa sem nenhum pagamento registrado (excluir
 * uma já paga apagaria o histórico do caixa) e que não nasceu
 * de comissão/retirada de sócio (o registro de origem ficaria
 * apontando pra um lançamento que não existe mais).
 */

export async function deleteExpenseEntry(
  entryId: string
) {
  await requireAuthenticatedUser();

  const adminDb = createAdminClient();

  const { data: entry } = await adminDb
    .from("financial_entries")
    .select(ENTRY_COLUMNS)
    .eq("id", entryId)
    .maybeSingle();

  if (!entry) {
    return {
      success: false as const,
      message: "Lançamento não encontrado.",
    };
  }

  if (entry.type !== "expense") {
    return {
      success: false as const,
      message:
        "Só é possível excluir despesas por aqui.",
    };
  }

  await requireFinancialEntryAccess(
    "expense",
    "delete"
  );

  await requireCompanyAccess(
    entry.company_id
  );

  const lockedReason =
    await getEditLockReason(
      adminDb,
      entry.id
    );

  if (lockedReason) {
    return {
      success: false as const,
      message: lockedReason,
    };
  }

  const { count: transactionCount } =
    await adminDb
      .from("financial_transactions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("financial_entry_id", entry.id);

  if (
    Number(entry.amount_paid) > 0 ||
    (transactionCount ?? 0) > 0
  ) {
    return {
      success: false as const,
      message:
        "Esta despesa já tem pagamento registrado e não pode ser excluída.",
    };
  }

  const { error } = await adminDb
    .from("financial_entries")
    .delete()
    .eq("id", entry.id);

  if (error) {
    console.error(
      "Erro ao excluir despesa:",
      error
    );

    return {
      success: false as const,
      message:
        "Não foi possível excluir a despesa.",
    };
  }

  await createAuditLog({
    module: "financial",
    action: "delete",
    entityType: "financial_entry",
    entityId: entry.id,
    description: `Despesa excluída: ${entry.description}.`,
    oldData: entry,
  });

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro/fluxo");

  return { success: true as const };
}

/*
 * =====================================================
 * SALVAR EDIÇÃO
 * =====================================================
 */

export async function updateExpenseEntry(
  entryId: string,
  input: ExpenseEditInput
) {
  await requireAuthenticatedUser();

  const adminDb = createAdminClient();

  const { data: entry } = await adminDb
    .from("financial_entries")
    .select(ENTRY_COLUMNS)
    .eq("id", entryId)
    .maybeSingle();

  if (!entry) {
    return {
      success: false as const,
      message: "Lançamento não encontrado.",
    };
  }

  if (entry.type !== "expense") {
    return {
      success: false as const,
      message:
        "Só é possível editar despesas por esta tela.",
    };
  }

  await requireFinancialEntryAccess(
    "expense",
    "edit"
  );

  await requireCompanyAccess(
    entry.company_id
  );

  if (entry.status === "cancelled") {
    return {
      success: false as const,
      message:
        "Uma despesa cancelada não pode ser editada.",
    };
  }

  const lockedReason =
    await getEditLockReason(
      adminDb,
      entry.id
    );

  if (lockedReason) {
    return {
      success: false as const,
      message: lockedReason,
    };
  }

  const description =
    input.description.trim();

  if (!description) {
    return {
      success: false as const,
      message:
        "Informe a descrição da despesa.",
    };
  }

  if (!isValidDateOnly(input.dueDate)) {
    return {
      success: false as const,
      message:
        "Informe uma data de vencimento válida.",
    };
  }

  if (!isValidDateOnly(input.issueDate)) {
    return {
      success: false as const,
      message:
        "Informe uma data de emissão válida.",
    };
  }

  if (
    input.competenceDate &&
    !isValidDateOnly(input.competenceDate)
  ) {
    return {
      success: false as const,
      message:
        "A data de competência é inválida.",
    };
  }

  const money = [
    input.amount,
    input.interest,
    input.fine,
    input.discount,
  ];

  if (
    money.some(
      (value) =>
        !Number.isFinite(value) ||
        value < 0
    ) ||
    input.amount <= 0
  ) {
    return {
      success: false as const,
      message:
        "Informe valores válidos (o principal precisa ser maior que zero).",
    };
  }

  const amountPaid = Number(
    entry.amount_paid
  );

  const nextTotal = calculateEntryTotal({
    amount: input.amount,
    amount_paid: amountPaid,
    interest: input.interest,
    fine: input.fine,
    discount: input.discount,
  });

  if (nextTotal + 0.001 < amountPaid) {
    return {
      success: false as const,
      message: `O valor total não pode ficar abaixo do que já foi pago (R$ ${amountPaid.toLocaleString(
        "pt-BR",
        { minimumFractionDigits: 2 }
      )}).`,
    };
  }

  /*
   * Os vínculos precisam existir e ser compatíveis com a
   * empresa do lançamento.
   */

  if (input.supplierId) {
    const { data } = await adminDb
      .from("suppliers")
      .select("id")
      .eq("id", input.supplierId)
      .maybeSingle();

    if (!data) {
      return {
        success: false as const,
        message: "Fornecedor inválido.",
      };
    }
  }

  if (input.categoryId) {
    const { data } = await adminDb
      .from("financial_categories")
      .select("id, type")
      .eq("id", input.categoryId)
      .maybeSingle();

    if (
      !data ||
      (data.type !== "expense" &&
        data.type !== "both")
    ) {
      return {
        success: false as const,
        message:
          "Categoria inválida para despesa.",
      };
    }
  }

  for (const [table, id, label] of [
    [
      "cost_centers",
      input.costCenterId,
      "Centro de custo",
    ],
    [
      "financial_accounts",
      input.financialAccountId,
      "Conta financeira",
    ],
  ] as const) {
    if (!id) {
      continue;
    }

    const { data } = await adminDb
      .from(table)
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();

    if (
      !data ||
      (data.company_id &&
        data.company_id !==
          entry.company_id)
    ) {
      return {
        success: false as const,
        message: `${label} inválido para a empresa deste lançamento.`,
      };
    }
  }

  if (input.paymentMethodId) {
    const { data } = await adminDb
      .from("financial_payment_methods")
      .select("id, usage_type")
      .eq("id", input.paymentMethodId)
      .maybeSingle();

    if (
      !data ||
      (data.usage_type !== "expense" &&
        data.usage_type !== "both")
    ) {
      return {
        success: false as const,
        message:
          "Forma de pagamento inválida para despesa.",
      };
    }
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const nextStatus =
    amountPaid >= nextTotal &&
    nextTotal > 0
      ? "paid"
      : amountPaid > 0
        ? "partial"
        : input.dueDate < today
          ? "overdue"
          : "pending";

  const changes = {
    description,
    supplier_id: input.supplierId,
    category_id: input.categoryId,
    cost_center_id: input.costCenterId,
    financial_account_id:
      input.financialAccountId,
    payment_method_id:
      input.paymentMethodId,
    document_number:
      input.documentNumber?.trim() ||
      null,
    issue_date: input.issueDate,
    competence_date:
      input.competenceDate || null,
    due_date: input.dueDate,
    amount: input.amount,
    interest: input.interest,
    fine: input.fine,
    discount: input.discount,
    notes: input.notes?.trim() || null,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  const { error } = await adminDb
    .from("financial_entries")
    .update(changes)
    .eq("id", entry.id);

  if (error) {
    console.error(
      "Erro ao editar despesa:",
      error
    );

    return {
      success: false as const,
      message:
        "Não foi possível salvar a despesa.",
    };
  }

  await createAuditLog({
    module: "financial",
    action: "update",
    entityType: "financial_entry",
    entityId: entry.id,
    description: `Despesa editada: ${description}.`,
    oldData: entry,
    newData: changes,
  });

  revalidatePath(`/financeiro/${entry.id}`);
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro/fluxo");

  return { success: true as const };
}
