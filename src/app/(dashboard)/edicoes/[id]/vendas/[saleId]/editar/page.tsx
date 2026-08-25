import Link from "next/link";

import {
  ArrowLeft,
  Pencil,
} from "lucide-react";

import {
  notFound,
} from "next/navigation";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import EditSaleForm from "./edit-sale-form";

type PageProps = {
  params: Promise<{
    id: string;
    saleId: string;
  }>;
};

export default async function EditEditionSalePage({
  params,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const {
    id: editionId,
    saleId,
  } = await params;

  const supabase =
    await createClient();

  /*
   * =========================
   * EDIÇÃO
   * =========================
   */

  const {
    data: edition,
    error: editionError,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .select(`
        id,
        company_id,
        name,
        edition_number,
        status,

        company:companies (
          id,
          name
        )
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
    notFound();
  }

  /*
   * =========================
   * VENDA
   * =========================
   */

  const {
    data: sale,
    error: saleError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .select(`
        id,
        edition_id,
        company_id,
        client_id,
        seller_user_id,
        status,
        payment_method_id,
        installments,
        first_due_date,
        notes,

        items:edition_sale_items (
          id,
          section_id,
          description,
          placement,
          print_type,
          quantity,
          unit_price,
          total_amount,
          notes
        )
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
    notFound();
  }

  if (
    sale.status ===
    "cancelled"
  ) {
    return (
      <main className="min-h-screen bg-[#f5f7f6] p-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href={`/edicoes/${editionId}/vendas/${saleId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />

            Voltar para venda
          </Link>

          <div className="mt-7 rounded-2xl border border-red-100 bg-white p-8">
            <h1 className="text-xl font-semibold text-slate-900">
              Venda cancelada
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Uma venda cancelada não pode ser editada.
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * =========================
   * PARCELAS
   * =========================
   */

  const {
    data:
      installmentLinks,
    error:
      installmentLinksError,
  } =
    await supabase
      .from(
        "edition_sale_installments"
      )
      .select(`
        financial_entry_id
      `)
      .eq(
        "sale_id",
        sale.id
      );

  if (
    installmentLinksError
  ) {
    console.error(
      "Erro ao carregar parcelas:",
      installmentLinksError
    );
  }

  const financialEntryIds =
    (
      installmentLinks ??
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
          Boolean(value)
      );

  let hasReceipts =
    false;

  if (
    financialEntryIds.length >
    0
  ) {
    const {
      data:
        financialEntries,
      error:
        financialEntriesError,
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
          financialEntryIds
        );

    if (
      financialEntriesError
    ) {
      console.error(
        "Erro ao verificar recebimentos:",
        financialEntriesError
      );
    }

    hasReceipts =
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
          ) > 0
      );
  }

  /*
   * =========================
   * CLIENTES
   * =========================
   */

  const {
    data: clients,
    error: clientsError,
  } =
    await supabase
      .from(
        "clients"
      )
      .select(`
        id,
        name
      `)
      .eq(
        "active",
        true
      )
      .order(
        "name"
      );

  if (
    clientsError
  ) {
    console.error(
      "Erro ao carregar clientes:",
      clientsError
    );
  }

  /*
   * =========================
   * CADERNOS
   * =========================
   */

  const {
    data: sections,
    error: sectionsError,
  } =
    await supabase
      .from(
        "edition_sections"
      )
      .select(`
        id,
        name,
        description
      `)
      .eq(
        "edition_id",
        edition.id
      )
      .eq(
        "active",
        true
      )
      .order(
        "name"
      );

  if (
    sectionsError
  ) {
    console.error(
      "Erro ao carregar cadernos:",
      sectionsError
    );
  }

  /*
   * =========================
   * PAGAMENTOS
   * =========================
   */

  const {
    data: paymentMethods,
    error:
      paymentMethodsError,
  } =
    await supabase
      .from(
        "financial_payment_methods"
      )
      .select(`
        id,
        name,
        code
      `)
      .eq(
        "active",
        true
      )
      .in(
        "usage_type",
        [
          "income",
          "both",
        ]
      )
      .order(
        "name"
      );

  if (
    paymentMethodsError
  ) {
    console.error(
      "Erro ao carregar formas de pagamento:",
      paymentMethodsError
    );
  }

  /*
   * =========================
   * VENDEDORES
   * =========================
   */

  const {
    data: sellerSettings,
    error:
      sellerSettingsError,
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
        "company_id",
        edition.company_id
      )
      .eq(
        "active",
        true
      );

  if (
    sellerSettingsError
  ) {
    console.error(
      "Erro ao carregar vendedores:",
      sellerSettingsError
    );
  }

  const sellerIds =
    (
      sellerSettings ??
      []
    ).map(
      (
        setting
      ) =>
        setting.user_id
    );

  let sellers: {
    id: string;
    full_name: string | null;
    email: string | null;
    commissionPercentage: number;
  }[] = [];

  if (
    sellerIds.length >
    0
  ) {
    const {
      data:
        sellerProfiles,
      error:
        sellerProfilesError,
    } =
      await supabase
        .from(
          "profiles"
        )
        .select(`
          id,
          full_name,
          email
        `)
        .in(
          "id",
          sellerIds
        )
        .eq(
          "active",
          true
        )
        .order(
          "full_name"
        );

    if (
      sellerProfilesError
    ) {
      console.error(
        "Erro ao carregar vendedores:",
        sellerProfilesError
      );
    }

    sellers =
      (
        sellerProfiles ??
        []
      ).map(
        (
          profile
        ) => {
          const setting =
            (
              sellerSettings ??
              []
            ).find(
              (
                item
              ) =>
                item.user_id ===
                profile.id
            );

          return {
            id:
              profile.id,

            full_name:
              profile.full_name,

            email:
              profile.email,

            commissionPercentage:
              Number(
                setting
                  ?.commission_percentage ??
                  0
              ),
          };
        }
      );

    if (
      access.profile.role ===
      "seller"
    ) {
      sellers =
        sellers.filter(
          (
            seller
          ) =>
            seller.id ===
            access.user.id
        );
    }
  }

  const company =
    getFirst(
      edition.company
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-6xl">

        <Link
          href={`/edicoes/${editionId}/vendas/${saleId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Voltar para venda
        </Link>

        <div className="mt-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
            <Pencil className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Editar venda
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {edition.name}

              {edition.edition_number
                ? ` • Edição nº ${edition.edition_number}`
                : ""}

              {company?.name
                ? ` • ${company.name}`
                : ""}
            </p>
          </div>
        </div>

        {hasReceipts && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-semibold text-amber-800">
              Esta venda já possui recebimento registrado.
            </p>

            <p className="mt-1 text-sm text-amber-700">
              Os dados financeiros da venda estão bloqueados para evitar inconsistências no financeiro e nas comissões.
            </p>
          </div>
        )}

        <EditSaleForm
          sale={{
            id:
              sale.id,

            editionId:
              edition.id,

            clientId:
              sale.client_id,

            sellerUserId:
              sale.seller_user_id,

            paymentMethodId:
              sale.payment_method_id ??
              "",

            installments:
              Number(
                sale.installments ??
                  1
              ),

            firstDueDate:
              sale.first_due_date ??
              "",

            notes:
              sale.notes ??
              "",

            items:
              (
                sale.items ??
                []
              ).map(
                (
                  item
                ) => ({
                  id:
                    item.id,

                  sectionId:
                    item.section_id ??
                    "",

                  description:
                    item.description,

                  placement:
                    item.placement ??
                    "",

                  printType:
                    item.print_type ??
                    "",

                  quantity:
                    Number(
                      item.quantity
                    ),

                  unitPrice:
                    Number(
                      item.unit_price
                    ),

                  notes:
                    item.notes ??
                    "",
                })
              ),
          }}
          clients={
            clients ??
            []
          }
          sellers={
            sellers
          }
          sections={
            sections ??
            []
          }
          paymentMethods={
            paymentMethods ??
            []
          }
          sellerLocked={
            access.profile.role ===
            "seller"
          }
          financialLocked={
            hasReceipts
          }
        />
      </div>
    </main>
  );
}

function getFirst<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(
    value
  )
    ? value[0] ??
        null
    : value;
}