import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

type RawPosition = {
  id: string;
  position_code: string;
  name: string;
  capacity: number | null;
  manually_blocked: boolean;
  blocked_reason: string | null;
  active: boolean;
};

type NormalizedPosition = {
  id: string;
  positionCode: string;
  name: string;
  capacity: number | null;
  soldCount: number;
  manuallyBlocked: boolean;
  blockedReason: string | null;
  exhausted: boolean;
};

export type SaleFormData = {
  edition: {
    id: string;
    name: string;
    edition_number: number | null;
    company_id: string;
    companyName: string | null;
  };

  clients: {
    id: string;
    name: string;
  }[];

  sellers: {
    id: string;
    name: string | null;
    commissionPercentage: number;
  }[];

  products: {
    id: string;
    name: string;
    defaultPrice: number | null;
    commissionPercentage: number | null;
  }[];

  sections: {
    id: string;
    name: string;
    description: string | null;
    salesGoal: number;
    positions: NormalizedPosition[];
  }[];

  generalPositions: NormalizedPosition[];

  paymentMethods: {
    id: string;
    name: string;
    code: string;
  }[];

  initialSellerId: string;
  sellerLocked: boolean;
};

export type LoadSaleFormResult =
  | { status: "not-found" }
  | {
      status: "not-open";
      editionId: string;
      editionName: string;
    }
  | { status: "ok"; data: SaleFormData };

/*
 * Carrega tudo que o formulário de venda de edição precisa
 * (clientes, produtos, cadernos + posições, vendedores, formas
 * de pagamento) para uma edição específica. Usado tanto pela
 * criação a partir da edição quanto pela nova sub-área /edicoes/vendas.
 */
export async function loadSaleFormData(
  editionId: string
): Promise<LoadSaleFormResult> {
  const access =
    await requireEstafetaAccess();

  /*
   * Leitura via service role: `requireEstafetaAccess` já
   * garantiu o acesso e tudo é filtrado por
   * `access.estafetaCompany.id`. Necessário porque
   * `products` e `financial_payment_methods` têm RLS por
   * módulo (products / financial) que o vendedor não tem.
   */
  const supabase = createAdminClient();

  const {
    data: edition,
    error: editionError,
  } = await supabase
    .from("newspaper_editions")
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
    .eq("id", editionId)
    .eq(
      "company_id",
      access.estafetaCompany.id
    )
    .maybeSingle();

  if (editionError || !edition) {
    return { status: "not-found" };
  }

  if (edition.status !== "open") {
    return {
      status: "not-open",
      editionId: edition.id,
      editionName: edition.name,
    };
  }

  const [
    clientsResult,
    productsResult,
    sectionsResult,
    generalPositionsResult,
    confirmedItemsResult,
    paymentMethodsResult,
    sellerSettingsResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name")
      .eq("active", true)
      .order("name"),

    supabase
      .from("products")
      .select(`
        id,
        name,
        default_price,
        commission_percentage,
        active
      `)
      .eq("company_id", edition.company_id)
      .eq("active", true)
      .order("name"),

    supabase
      .from("edition_sections")
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
      .eq("edition_id", edition.id)
      .eq("active", true)
      .order("name"),

    supabase
      .from("edition_ad_positions")
      .select(`
        id,
        position_code,
        name,
        capacity,
        manually_blocked,
        blocked_reason,
        active
      `)
      .eq("edition_id", edition.id)
      .is("section_id", null)
      .eq("active", true),

    supabase
      .from("edition_sale_items")
      .select(`
        id,
        ad_position_id,

        sale:edition_sales!inner (
          id,
          edition_id,
          status
        )
      `)
      .eq("sale.edition_id", edition.id)
      .eq("sale.status", "confirmed")
      .not("ad_position_id", "is", null),

    supabase
      .from("financial_payment_methods")
      .select(`
        id,
        name,
        code,
        usage_type,
        active
      `)
      .eq("active", true)
      .in("usage_type", ["both", "income"])
      .order("name"),

    supabase
      .from("seller_settings")
      .select(`
        user_id,
        commission_percentage,
        active
      `)
      .eq("company_id", edition.company_id)
      .eq("active", true),
  ]);

  const soldByPosition = new Map<
    string,
    number
  >();

  for (const item of confirmedItemsResult.data ??
    []) {
    if (!item.ad_position_id) {
      continue;
    }

    soldByPosition.set(
      item.ad_position_id,
      (soldByPosition.get(
        item.ad_position_id
      ) ?? 0) + 1
    );
  }

  function normalizePosition(
    position: RawPosition
  ): NormalizedPosition {
    const soldCount =
      soldByPosition.get(position.id) ?? 0;

    const capacity =
      position.capacity === null
        ? null
        : Number(position.capacity);

    return {
      id: position.id,
      positionCode: position.position_code,
      name: position.name,
      capacity,
      soldCount,
      manuallyBlocked: Boolean(
        position.manually_blocked
      ),
      blockedReason:
        position.blocked_reason,
      exhausted:
        capacity !== null &&
        soldCount >= capacity,
    };
  }

  const sections = (
    sectionsResult.data ?? []
  ).map((section) => ({
    id: section.id,
    name: section.name,
    description: section.description,
    salesGoal: Number(
      section.sales_goal ?? 0
    ),
    positions: (
      (section.positions ??
        []) as RawPosition[]
    )
      .filter((position) => position.active)
      .map(normalizePosition),
  }));

  const generalPositions = (
    (generalPositionsResult.data ??
      []) as RawPosition[]
  )
    .filter((position) => position.active)
    .map(normalizePosition);

  const products = (
    productsResult.data ?? []
  ).map((product) => ({
    id: product.id,
    name: product.name,
    defaultPrice:
      product.default_price === null
        ? null
        : Number(product.default_price),
    commissionPercentage:
      product.commission_percentage ===
      null
        ? null
        : Number(
            product.commission_percentage
          ),
  }));

  /*
   * VENDEDORES
   */

  const sellerUserIds = (
    sellerSettingsResult.data ?? []
  ).map((setting) => setting.user_id);

  let sellers: SaleFormData["sellers"] =
    [];

  if (sellerUserIds.length > 0) {
    const { data: sellerProfiles } =
      await supabase
        .from("user_profiles")
        .select("id, name")
        .in("id", sellerUserIds)
        .eq("active", true)
        .order("name");

    sellers = (sellerProfiles ?? []).map(
      (profile) => {
        const setting = (
          sellerSettingsResult.data ?? []
        ).find(
          (item) =>
            item.user_id === profile.id
        );

        return {
          id: profile.id,
          name: profile.name,
          commissionPercentage: Number(
            setting?.commission_percentage ??
              0
          ),
        };
      }
    );

    if (
      access.profile.role === "seller"
    ) {
      sellers = sellers.filter(
        (seller) =>
          seller.id === access.user.id
      );
    }
  }

  const company = getFirst(
    edition.company
  );

  return {
    status: "ok",
    data: {
      edition: {
        id: edition.id,
        name: edition.name,
        edition_number:
          edition.edition_number,
        company_id: edition.company_id,
        companyName: company?.name ?? null,
      },

      clients:
        clientsResult.data ?? [],

      sellers,

      products,

      sections,

      generalPositions,

      paymentMethods: (
        paymentMethodsResult.data ?? []
      ).map((method) => ({
        id: method.id,
        name: method.name,
        code: method.code,
      })),

      initialSellerId:
        access.profile.role === "seller"
          ? access.user.id
          : "",

      sellerLocked:
        access.profile.role === "seller",
    },
  };
}

function getFirst<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}
