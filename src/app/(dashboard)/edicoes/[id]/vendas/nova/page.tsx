import Link from "next/link";

import {
  ArrowLeft,
  ShoppingCart,
} from "lucide-react";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import {
  notFound,
} from "next/navigation";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  SaleForm,
} from "./sale-form";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type RawPosition = {
  id: string;

  position_code: string;

  name: string;

  capacity:
    | number
    | null;

  manually_blocked:
    boolean;

  blocked_reason:
    | string
    | null;

  active:
    boolean;
};

export default async function NewEditionSalePage({
  params,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const {
    id: editionId,
  } =
    await params;

  const supabase =
    await createClient();

  /*
   * =====================================================
   * EDIÇÃO
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
        name,
        edition_number,
        publication_date,
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
        access
          .estafetaCompany
          .id
      )
      .maybeSingle();

  if (
    editionError ||
    !edition
  ) {
    console.error(
      "Erro ao carregar edição:",
      editionError
    );

    notFound();
  }

  if (
    edition.status !==
    "open"
  ) {
    return (
      <main className="min-h-screen bg-[#f5f7f6] p-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/edicoes/${edition.id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />

            Voltar para edição
          </Link>

          <div className="mt-7 rounded-2xl border border-amber-100 bg-white p-8">
            <h1 className="text-xl font-semibold text-slate-900">
              Edição não está aberta
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Novas vendas só podem ser registradas em uma edição aberta.
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * =====================================================
   * CLIENTES
   * =====================================================
   */

  const {
    data: clients,
    error:
      clientsError,
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
   * =====================================================
   * PRODUTOS / SERVIÇOS
   * =====================================================
   *
   * A comissão pode ser:
   *
   * null
   * → usar comissão padrão do vendedor
   *
   * 0
   * → produto sem comissão
   *
   * > 0
   * → comissão específica do produto
   */

  const {
    data: products,
    error:
      productsError,
  } =
    await supabase
      .from(
        "products"
      )
      .select(`
        id,
        name,
        default_price,
        commission_percentage,
        active
      `)
      .eq(
        "company_id",
        edition.company_id
      )
      .eq(
        "active",
        true
      )
      .order(
        "name"
      );

  if (
    productsError
  ) {
    console.error(
      "Erro ao carregar produtos:",
      productsError
    );
  }

  /*
   * =====================================================
   * CADERNOS + POSIÇÕES
   * =====================================================
   */

  const {
    data: sections,
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
        description,
        sales_goal,

        positions:edition_ad_positions (
          id,
          position_code,
          name,
          capacity,
          manually_blocked,
          blocked_reason,
          active
        )
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
   * =====================================================
   * POSIÇÕES GERAIS
   * =====================================================
   */

  const {
    data:
      generalPositions,
    error:
      generalPositionsError,
  } =
    await supabase
      .from(
        "edition_ad_positions"
      )
      .select(`
        id,
        position_code,
        name,
        capacity,
        manually_blocked,
        blocked_reason,
        active
      `)
      .eq(
        "edition_id",
        edition.id
      )
      .is(
        "section_id",
        null
      )
      .eq(
        "active",
        true
      );

  if (
    generalPositionsError
  ) {
    console.error(
      "Erro ao carregar posições gerais:",
      generalPositionsError
    );
  }

  /*
   * =====================================================
   * POSIÇÕES JÁ UTILIZADAS
   * =====================================================
   */

  const {
    data:
      confirmedSaleItems,
    error:
      confirmedSaleItemsError,
  } =
    await supabase
      .from(
        "edition_sale_items"
      )
      .select(`
        id,
        ad_position_id,

        sale:edition_sales!inner (
          id,
          edition_id,
          status
        )
      `)
      .eq(
        "sale.edition_id",
        edition.id
      )
      .eq(
        "sale.status",
        "confirmed"
      )
      .not(
        "ad_position_id",
        "is",
        null
      );

  if (
    confirmedSaleItemsError
  ) {
    console.error(
      "Erro ao verificar posições utilizadas:",
      confirmedSaleItemsError
    );
  }

  const soldByPosition =
    new Map<
      string,
      number
    >();

  for (
    const item of
      confirmedSaleItems ??
      []
  ) {
    if (
      !item.ad_position_id
    ) {
      continue;
    }

    soldByPosition.set(
      item.ad_position_id,
      (
        soldByPosition.get(
          item.ad_position_id
        ) ??
        0
      ) +
        1
    );
  }

  /*
   * =====================================================
   * NORMALIZAR POSIÇÃO
   * =====================================================
   */

  function normalizePosition(
    position:
      RawPosition
  ) {
    const soldCount =
      soldByPosition.get(
        position.id
      ) ??
      0;

    const capacity =
      position.capacity ===
      null
        ? null
        : Number(
            position.capacity
          );

    return {
      id:
        position.id,

      positionCode:
        position.position_code,

      name:
        position.name,

      capacity,

      soldCount,

      manuallyBlocked:
        Boolean(
          position
            .manually_blocked
        ),

      blockedReason:
        position
          .blocked_reason,

      exhausted:
        capacity !==
          null &&
        soldCount >=
          capacity,
    };
  }

  /*
   * =====================================================
   * CADERNOS PARA O FORM
   * =====================================================
   */

  const saleSections =
    (
      sections ??
      []
    ).map(
      (
        section
      ) => ({
        id:
          section.id,

        name:
          section.name,

        description:
          section.description,

        salesGoal:
          Number(
            section.sales_goal ??
              0
          ),

        positions:
          (
            section.positions ??
            []
          )
            .filter(
              (
                position
              ) =>
                position.active
            )
            .map(
              normalizePosition
            ),
      })
    );

  /*
   * =====================================================
   * POSIÇÕES GERAIS PARA O FORM
   * =====================================================
   */

  const saleGeneralPositions =
    (
      generalPositions ??
      []
    )
      .filter(
        (
          position
        ) =>
          position.active
      )
      .map(
        normalizePosition
      );

  /*
   * =====================================================
   * PRODUTOS PARA O FORM
   * =====================================================
   */

  const saleProducts =
    (
      products ??
      []
    ).map(
      (
        product
      ) => ({
        id:
          product.id,

        name:
          product.name,

        defaultPrice:
          product.default_price ===
          null
            ? null
            : Number(
                product.default_price
              ),

        commissionPercentage:
          product
            .commission_percentage ===
          null
            ? null
            : Number(
                product
                  .commission_percentage
              ),
      })
    );

  /*
   * =====================================================
   * FORMAS DE PAGAMENTO
   * =====================================================
   */

  const {
    data:
      paymentMethods,
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
        code,
        usage_type,
        active
      `)
      .eq(
        "active",
        true
      )
      .in(
        "usage_type",
        [
          "both",
          "income",
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
   * =====================================================
   * VENDEDORES
   * =====================================================
   */

  const {
    data:
      sellerSettings,
    error:
      sellerSettingsError,
  } =
    await supabase
      .from(
        "seller_settings"
      )
      .select(`
        user_id,
        commission_percentage,
        active
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

  const sellerUserIds =
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

    name:
      | string
      | null;

    commissionPercentage:
      number;
  }[] = [];

  if (
    sellerUserIds.length >
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
          "user_profiles"
        )
        .select(`
          id,
          name,
          role
        `)
        .in(
          "id",
          sellerUserIds
        )
        .eq(
          "active",
          true
        )
        .order(
          "name"
        );

    if (
      sellerProfilesError
    ) {
      console.error(
        "Erro ao carregar perfis dos vendedores:",
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

            name:
              profile.name,

            commissionPercentage:
              Number(
                setting
                  ?.commission_percentage ??
                  0
              ),
          };
        }
      );

    /*
     * Vendedor comum
     * só pode vender
     * em seu próprio nome.
     */

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

  /*
   * =====================================================
   * AUXILIARES
   * =====================================================
   */

  const company =
    getFirst(
      edition.company
    );

  const initialSellerId =
    access.profile.role ===
      "seller"
      ? access.user.id
      : "";

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-6xl">

        <Link
          href={`/edicoes/${edition.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Voltar para edição
        </Link>

        <div className="mt-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
            <ShoppingCart className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Nova venda
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {
                edition.name
              }

              {edition.edition_number
                ? ` • Edição nº ${edition.edition_number}`
                : ""}

              {company?.name
                ? ` • ${company.name}`
                : ""}
            </p>
          </div>
        </div>

        <SaleForm
          editionId={
            edition.id
          }

          clients={
            clients ??
            []
          }

          sellers={
            sellers
          }

          products={
            saleProducts
          }

          sections={
            saleSections
          }

          generalPositions={
            saleGeneralPositions
          }

          paymentMethods={
            (
              paymentMethods ??
              []
            ).map(
              (
                method
              ) => ({
                id:
                  method.id,

                name:
                  method.name,

                code:
                  method.code,
              })
            )
          }

          initialSellerId={
            initialSellerId
          }

          sellerLocked={
            access.profile.role ===
            "seller"
          }
        />
      </div>
    </main>
  );
}

/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

function getFirst<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (
    !value
  ) {
    return null;
  }

  return Array.isArray(
    value
  )
    ? value[0] ??
        null
    : value;
}