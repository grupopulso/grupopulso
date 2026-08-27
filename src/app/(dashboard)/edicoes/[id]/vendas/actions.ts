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

type SaleItemInput = {
  productId: string;

  /*
   * CADERNO É OPCIONAL.
   *
   * null = anúncio geral da edição.
   */
  sectionId?:
    | string
    | null;

  adPositionId: string;

  description: string;

  sizeDescription: string;

  quantity: number;

  unitPrice: number;

  notes?:
    | string
    | null;
};

type NormalizedSaleItem = {
  product_id: string;

  section_id:
    | string
    | null;

  ad_position_id: string;

  description: string;

  size_description: string;

  placement: null;

  print_type: null;

  quantity: number;

  unit_price: number;

  total_amount: number;

  notes:
    | string
    | null;
};

type CreateEditionSaleInput = {
  editionId: string;

  clientId: string;

  sellerUserId: string;

  paymentMethodId: string;

  installments: number;

  firstDueDate: string;

  notes?:
    | string
    | null;

  items:
    SaleItemInput[];
};

type UpdateEditionSaleInput = {
  saleId: string;

  editionId: string;

  clientId: string;

  sellerUserId: string;

  paymentMethodId: string;

  installments: number;

  firstDueDate: string;

  notes?:
    | string
    | null;

  items:
    SaleItemInput[];
};

type ProductCommissionResult =
  | {
      success: true;

      commissionAmount: number;

      effectivePercentage: number;
    }
  | {
      success: false;

      message: string;
    };

/*
 * =====================================================
 * CRIAR VENDA
 * =====================================================
 */

