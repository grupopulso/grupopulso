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

export default async function NewEditionSalePage({
  params,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const {
    id: editionId,
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
        access.estafetaCompany.id
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
   * FORMAS DE PAGAMENTO
   * =========================
   */

  const {
    data: paymentMethods,
    error: paymentMethodsError,
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
    full_name: string | null;
    email: string | null;
    commissionPercentage: number;
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
          "profiles"
        )
        .select(`
          id,
          full_name,
          email,
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
          "full_name"
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

    /*
     * VENDEDOR COMUM
     *
     * Só pode lançar venda
     * em nome dele mesmo.
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
   * =========================
   * DADOS AUXILIARES
   * =========================
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
        {/* VOLTAR */}

        <Link
          href={`/edicoes/${edition.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Voltar para edição
        </Link>

        {/* CABEÇALHO */}

        <div className="mt-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
            <ShoppingCart className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Nova venda
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

        {/* FORMULÁRIO */}

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
          sections={
            sections ??
            []
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