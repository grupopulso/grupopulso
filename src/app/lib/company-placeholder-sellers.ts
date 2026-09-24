import { createAdminClient } from "@/app/lib/supabase/admin";

/*
 * Quando um usuário sai (fica inativo), os contratos/vendas dele
 * passam a ser do "vendedor da empresa" — um usuário genérico por
 * empresa, usado só como titular de atribuição, sem comissão
 * própria. Identificamos esses usuários pelo NOME exato (e não por
 * id fixo) porque eles ainda precisam ser criados manualmente em
 * Configurações → Usuários; assim que existirem com esse nome, a
 * reatribuição já funciona sem precisar mexer em código de novo.
 *
 * IDs de empresa confirmados por consulta direta ao banco (mesmos
 * usados em financeiro/socios/page.tsx).
 */
export const COMPANY_PLACEHOLDER_SELLER_NAMES: Record<
  string,
  string
> = {
  "a500a41f-9d6b-4cd6-af06-5920a0631dc1":
    "Vendedor Atthus",

  "9d08d74c-c5fe-48c9-b0c5-382cea273d99":
    "Vendedor Pottencializa",

  "ec5ed2f3-0052-4d6a-83ac-d60d768c7398":
    "Vendedor O Estafeta",
};

export const O_ESTAFETA_COMPANY_ID =
  "ec5ed2f3-0052-4d6a-83ac-d60d768c7398";

/*
 * Resolve os ids reais desses usuários hoje no banco. Uma empresa
 * cujo vendedor-placeholder ainda não foi criado simplesmente não
 * aparece no mapa retornado (o chamador decide o que fazer).
 */
export async function resolveCompanyPlaceholderSellerIds(
  adminDb: ReturnType<
    typeof createAdminClient
  >
): Promise<Record<string, string>> {
  const names = Object.values(
    COMPANY_PLACEHOLDER_SELLER_NAMES
  );

  const { data } = await adminDb
    .from("user_profiles")
    .select("id, name")
    .in("name", names);

  const idByName = new Map(
    (data ?? []).map(
      (profile) => [
        profile.name,
        profile.id,
      ]
    )
  );

  const idByCompanyId: Record<
    string,
    string
  > = {};

  for (const [
    companyId,
    name,
  ] of Object.entries(
    COMPANY_PLACEHOLDER_SELLER_NAMES
  )) {
    const userId =
      idByName.get(name);

    if (userId) {
      idByCompanyId[companyId] =
        userId;
    }
  }

  return idByCompanyId;
}