export async function createEditionSale(
  input:
    CreateEditionSaleInput
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

      message:
        "Edição inválida.",
    };
  }

  if (
    !input.clientId
  ) {
    return {
      success: false,

      message:
        "Selecione um cliente.",
    };
  }

  if (
    !input.sellerUserId
  ) {
    return {
      success: false,

      message:
        "Selecione um vendedor.",
    };
  }

  if (
    !input.paymentMethodId
  ) {
    return {
      success: false,

      message:
        "Selecione a forma de pagamento.",
    };
  }

  if (
    !Number.isInteger(
      input.installments
    ) ||
    input.installments <
      1
  ) {
    return {
      success: false,

      message:
        "Informe uma quantidade válida de parcelas.",
    };
  }

  if (
    !input.firstDueDate
  ) {
    return {
      success: false,

      message:
        "Informe o primeiro vencimento.",
    };
  }

  if (
    !input.items.length
  ) {
    return {
      success: false,

      message:
        "Adicione pelo menos um anúncio.",
    };
  }

  /*
   * =====================================================
   * EDIÇÃO
   * =====================================================
   */

  const {
    data:
      edition,
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
        name,
        publication_date,
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
        "Só é possível registrar vendas em uma edição aberta.",
    };
  }

  /*
   * =====================================================
   * CLIENTE
   * =====================================================
   */

  const {
    data:
      client,
    error:
      clientError,
  } =
    await supabase
      .from(
        "clients"
      )
      .select(`
        id,
        name,
        active
      `)
      .eq(
        "id",
        input.clientId
      )
      .maybeSingle();

  if (
    clientError ||
    !client
  ) {
    return {
      success: false,

      message:
        "Cliente não encontrado.",
    };
  }

  if (
    client.active ===
    false
  ) {
    return {
      success: false,

      message:
        "O cliente selecionado está inativo.",
    };
  }

  /*
   * =====================================================
   * FORMA DE PAGAMENTO
   * =====================================================
   */

  const {
    data:
      paymentMethod,
    error:
      paymentMethodError,
  } =
    await supabase
      .from(
        "financial_payment_methods"
      )
      .select(`
        id,
        name,
        code,
        usage_type,
        active
      `)
      .eq(
        "id",
        input.paymentMethodId
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  if (
    paymentMethodError ||
    !paymentMethod
  ) {
    return {
      success: false,

      message:
        "Forma de pagamento inválida ou inativa.",
    };
  }

  if (
    paymentMethod.usage_type !==
      "income" &&
    paymentMethod.usage_type !==
      "both"
  ) {
    return {
      success: false,

      message:
        "Esta forma de pagamento não pode ser utilizada em recebimentos.",
    };
  }

  /*
   * =====================================================
   * VENDEDOR
   * =====================================================
   */

  const {
    data:
      sellerSetting,
    error:
      sellerSettingError,
  } =
    await supabase
      .from(
        "seller_settings"
      )
      .select(`
        user_id,
        company_id,
        active,
        commission_percentage
      `)
      .eq(
        "user_id",
        input.sellerUserId
      )
      .eq(
        "company_id",
        edition.company_id
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  if (
    sellerSettingError ||
    !sellerSetting
  ) {
    return {
      success: false,

      message:
        "O usuário selecionado não está configurado como vendedor ativo desta empresa.",
    };
  }

  if (
    access.profile.role ===
      "seller" &&
    input.sellerUserId !==
      access.user.id
  ) {
    return {
      success: false,

      message:
        "Você só pode registrar vendas em seu próprio nome.",
    };
  }

  /*
   * =====================================================
   * NORMALIZAR ITENS
   * =====================================================
   */

  const normalizedResult =
    normalizeSaleItems(
      input.items
    );

  if (
    !normalizedResult.success
  ) {
    return normalizedResult;
  }

  const normalizedItems =
    normalizedResult.items;

  const totalAmount =
    normalizedResult.totalAmount;

  /*
   * =====================================================
   * VALIDAR CADERNO / POSIÇÃO
   * =====================================================
   */

  const validation =
    await validateSaleItems(
      supabase,
      input.editionId,
      normalizedItems
    );

  if (
    !validation.success
  ) {
    return validation;
  }

  /*
   * =====================================================
   * CALCULAR COMISSÃO POR PRODUTO
   * =====================================================
   */

  const sellerDefaultPercentage =
    Number(
      sellerSetting
        .commission_percentage ??
        0
    );

  const commissionCalculation =
    await calculateProductCommission(
      supabase,
      edition.company_id,
      normalizedItems,
      sellerDefaultPercentage
    );

  if (
    !commissionCalculation.success
  ) {
    return commissionCalculation;
  }

  const commissionPercentage =
    commissionCalculation
      .effectivePercentage;

  const commissionAmount =
    commissionCalculation
      .commissionAmount;

  /*
   * =====================================================
   * CRIAR VENDA
   * =====================================================
   */

  const {
    data:
      sale,
    error:
      saleError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .insert({
        company_id:
          edition.company_id,

        edition_id:
          input.editionId,

        client_id:
          input.clientId,

        seller_user_id:
          input.sellerUserId,

        status:
          "confirmed",

        total_amount:
          totalAmount,

        /*
         * Taxa efetiva média.
         */
        commission_percentage:
          commissionPercentage,

        /*
         * Soma real das comissões
         * dos itens.
         */
        commission_amount:
          commissionAmount,

        payment_method_id:
          input.paymentMethodId,

        installments:
          input.installments,

        first_due_date:
          input.firstDueDate,

        financial_entry_id:
          null,

        notes:
          input.notes
            ?.trim() ||
          null,
      })
      .select(`
        id
      `)
      .single();

  if (
    saleError ||
    !sale
  ) {
    console.error(
      "Erro ao criar venda:",
      saleError
    );

    return {
      success: false,

      message:
        saleError
          ?.message ??
        "Não foi possível criar a venda.",
    };
  }

  const financialEntryIds:
    string[] =
    [];

  try {
    /*
     * =====================================================
     * REVALIDAÇÃO DE POSIÇÕES
     * =====================================================
     */

    const finalValidation =
      await validateSaleItems(
        supabase,
        input.editionId,
        normalizedItems
      );

    if (
      !finalValidation.success
    ) {
      throw new Error(
        finalValidation.message
      );
    }

    /*
     * =====================================================
     * REVALIDAR PRODUTOS / COMISSÃO
     * =====================================================
     */

    const finalCommissionCalculation =
      await calculateProductCommission(
        supabase,
        edition.company_id,
        normalizedItems,
        sellerDefaultPercentage
      );

    if (
      !finalCommissionCalculation.success
    ) {
      throw new Error(
        finalCommissionCalculation.message
      );
    }

    /*
     * =====================================================
     * ITENS
     * =====================================================
     */

    const {
      error:
        itemsError,
    } =
      await supabase
        .from(
          "edition_sale_items"
        )
        .insert(
          normalizedItems.map(
            (
              item
            ) => ({
              sale_id:
                sale.id,

              ...item,
            })
          )
        );

    if (
      itemsError
    ) {
      throw new Error(
        `Não foi possível salvar os anúncios: ${itemsError.message}`
      );
    }

    /*
     * =====================================================
     * COMISSÕES
     * =====================================================
     */

    const commissionResult =
      await createSaleCommissions(
        supabase,
        {
          saleId:
            sale.id,

          companyId:
            edition.company_id,

          sellerUserId:
            input.sellerUserId,

          totalAmount,

          commissionPercentage:
            finalCommissionCalculation
              .effectivePercentage,

          commissionAmount:
            finalCommissionCalculation
              .commissionAmount,
        }
      );

    if (
      !commissionResult.success
    ) {
      throw new Error(
        commissionResult.message
      );
    }

    /*
     * =====================================================
     * FINANCEIRO
     * =====================================================
     */

    const financeResult =
      await createSaleFinancialEntries(
        supabase,
        {
          saleId:
            sale.id,

          editionName:
            edition.name,

          publicationDate:
            edition.publication_date,

          companyId:
            edition.company_id,

          clientId:
            input.clientId,

          clientName:
            client.name,

          paymentMethodName:
            paymentMethod.name,

          totalAmount,

          installments:
            input.installments,

          firstDueDate:
            input.firstDueDate,
        },
        financialEntryIds
      );

    if (
      !financeResult.success
    ) {
      throw new Error(
        financeResult.message
      );
    }

    const {
      error:
        saleFinancialError,
    } =
      await supabase
        .from(
          "edition_sales"
        )
        .update({
          financial_entry_id:
            financeResult
              .firstFinancialEntryId,
        })
        .eq(
          "id",
          sale.id
        );

    if (
      saleFinancialError
    ) {
      throw new Error(
        `Erro ao vincular o financeiro à venda: ${saleFinancialError.message}`
      );
    }
  } catch (
    error
  ) {
    console.error(
      "Erro ao concluir venda:",
      error
    );

    if (
      financialEntryIds.length
    ) {
      await supabase
        .from(
          "financial_entries"
        )
        .delete()
        .in(
          "id",
          financialEntryIds
        );
    }

    await rollbackSale(
      supabase,
      sale.id
    );

    return {
      success: false,

      message:
        error instanceof
        Error
          ? error.message
          : "Não foi possível concluir a venda.",
    };
  }

  revalidateSalePaths(
    input.editionId,
    sale.id
  );

  return {
    success: true,

    saleId:
      sale.id,
  };
}

/*
 * =====================================================
 * EDITAR VENDA
 * =====================================================
 */

export async function updateEditionSale(
  input:
    UpdateEditionSaleInput
) {
  const access =
    await requireEstafetaAccess();

  const supabase =
    await createClient();

  if (
    !input.saleId ||
    !input.editionId
  ) {
    return {
      success: false,

      message:
        "Venda inválida.",
    };
  }

  if (
    !input.clientId
  ) {
    return {
      success: false,

      message:
        "Selecione um cliente.",
    };
  }

  if (
    !input.sellerUserId
  ) {
    return {
      success: false,

      message:
        "Selecione um vendedor.",
    };
  }

  if (
    !input.paymentMethodId
  ) {
    return {
      success: false,

      message:
        "Selecione a forma de pagamento.",
    };
  }

  if (
    !Number.isInteger(
      input.installments
    ) ||
    input.installments <
      1
  ) {
    return {
      success: false,

      message:
        "Informe uma quantidade válida de parcelas.",
    };
  }

  if (
    !input.firstDueDate
  ) {
    return {
      success: false,

      message:
        "Informe o primeiro vencimento.",
    };
  }

  if (
    !input.items.length
  ) {
    return {
      success: false,

      message:
        "Adicione pelo menos um anúncio.",
    };
  }

  /*
   * =====================================================
   * VENDA
   * =====================================================
   */

  const {
    data:
      sale,
    error:
      saleError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .select(`
        id,
        company_id,
        edition_id,
        seller_user_id,
        status
      `)
      .eq(
        "id",
        input.saleId
      )
      .eq(
        "edition_id",
        input.editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (
    saleError ||
    !sale
  ) {
    return {
      success: false,

      message:
        "Venda não encontrada.",
    };
  }

  if (
    sale.status ===
    "cancelled"
  ) {
    return {
      success: false,

      message:
        "Uma venda cancelada não pode ser editada.",
    };
  }

  /*
   * =====================================================
   * EDIÇÃO
   * =====================================================
   */

  const {
    data:
      edition,
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
        name,
        publication_date,
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
        "A venda só pode ser editada enquanto a edição estiver aberta.",
    };
  }

  /*
   * =====================================================
   * FINANCEIRO ATUAL
   * =====================================================
   */

  const {
    data:
      currentInstallments,
    error:
      installmentsError,
  } =
    await supabase
      .from(
        "edition_sale_installments"
      )
      .select(`
        id,
        financial_entry_id
      `)
      .eq(
        "sale_id",
        sale.id
      );

  if (
    installmentsError
  ) {
    return {
      success: false,

      message:
        "Não foi possível verificar o financeiro da venda.",
    };
  }

  const financialIds =
    (
      currentInstallments ??
      []
    )
      .map(
        (
          installment
        ) =>
          installment
            .financial_entry_id
      )
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            value
          )
      );

  /*
   * =====================================================
   * NÃO EDITAR APÓS RECEBIMENTO
   * =====================================================
   */

  if (
    financialIds.length
  ) {
    const {
      data:
        receivedEntries,
      error:
        receivedError,
    } =
      await supabase
        .from(
          "financial_entries"
        )
        .select(`
          id,
          amount_paid
        `)
        .in(
          "id",
          financialIds
        );

    if (
      receivedError
    ) {
      return {
        success: false,

        message:
          "Não foi possível verificar os recebimentos da venda.",
      };
    }

    const hasPayment =
      (
        receivedEntries ??
        []
      ).some(
        (
          entry
        ) =>
          Number(
            entry.amount_paid ??
              0
          ) >
          0
      );

    if (
      hasPayment
    ) {
      return {
        success: false,

        message:
          "Esta venda já possui recebimento registrado. Os dados financeiros não podem mais ser alterados.",
      };
    }
  }

  /*
   * =====================================================
   * CLIENTE
   * =====================================================
   */

  const {
    data:
      client,
    error:
      clientError,
  } =
    await supabase
      .from(
        "clients"
      )
      .select(`
        id,
        name,
        active
      `)
      .eq(
        "id",
        input.clientId
      )
      .maybeSingle();

  if (
    clientError ||
    !client ||
    client.active ===
      false
  ) {
    return {
      success: false,

      message:
        "Cliente inválido ou inativo.",
    };
  }

  /*
   * =====================================================
   * FORMA DE PAGAMENTO
   * =====================================================
   */

  const {
    data:
      paymentMethod,
    error:
      paymentMethodError,
  } =
    await supabase
      .from(
        "financial_payment_methods"
      )
      .select(`
        id,
        name,
        usage_type,
        active
      `)
      .eq(
        "id",
        input.paymentMethodId
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  if (
    paymentMethodError ||
    !paymentMethod
  ) {
    return {
      success: false,

      message:
        "Forma de pagamento inválida.",
    };
  }

  if (
    paymentMethod.usage_type !==
      "income" &&
    paymentMethod.usage_type !==
      "both"
  ) {
    return {
      success: false,

      message:
        "Esta forma de pagamento não pode ser utilizada em recebimentos.",
    };
  }

  /*
   * =====================================================
   * VENDEDOR
   * =====================================================
   */

  const {
    data:
      sellerSetting,
    error:
      sellerSettingError,
  } =
    await supabase
      .from(
        "seller_settings"
      )
      .select(`
        user_id,
        commission_percentage
      `)
      .eq(
        "user_id",
        input.sellerUserId
      )
      .eq(
        "company_id",
        edition.company_id
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  if (
    sellerSettingError ||
    !sellerSetting
  ) {
    return {
      success: false,

      message:
        "Vendedor inválido ou inativo.",
    };
  }

  if (
    access.profile.role ===
      "seller" &&
    input.sellerUserId !==
      access.user.id
  ) {
    return {
      success: false,

      message:
        "Você só pode registrar vendas em seu próprio nome.",
    };
  }

  /*
   * =====================================================
   * NORMALIZAR ITENS
   * =====================================================
   */

  const normalizedResult =
    normalizeSaleItems(
      input.items
    );

  if (
    !normalizedResult.success
  ) {
    return normalizedResult;
  }

  const normalizedItems =
    normalizedResult.items;

  const totalAmount =
    normalizedResult.totalAmount;

  /*
   * =====================================================
   * VALIDAR POSIÇÕES
   * =====================================================
   */

  const validation =
    await validateSaleItems(
      supabase,
      input.editionId,
      normalizedItems,
      sale.id
    );

  if (
    !validation.success
  ) {
    return validation;
  }

  /*
   * =====================================================
   * CALCULAR COMISSÃO
   * =====================================================
   */

  const sellerDefaultPercentage =
    Number(
      sellerSetting
        .commission_percentage ??
        0
    );

  const commissionCalculation =
    await calculateProductCommission(
      supabase,
      edition.company_id,
      normalizedItems,
      sellerDefaultPercentage
    );

  if (
    !commissionCalculation.success
  ) {
    return commissionCalculation;
  }

  const commissionPercentage =
    commissionCalculation
      .effectivePercentage;

  const commissionAmount =
    commissionCalculation
      .commissionAmount;

  /*
   * =====================================================
   * ATUALIZAR VENDA
   * =====================================================
   */

  const {
    error:
      updateSaleError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .update({
        client_id:
          input.clientId,

        seller_user_id:
          input.sellerUserId,

        total_amount:
          totalAmount,

        commission_percentage:
          commissionPercentage,

        commission_amount:
          commissionAmount,

        payment_method_id:
          input.paymentMethodId,

        installments:
          input.installments,

        first_due_date:
          input.firstDueDate,

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
        sale.id
      );

  if (
    updateSaleError
  ) {
    return {
      success: false,

      message:
        updateSaleError.message,
    };
  }

  /*
   * =====================================================
   * SUBSTITUIR ITENS
   * =====================================================
   */

  const {
    error:
      deleteItemsError,
  } =
    await supabase
      .from(
        "edition_sale_items"
      )
      .delete()
      .eq(
        "sale_id",
        sale.id
      );

  if (
    deleteItemsError
  ) {
    return {
      success: false,

      message:
        "Não foi possível atualizar os anúncios.",
    };
  }

  const {
    error:
      insertItemsError,
  } =
    await supabase
      .from(
        "edition_sale_items"
      )
      .insert(
        normalizedItems.map(
          (
            item
          ) => ({
            sale_id:
              sale.id,

            ...item,
          })
        )
      );

  if (
    insertItemsError
  ) {
    return {
      success: false,

      message:
        insertItemsError.message,
    };
  }

  /*
   * =====================================================
   * RECRIAR COMISSÕES
   * =====================================================
   */

  const {
    error:
      deleteCommissionError,
  } =
    await supabase
      .from(
        "sale_commissions"
      )
      .delete()
      .eq(
        "sale_id",
        sale.id
      );

  if (
    deleteCommissionError
  ) {
    return {
      success: false,

      message:
        "Não foi possível recalcular as comissões.",
    };
  }

  const commissionResult =
    await createSaleCommissions(
      supabase,
      {
        saleId:
          sale.id,

        companyId:
          edition.company_id,

        sellerUserId:
          input.sellerUserId,

        totalAmount,

        commissionPercentage,

        commissionAmount,
      }
    );

  if (
    !commissionResult.success
  ) {
    return commissionResult;
  }

  /*
   * =====================================================
   * REMOVER PARCELAS ANTIGAS
   * =====================================================
   */

  const {
    error:
      deleteInstallmentsError,
  } =
    await supabase
      .from(
        "edition_sale_installments"
      )
      .delete()
      .eq(
        "sale_id",
        sale.id
      );

  if (
    deleteInstallmentsError
  ) {
    return {
      success: false,

      message:
        "Não foi possível atualizar o parcelamento.",
    };
  }

  if (
    financialIds.length
  ) {
    const {
      error:
        deleteFinancialError,
    } =
      await supabase
        .from(
          "financial_entries"
        )
        .delete()
        .in(
          "id",
          financialIds
        );

    if (
      deleteFinancialError
    ) {
      return {
        success: false,

        message:
          "Não foi possível substituir os lançamentos financeiros antigos.",
      };
    }
  }

  /*
   * =====================================================
   * NOVO FINANCEIRO
   * =====================================================
   */

  const newFinancialEntryIds:
    string[] =
    [];

  const financeResult =
    await createSaleFinancialEntries(
      supabase,
      {
        saleId:
          sale.id,

        editionName:
          edition.name,

        publicationDate:
          edition.publication_date,

        companyId:
          edition.company_id,

        clientId:
          input.clientId,

        clientName:
          client.name,

        paymentMethodName:
          paymentMethod.name,

        totalAmount,

        installments:
          input.installments,

        firstDueDate:
          input.firstDueDate,
      },
      newFinancialEntryIds
    );

  if (
    !financeResult.success
  ) {
    return {
      success: false,

      message:
        financeResult.message,
    };
  }

  const {
    error:
      firstEntryError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .update({
        financial_entry_id:
          financeResult
            .firstFinancialEntryId,
      })
      .eq(
        "id",
        sale.id
      );

  if (
    firstEntryError
  ) {
    return {
      success: false,

      message:
        firstEntryError.message,
    };
  }

  revalidateSalePaths(
    input.editionId,
    sale.id
  );

  revalidatePath(
    `/edicoes/${input.editionId}/vendas/${sale.id}/editar`
  );

  return {
    success: true,
  };
}

/*
 * =====================================================
 * CANCELAR VENDA
 * =====================================================
 */

export async function cancelEditionSale(
  saleId: string,
  editionId: string
) {
  const access =
    await requireEstafetaAccess();

  const supabase =
    await createClient();

  if (
    !saleId ||
    !editionId
  ) {
    return {
      success: false,

      message:
        "Venda inválida.",
    };
  }

  const {
    data:
      sale,
    error:
      saleError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .select(`
        id,
        company_id,
        edition_id,
        status
      `)
      .eq(
        "id",
        saleId
      )
      .eq(
        "edition_id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (
    saleError ||
    !sale
  ) {
    return {
      success: false,

      message:
        "Venda não encontrada.",
    };
  }

  if (
    sale.status ===
    "cancelled"
  ) {
    return {
      success: false,

      message:
        "Esta venda já está cancelada.",
    };
  }

  /*
   * =====================================================
   * PARCELAS
   * =====================================================
   */

  const {
    data:
      installments,
    error:
      installmentsError,
  } =
    await supabase
      .from(
        "edition_sale_installments"
      )
      .select(`
        id,
        financial_entry_id
      `)
      .eq(
        "sale_id",
        sale.id
      );

  if (
    installmentsError
  ) {
    return {
      success: false,

      message:
        "Não foi possível verificar o financeiro da venda.",
    };
  }

  const financialEntryIds =
    (
      installments ??
      []
    )
      .map(
        (
          installment
        ) =>
          installment
            .financial_entry_id
      )
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            value
          )
      );

  /*
   * =====================================================
   * VERIFICAR RECEBIMENTO
   * =====================================================
   */

  if (
    financialEntryIds.length >
    0
  ) {
    const {
      data:
        financialEntries,
      error:
        financialError,
    } =
      await supabase
        .from(
          "financial_entries"
        )
        .select(`
          id,
          amount_paid,
          status
        `)
        .in(
          "id",
          financialEntryIds
        );

    if (
      financialError
    ) {
      return {
        success: false,

        message:
          "Não foi possível verificar os recebimentos desta venda.",
      };
    }

    const hasReceipt =
      (
        financialEntries ??
        []
      ).some(
        (
          entry
        ) =>
          Number(
            entry.amount_paid ??
              0
          ) >
          0
      );

    if (
      hasReceipt
    ) {
      return {
        success: false,

        message:
          "Esta venda já possui recebimento registrado e não pode ser cancelada diretamente.",
      };
    }
  }

  /*
   * =====================================================
   * CANCELAR FINANCEIRO
   * =====================================================
   */

  if (
    financialEntryIds.length >
    0
  ) {
    const {
      error:
        financialCancelError,
    } =
      await supabase
        .from(
          "financial_entries"
        )
        .update({
          status:
            "cancelled",

          updated_at:
            new Date()
              .toISOString(),
        })
        .in(
          "id",
          financialEntryIds
        );

    if (
      financialCancelError
    ) {
      return {
        success: false,

        message:
          "Não foi possível cancelar as contas a receber da venda.",
      };
    }
  }

  /*
   * =====================================================
   * CANCELAR COMISSÕES
   * =====================================================
   */

  const {
    error:
      commissionsError,
  } =
    await supabase
      .from(
        "sale_commissions"
      )
      .update({
        status:
          "cancelled",

        amount_released:
          0,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "sale_id",
        sale.id
      );

  if (
    commissionsError
  ) {
    return {
      success: false,

      message:
        "Não foi possível cancelar as comissões desta venda.",
    };
  }

  /*
   * =====================================================
   * CANCELAR VENDA
   * =====================================================
   */

  const {
    error:
      cancelSaleError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .update({
        status:
          "cancelled",

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        sale.id
      );

  if (
    cancelSaleError
  ) {
    return {
      success: false,

      message:
        "Não foi possível cancelar a venda.",
    };
  }

  revalidateSalePaths(
    editionId,
    sale.id
  );

  return {
    success: true,
  };
}

/*
 * =====================================================
 * CALCULAR COMISSÃO POR PRODUTO
 * =====================================================
 */

async function calculateProductCommission(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  companyId: string,
  items:
    NormalizedSaleItem[],
  sellerDefaultPercentage:
    number
): Promise<
  ProductCommissionResult
> {
  const productIds =
    [
      ...new Set(
        items.map(
          (
            item
          ) =>
            item.product_id
        )
      ),
    ];

  if (
    !productIds.length
  ) {
    return {
      success: false,

      message:
        "Selecione um produto ou serviço para os anúncios.",
    };
  }

  const {
    data:
      products,
    error:
      productsError,
  } =
    await supabase
      .from(
        "products"
      )
      .select(`
        id,
        company_id,
        name,
        commission_percentage,
        active
      `)
      .in(
        "id",
        productIds
      )
      .eq(
        "company_id",
        companyId
      )
      .eq(
        "active",
        true
      );

  if (
    productsError
  ) {
    console.error(
      "Erro ao validar produtos da venda:",
      productsError
    );

    return {
      success: false,

      message:
        "Não foi possível validar os produtos da venda.",
    };
  }

  if (
    (
      products ??
      []
    ).length !==
    productIds.length
  ) {
    return {
      success: false,

      message:
        "Um ou mais produtos selecionados são inválidos, estão inativos ou não pertencem ao O Estafeta.",
    };
  }

  const productsById =
    new Map(
      (
        products ??
        []
      ).map(
        (
          product
        ) => [
          product.id,
          product,
        ]
      )
    );

  let commissionAmount =
    0;

  let totalAmount =
    0;

  for (
    const item of
      items
  ) {
    const product =
      productsById.get(
        item.product_id
      );

    if (
      !product
    ) {
      return {
        success: false,

        message:
          "Produto da venda não encontrado.",
      };
    }

    /*
     * ===============================================
     * REGRA DE PRIORIDADE
     * ===============================================
     *
     * NULL
     * → comissão padrão do vendedor
     *
     * 0
     * → sem comissão
     *
     * outro valor
     * → comissão específica do produto
     */

    const percentage =
      product
        .commission_percentage ===
      null
        ? sellerDefaultPercentage
        : Number(
            product
              .commission_percentage
          );

    if (
      !Number.isFinite(
        percentage
      ) ||
      percentage <
        0 ||
      percentage >
        100
    ) {
      return {
        success: false,

        message:
          `A comissão configurada no produto "${product.name}" é inválida.`,
      };
    }

    const itemTotal =
      Number(
        item.total_amount
      );

    totalAmount =
      roundMoney(
        totalAmount +
          itemTotal
      );

    commissionAmount =
      roundMoney(
        commissionAmount +
          roundMoney(
            itemTotal *
              (
                percentage /
                100
              )
          )
      );
  }

  /*
   * Taxa média efetiva da venda.
   *
   * Ex.:
   * R$ 6.000 de venda
   * R$ 600 comissão
   * = 10%
   */

  const effectivePercentage =
    totalAmount >
    0
      ? roundPercentage(
          (
            commissionAmount /
            totalAmount
          ) *
            100
        )
      : 0;

  return {
    success: true,

    commissionAmount:
      roundMoney(
        commissionAmount
      ),

    effectivePercentage,
  };
}

/*
 * =====================================================
 * CRIAR COMISSÕES
 * =====================================================
 */

async function createSaleCommissions(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  input: {
    saleId: string;

    companyId: string;

    sellerUserId: string;

    totalAmount: number;

    /*
     * Taxa média efetiva.
     */
    commissionPercentage:
      number;

    /*
     * Valor real calculado
     * item por item.
     */
    commissionAmount:
      number;
  }
): Promise<
  | {
      success: true;
    }
  | {
      success: false;

      message: string;
    }
> {
  /*
   * =====================================================
   * COMISSÃO DIRETA DO VENDEDOR
   * =====================================================
   */

  if (
    input.commissionAmount >
    0
  ) {
    const {
      error,
    } =
      await supabase
        .from(
          "sale_commissions"
        )
        .insert({
          sale_id:
            input.saleId,

          beneficiary_user_id:
            input.sellerUserId,

          source_seller_user_id:
            input.sellerUserId,

          commission_type:
            "seller",

          /*
           * Taxa efetiva média.
           */
          percentage:
            input.commissionPercentage,

          base_amount:
            input.totalAmount,

          /*
           * Valor real calculado
           * pelos produtos.
           */
          amount:
            input.commissionAmount,

          amount_released:
            0,

          amount_paid:
            0,

          status:
            "pending",

          financial_entry_id:
            null,
        });

    if (
      error
    ) {
      return {
        success: false,

        message:
          `Não foi possível gerar a comissão do vendedor: ${error.message}`,
      };
    }
  }

  /*
   * =====================================================
   * OVERRIDES
   * =====================================================
   *
   * Permanecem com a regra própria
   * configurada em seller_override_rules.
   */

  const {
    data:
      overrideRules,
    error:
      overrideRulesError,
  } =
    await supabase
      .from(
        "seller_override_rules"
      )
      .select(`
        beneficiary_user_id,
        source_user_id,
        percentage
      `)
      .eq(
        "company_id",
        input.companyId
      )
      .eq(
        "source_user_id",
        input.sellerUserId
      )
      .eq(
        "active",
        true
      );

  if (
    overrideRulesError
  ) {
    return {
      success: false,

      message:
        "Não foi possível calcular as comissões adicionais.",
    };
  }

  const overrideCommissions =
    (
      overrideRules ??
      []
    )
      .filter(
        (
          rule
        ) =>
          Number(
            rule.percentage
          ) >
          0
      )
      .map(
        (
          rule
        ) => {
          const percentage =
            Number(
              rule.percentage
            );

          return {
            sale_id:
              input.saleId,

            beneficiary_user_id:
              rule
                .beneficiary_user_id,

            source_seller_user_id:
              input.sellerUserId,

            commission_type:
              "override",

            percentage,

            base_amount:
              input.totalAmount,

            amount:
              roundMoney(
                input.totalAmount *
                  (
                    percentage /
                    100
                  )
              ),

            amount_released:
              0,

            amount_paid:
              0,

            status:
              "pending",

            financial_entry_id:
              null,
          };
        }
      );

  if (
    overrideCommissions.length
  ) {
    const {
      error,
    } =
      await supabase
        .from(
          "sale_commissions"
        )
        .insert(
          overrideCommissions
        );

    if (
      error
    ) {
      return {
        success: false,

        message:
          `Não foi possível gerar as comissões adicionais: ${error.message}`,
      };
    }
  }

  return {
    success: true,
  };
}

/*
 * =====================================================
 * CRIAR FINANCEIRO
 * =====================================================
 */

async function createSaleFinancialEntries(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  input: {
    saleId: string;

    editionName: string;

    publicationDate:
      string;

    companyId: string;

    clientId: string;

    clientName: string;

    paymentMethodName:
      string;

    totalAmount: number;

    installments: number;

    firstDueDate: string;
  },
  createdFinancialIds:
    string[]
): Promise<
  | {
      success: true;

      firstFinancialEntryId:
        string | null;
    }
  | {
      success: false;

      message: string;
    }
> {
  const installmentValues =
    distributeAmount(
      input.totalAmount,
      input.installments
    );

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

  let firstFinancialEntryId:
    string | null =
    null;

  for (
    let index = 0;
    index <
    input.installments;
    index++
  ) {
    const installmentNumber =
      index +
      1;

    const dueDate =
      addMonthsClamped(
        input.firstDueDate,
        index
      );

    const amount =
      installmentValues[
        index
      ];

    const status =
      dueDate <
      today
        ? "overdue"
        : "pending";

    const {
      data:
        financialEntry,
      error:
        financialError,
    } =
      await supabase
        .from(
          "financial_entries"
        )
        .insert({
          company_id:
            input.companyId,

          type:
            "income",

          client_id:
            input.clientId,

          supplier_id:
            null,

          contract_id:
            null,

          /*
           * Uma venda de edição
           * pode ter vários produtos.
           */
          product_id:
            null,

          category_id:
            null,

          cost_center_id:
            null,

          financial_account_id:
            null,

          description:
            `${input.editionName} - Publicidade - ${input.clientName} - Parcela ${installmentNumber}/${input.installments}`,

          document_number:
            null,

          competence_date:
            input.publicationDate,

          issue_date:
            today,

          due_date:
            dueDate,

          amount,

          amount_paid:
            0,

          interest:
            0,

          fine:
            0,

          discount:
            0,

          status,

          recurring:
            false,

          recurrence_frequency:
            null,

          invoice_issued:
            false,

          invoice_number:
            null,

          invoice_issued_at:
            null,

          charge_sent:
            false,

          charge_sent_at:
            null,

          notes:
            `Venda de publicidade ${input.saleId}. ${input.editionName}. Parcela ${installmentNumber}/${input.installments}. Forma de pagamento: ${input.paymentMethodName}.`,
        })
        .select(`
          id
        `)
        .single();

    if (
      financialError ||
      !financialEntry
    ) {
      return {
        success: false,

        message:
          financialError
            ?.message ??
          `Não foi possível criar a parcela ${installmentNumber}.`,
      };
    }

    createdFinancialIds.push(
      financialEntry.id
    );

    if (
      installmentNumber ===
      1
    ) {
      firstFinancialEntryId =
        financialEntry.id;
    }

    const {
      error:
        installmentError,
    } =
      await supabase
        .from(
          "edition_sale_installments"
        )
        .insert({
          sale_id:
            input.saleId,

          installment_number:
            installmentNumber,

          due_date:
            dueDate,

          amount,

          financial_entry_id:
            financialEntry.id,
        });

    if (
      installmentError
    ) {
      return {
        success: false,

        message:
          `Erro ao vincular a parcela ${installmentNumber}: ${installmentError.message}`,
      };
    }
  }

  return {
    success: true,

    firstFinancialEntryId,
  };
}

/*
 * =====================================================
 * VALIDAR CADERNO + POSIÇÃO
 * =====================================================
 */

async function validateSaleItems(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  editionId:
    string,
  items:
    NormalizedSaleItem[],
  excludeSaleId?:
    string
): Promise<
  | {
      success: true;
    }
  | {
      success: false;

      message: string;
    }
> {
  /*
   * =====================================================
   * CADERNOS
   * =====================================================
   */

  const sectionIds =
    [
      ...new Set(
        items
          .map(
            (
              item
            ) =>
              item.section_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          )
      ),
    ];

  if (
    sectionIds.length >
    0
  ) {
    const {
      data:
        sections,
      error:
        sectionsError,
    } =
      await supabase
        .from(
          "edition_sections"
        )
        .select(`
          id,
          name,
          active
        `)
        .eq(
          "edition_id",
          editionId
        )
        .eq(
          "active",
          true
        )
        .in(
          "id",
          sectionIds
        );

    if (
      sectionsError
    ) {
      console.error(
        "Erro ao validar cadernos:",
        sectionsError
      );

      return {
        success: false,

        message:
          "Não foi possível validar os cadernos selecionados.",
      };
    }

    if (
      (
        sections ??
        []
      ).length !==
      sectionIds.length
    ) {
      return {
        success: false,

        message:
          "Um ou mais cadernos selecionados são inválidos ou estão inativos.",
      };
    }
  }

  /*
   * =====================================================
   * POSIÇÕES
   * =====================================================
   */

  const positionIds =
    [
      ...new Set(
        items.map(
          (
            item
          ) =>
            item.ad_position_id
        )
      ),
    ];

  const {
    data:
      positions,
    error:
      positionsError,
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
        "edition_id",
        editionId
      )
      .in(
        "id",
        positionIds
      );

  if (
    positionsError
  ) {
    console.error(
      "Erro ao validar posições:",
      positionsError
    );

    return {
      success: false,

      message:
        "Não foi possível validar as posições comerciais.",
    };
  }

  if (
    (
      positions ??
      []
    ).length !==
    positionIds.length
  ) {
    return {
      success: false,

      message:
        "Uma ou mais posições selecionadas não pertencem a esta edição.",
    };
  }

  const positionById =
    new Map(
      (
        positions ??
        []
      ).map(
        (
          position
        ) => [
          position.id,
          position,
        ]
      )
    );

  /*
   * =====================================================
   * RELAÇÃO CADERNO ↔ POSIÇÃO
   * =====================================================
   */

  for (
    let index = 0;
    index <
    items.length;
    index++
  ) {
    const item =
      items[
        index
      ];

    const position =
      positionById.get(
        item.ad_position_id
      );

    if (
      !position
    ) {
      return {
        success: false,

        message:
          `A posição do anúncio ${index + 1} não foi encontrada.`,
      };
    }

    if (
      item.section_id
    ) {
      if (
        position.section_id !==
        item.section_id
      ) {
        return {
          success: false,

          message:
            `A posição "${position.name}" não pertence ao caderno selecionado no anúncio ${index + 1}.`,
        };
      }
    }

    if (
      !item.section_id &&
      position.section_id !==
        null
    ) {
      return {
        success: false,

        message:
          `A posição "${position.name}" pertence a um caderno. Para utilizá-la, selecione o caderno correspondente.`,
      };
    }

    if (
      !position.active
    ) {
      return {
        success: false,

        message:
          `A posição "${position.name}" está inativa.`,
      };
    }

    if (
      position.manually_blocked
    ) {
      return {
        success: false,

        message:
          position.blocked_reason
            ? `A posição "${position.name}" está bloqueada: ${position.blocked_reason}`
            : `A posição "${position.name}" está bloqueada pelo administrador.`,
      };
    }
  }

  /*
   * =====================================================
   * USO ATUAL
   * =====================================================
   */

  let usedItemsQuery =
    supabase
      .from(
        "edition_sale_items"
      )
      .select(`
        id,
        ad_position_id,
        sale_id,

        sale:edition_sales!inner (
          id,
          edition_id,
          status
        )
      `)
      .eq(
        "sale.edition_id",
        editionId
      )
      .eq(
        "sale.status",
        "confirmed"
      )
      .in(
        "ad_position_id",
        positionIds
      );

  if (
    excludeSaleId
  ) {
    usedItemsQuery =
      usedItemsQuery.neq(
        "sale_id",
        excludeSaleId
      );
  }

  const {
    data:
      usedItems,
    error:
      usageError,
  } =
    await usedItemsQuery;

  if (
    usageError
  ) {
    console.error(
      "Erro ao verificar utilização das posições:",
      usageError
    );

    return {
      success: false,

      message:
        "Não foi possível verificar a disponibilidade das posições.",
    };
  }

  const existingUsage =
    new Map<
      string,
      number
    >();

  for (
    const item of
      usedItems ??
      []
  ) {
    if (
      !item.ad_position_id
    ) {
      continue;
    }

    existingUsage.set(
      item.ad_position_id,
      (
        existingUsage.get(
          item.ad_position_id
        ) ??
        0
      ) +
        1
    );
  }

  const incomingUsage =
    new Map<
      string,
      number
    >();

  for (
    const item of
      items
  ) {
    incomingUsage.set(
      item.ad_position_id,
      (
        incomingUsage.get(
          item.ad_position_id
        ) ??
        0
      ) +
        1
    );
  }

  /*
   * =====================================================
   * CAPACIDADE
   * =====================================================
   */

  for (
    const positionId of
      positionIds
  ) {
    const position =
      positionById.get(
        positionId
      );

    if (
      !position
    ) {
      continue;
    }

    if (
      position.capacity ===
      null
    ) {
      continue;
    }

    const capacity =
      Number(
        position.capacity
      );

    const alreadyUsed =
      existingUsage.get(
        positionId
      ) ??
      0;

    const requested =
      incomingUsage.get(
        positionId
      ) ??
      0;

    if (
      alreadyUsed +
        requested >
      capacity
    ) {
      const available =
        Math.max(
          capacity -
            alreadyUsed,
          0
        );

      return {
        success: false,

        message:
          available >
          0
            ? `A posição "${position.name}" possui somente ${available} vaga(s) disponível(is).`
            : `A posição "${position.name}" já está esgotada.`,
      };
    }
  }

  return {
    success: true,
  };
}

/*
 * =====================================================
 * NORMALIZAR ITENS
 * =====================================================
 */

function normalizeSaleItems(
  items:
    SaleItemInput[]
):
  | {
      success: true;

      items:
        NormalizedSaleItem[];

      totalAmount:
        number;
    }
  | {
      success: false;

      message:
        string;
    } {
  try {
    const normalized =
      items.map(
        (
          item,
          index
        ) => {
          const productId =
            item.productId
              ?.trim();

          const sectionId =
            item.sectionId
              ?.trim() ||
            null;

          const adPositionId =
            item.adPositionId
              ?.trim();

          const description =
            item.description
              .trim();

          const sizeDescription =
            item.sizeDescription
              .trim();

          const quantity =
            Number(
              item.quantity
            );

          const unitPrice =
            Number(
              item.unitPrice
            );

          /*
           * PRODUTO OBRIGATÓRIO.
           */

          if (
            !productId
          ) {
            throw new Error(
              `Selecione o produto ou serviço do anúncio ${index + 1}.`
            );
          }

          if (
            !description
          ) {
            throw new Error(
              `Informe a descrição do anúncio ${index + 1}.`
            );
          }

          if (
            !adPositionId
          ) {
            throw new Error(
              `Selecione a posição do anúncio ${index + 1}.`
            );
          }

          if (
            !sizeDescription
          ) {
            throw new Error(
              `Informe o tamanho do anúncio ${index + 1}.`
            );
          }

          if (
            !Number.isInteger(
              quantity
            ) ||
            quantity <=
              0
          ) {
            throw new Error(
              `Quantidade inválida no anúncio ${index + 1}.`
            );
          }

          if (
            !Number.isFinite(
              unitPrice
            ) ||
            unitPrice <=
              0
          ) {
            throw new Error(
              `Valor inválido no anúncio ${index + 1}.`
            );
          }

          return {
            product_id:
              productId,

            section_id:
              sectionId,

            ad_position_id:
              adPositionId,

            description,

            size_description:
              sizeDescription,

            placement:
              null,

            print_type:
              null,

            quantity,

            unit_price:
              unitPrice,

            total_amount:
              roundMoney(
                quantity *
                  unitPrice
              ),

            notes:
              item.notes
                ?.trim() ||
              null,
          };
        }
      );

    const totalAmount =
      roundMoney(
        normalized.reduce(
          (
            total,
            item
          ) =>
            total +
            item.total_amount,
          0
        )
      );

    if (
      totalAmount <=
      0
    ) {
      return {
        success: false,

        message:
          "O total da venda deve ser maior que zero.",
      };
    }

    return {
      success: true,

      items:
        normalized,

      totalAmount,
    };
  } catch (
    error
  ) {
    return {
      success: false,

      message:
        error instanceof
        Error
          ? error.message
          : "Não foi possível validar os anúncios.",
    };
  }
}

/*
 * =====================================================
 * ROLLBACK
 * =====================================================
 */

async function rollbackSale(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  saleId:
    string
) {
  const {
    error,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .delete()
      .eq(
        "id",
        saleId
      );

  if (
    error
  ) {
    console.error(
      "Erro no rollback da venda:",
      error
    );
  }
}

/*
 * =====================================================
 * REVALIDAÇÃO
 * =====================================================
 */

function revalidateSalePaths(
  editionId:
    string,
  saleId:
    string
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

  revalidatePath(
    `/edicoes/${editionId}/vendas/${saleId}`
  );

  revalidatePath(
    "/financeiro"
  );

  revalidatePath(
    "/financeiro/receber"
  );

  revalidatePath(
    "/comissoes"
  );
}

/*
 * =====================================================
 * DISTRIBUIR PARCELAS
 * =====================================================
 */

function distributeAmount(
  total:
    number,
  installments:
    number
) {
  const totalCents =
    Math.round(
      total *
        100
    );

  const baseCents =
    Math.floor(
      totalCents /
        installments
    );

  const remainder =
    totalCents -
    baseCents *
      installments;

  return Array.from(
    {
      length:
        installments,
    },
    (
      _,
      index
    ) =>
      (
        baseCents +
        (
          index <
          remainder
            ? 1
            : 0
        )
      ) /
      100
  );
}

/*
 * =====================================================
 * SOMAR MESES
 * =====================================================
 */

function addMonthsClamped(
  dateValue:
    string,
  months:
    number
) {
  const [
    year,
    month,
    day,
  ] =
    dateValue
      .split("-")
      .map(
        Number
      );

  const target =
    new Date(
      Date.UTC(
        year,
        month -
          1 +
          months,
        1
      )
    );

  const targetYear =
    target
      .getUTCFullYear();

  const targetMonth =
    target
      .getUTCMonth();

  const lastDay =
    new Date(
      Date.UTC(
        targetYear,
        targetMonth +
          1,
        0
      )
    ).getUTCDate();

  const finalDay =
    Math.min(
      day,
      lastDay
    );

  return [
    String(
      targetYear
    ).padStart(
      4,
      "0"
    ),

    String(
      targetMonth +
        1
    ).padStart(
      2,
      "0"
    ),

    String(
      finalDay
    ).padStart(
      2,
      "0"
    ),
  ].join(
    "-"
  );
}

/*
 * =====================================================
 * DINHEIRO
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

/*
 * Percentual com até
 * quatro casas para guardar
 * uma taxa efetiva precisa.
 */
function roundPercentage(
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
        10000
    ) /
    10000
  );
}