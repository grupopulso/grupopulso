import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import {
  createClient,
} from "@supabase/supabase-js";

const ESTAFETA_COMPANY_ID =
  "ec5ed2f3-0052-4d6a-83ac-d60d768c7398";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !supabaseUrl ||
  !serviceRoleKey
) {
  throw new Error(
    "Credenciais do Supabase não configuradas."
  );
}

const supabase =
  createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

const stats = {
  links: 0,
  contractsFound: 0,
  contractsActivated: 0,
  alreadyActive: 0,
  contractsNotFound: 0,
  errors: 0,
};

function getSubscriptionNumber(
  notes: string | null
) {
  if (!notes) {
    return null;
  }

  const match =
    notes.match(
      /Assinatura:\s*(\d+)/
    );

  return (
    match?.[1] ??
    null
  );
}

async function main() {
  console.log(
    "Atualizando contratos pelos roteiros..."
  );

  /*
   * BUSCAR AS 9 ROTAS DO ESTAFETA
   */

  const {
    data: routes,
    error: routesError,
  } =
    await supabase
      .from(
        "delivery_routes"
      )
      .select("id")
      .eq(
        "company_id",
        ESTAFETA_COMPANY_ID
      )
      .eq(
        "active",
        true
      );

  if (routesError) {
    throw routesError;
  }

  const routeIds =
    routes?.map(
      (route) =>
        route.id
    ) ?? [];

  if (!routeIds.length) {
    throw new Error(
      "Nenhuma rota ativa do O Estafeta encontrada."
    );
  }

  /*
   * BUSCAR CLIENTES DAS ROTAS
   */

  const {
    data: links,
    error: linksError,
  } =
    await supabase
      .from(
        "delivery_route_clients"
      )
      .select(`
        id,
        client_id,
        notes
      `)
      .in(
        "route_id",
        routeIds
      )
      .eq(
        "active",
        true
      );

  if (linksError) {
    throw linksError;
  }

  stats.links =
    links?.length ??
    0;

  for (
    let index = 0;
    index <
    (links?.length ?? 0);
    index++
  ) {
    const link =
      links![index];

    const subscriptionNumber =
      getSubscriptionNumber(
        link.notes
      );

    console.log(
      `[${index + 1}/${links!.length}] Cliente ${link.client_id} | Assinatura ${subscriptionNumber ?? "?"}`
    );

    try {
      /*
       * Primeiro tentamos localizar
       * exatamente pelo número da
       * assinatura antiga.
       */

      let query =
        supabase
          .from(
            "contracts"
          )
          .select(`
            id,
            status,
            legacy_subscription_number
          `)
          .eq(
            "company_id",
            ESTAFETA_COMPANY_ID
          )
          .eq(
            "client_id",
            link.client_id
          );

      if (
        subscriptionNumber
      ) {
        query =
          query.eq(
            "legacy_subscription_number",
            subscriptionNumber
          );
      }

      const {
        data: contracts,
        error:
          contractError,
      } =
        await query;

      if (contractError) {
        throw contractError;
      }

      /*
       * Se não encontrou pela
       * assinatura, não ativamos
       * outro contrato no chute.
       */

      if (
        !contracts?.length
      ) {
        stats.contractsNotFound++;

        continue;
      }

      for (
        const contract of
        contracts
      ) {
        stats.contractsFound++;

        if (
          contract.status ===
          "active"
        ) {
          stats.alreadyActive++;

          continue;
        }

        const {
          error:
            updateError,
        } =
          await supabase
            .from(
              "contracts"
            )
            .update({
              status:
                "active",
            })
            .eq(
              "id",
              contract.id
            );

        if (updateError) {
          throw updateError;
        }

        stats.contractsActivated++;
      }
    } catch (error) {
      stats.errors++;

      console.error(
        "Erro:",
        error
      );
    }
  }

  console.log("");
  console.log(
    "=============================="
  );
  console.log(
    "RESUMO DA ATUALIZAÇÃO"
  );
  console.log(
    "=============================="
  );

  console.table(
    stats
  );

  console.log(
    "Datas de vencimento não foram alteradas."
  );
}

main().catch(
  (error) => {
    console.error(
      "Erro fatal:",
      error
    );

    process.exit(1);
  }
);