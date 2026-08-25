import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import {
  createClient,
} from "@supabase/supabase-js";

type RouteRecord = {
  route_code: string;
  route_name: string;

  driver_code: string;
  driver_name: string;

  delivery_order: number;

  subscription_number: string;

  legacy_code: string;

  client_name: string;
};

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

/*
 * =========================
 * ARQUIVO DE ENTRADA
 * =========================
 *
 * Vamos gerar esse JSON
 * consolidado dos 9 PDFs.
 */

const inputPath =
  path.join(
    process.cwd(),
    "scripts",
    "data",
    "rotas-estafeta.json"
  );

if (
  !fs.existsSync(
    inputPath
  )
) {
  throw new Error(
    `Arquivo não encontrado: ${inputPath}`
  );
}

const raw =
  fs.readFileSync(
    inputPath,
    "utf8"
  );

const records =
  JSON.parse(
    raw
  ) as RouteRecord[];

/*
 * =========================
 * ESTATÍSTICAS
 * =========================
 */

const stats = {
  total:
    records.length,

  clientsFound: 0,
  clientsNotFound: 0,

  clientsActivated: 0,

  driversCreated: 0,
  driversFound: 0,

  routesCreated: 0,
  routesFound: 0,

  linksCreated: 0,
  linksUpdated: 0,

  addressesFound: 0,
  addressesMissing: 0,

  errors: 0,
};

const errors: unknown[] =
  [];

/*
 * =========================
 * CACHE
 * =========================
 */

const driverCache =
  new Map<
    string,
    string
  >();

const routeCache =
  new Map<
    string,
    string
  >();

/*
 * =========================
 * ENTREGADOR
 * =========================
 */

async function getOrCreateDriver(
  name: string,
  code: string
) {
  const cacheKey =
    `${code}-${name}`
      .trim()
      .toLowerCase();

  const cached =
    driverCache.get(
      cacheKey
    );

  if (cached) {
    return cached;
  }

  const {
    data: existing,
    error:
      existingError,
  } =
    await supabase
      .from(
        "delivery_drivers"
      )
      .select(
        "id"
      )
      .eq(
        "company_id",
        ESTAFETA_COMPANY_ID
      )
      .eq(
        "name",
        name
      )
      .maybeSingle();

  if (
    existingError
  ) {
    throw existingError;
  }

  if (existing) {
    stats.driversFound++;

    driverCache.set(
      cacheKey,
      existing.id
    );

    return existing.id;
  }

  const {
    data: created,
    error:
      createError,
  } =
    await supabase
      .from(
        "delivery_drivers"
      )
      .insert({
        company_id:
          ESTAFETA_COMPANY_ID,

        name,

        notes:
          code
            ? `Código legado do entregador: ${code}`
            : null,

        active:
          true,
      })
      .select(
        "id"
      )
      .single();

  if (
    createError ||
    !created
  ) {
    throw (
      createError ??
      new Error(
        "Erro ao criar entregador."
      )
    );
  }

  stats.driversCreated++;

  driverCache.set(
    cacheKey,
    created.id
  );

  return created.id;
}

/*
 * =========================
 * ROTA
 * =========================
 */

async function getOrCreateRoute(
  routeCode: string,
  routeName: string,
  driverId: string
) {
  const cacheKey =
    routeCode;

  const cached =
    routeCache.get(
      cacheKey
    );

  if (cached) {
    return cached;
  }

  /*
   * Procuramos pelo código
   * legado salvo na descrição.
   */

  const {
    data: existingRoutes,
    error:
      existingError,
  } =
    await supabase
      .from(
        "delivery_routes"
      )
      .select(
        "id, description"
      )
      .eq(
        "company_id",
        ESTAFETA_COMPANY_ID
      );

  if (
    existingError
  ) {
    throw existingError;
  }

  const existing =
    existingRoutes?.find(
      (route) =>
        route.description?.includes(
          `Código legado: ${routeCode}`
        )
    );

  if (existing) {
    stats.routesFound++;

    await supabase
      .from(
        "delivery_routes"
      )
      .update({
        name:
          routeName,

        driver_id:
          driverId,

        active:
          true,
      })
      .eq(
        "id",
        existing.id
      );

    routeCache.set(
      cacheKey,
      existing.id
    );

    return existing.id;
  }

  const {
    data: created,
    error:
      createError,
  } =
    await supabase
      .from(
        "delivery_routes"
      )
      .insert({
        company_id:
          ESTAFETA_COMPANY_ID,

        driver_id:
          driverId,

        name:
          routeName,

        description:
          `Código legado: ${routeCode}`,

        active:
          true,
      })
      .select(
        "id"
      )
      .single();

  if (
    createError ||
    !created
  ) {
    throw (
      createError ??
      new Error(
        "Erro ao criar rota."
      )
    );
  }

  stats.routesCreated++;

  routeCache.set(
    cacheKey,
    created.id
  );

  return created.id;
}

/*
 * =========================
 * CLIENTE
 * =========================
 */

async function findClient(
  legacyCode: string
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "clients"
      )
      .select(
        "id, name, active"
      )
      .eq(
        "legacy_code",
        legacyCode
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/*
 * =========================
 * ENDEREÇO PRINCIPAL
 * =========================
 */

async function getPrimaryAddress(
  clientId: string
) {
  const {
    data: primary,
    error:
      primaryError,
  } =
    await supabase
      .from(
        "client_addresses"
      )
      .select(
        "id"
      )
      .eq(
        "client_id",
        clientId
      )
      .eq(
        "is_primary",
        true
      )
      .maybeSingle();

  if (
    primaryError
  ) {
    throw primaryError;
  }

  if (primary) {
    return primary.id;
  }

  const {
    data: anyAddress,
    error:
      addressError,
  } =
    await supabase
      .from(
        "client_addresses"
      )
      .select(
        "id"
      )
      .eq(
        "client_id",
        clientId
      )
      .limit(1)
      .maybeSingle();

  if (
    addressError
  ) {
    throw addressError;
  }

  return (
    anyAddress?.id ??
    null
  );
}

/*
 * =========================
 * PROCESSAR REGISTRO
 * =========================
 */

async function processRecord(
  record: RouteRecord
) {
  try {
    /*
     * CLIENTE
     */

    const client =
      await findClient(
        record.legacy_code
      );

    if (!client) {
      stats.clientsNotFound++;

      errors.push({
        type:
          "client_not_found",

        legacy_code:
          record.legacy_code,

        subscription_number:
          record.subscription_number,

        client_name:
          record.client_name,

        route_code:
          record.route_code,

        route_name:
          record.route_name,
      });

      return;
    }

    stats.clientsFound++;

    /*
     * ATIVAR CLIENTE
     *
     * Regra atual:
     * se está no roteiro,
     * é cliente ativo.
     */

    if (
      !client.active
    ) {
      const {
        error:
          activateError,
      } =
        await supabase
          .from(
            "clients"
          )
          .update({
            active:
              true,
          })
          .eq(
            "id",
            client.id
          );

      if (
        activateError
      ) {
        throw activateError;
      }

      stats.clientsActivated++;
    }

    /*
     * GARANTIR VÍNCULO
     * COM O ESTAFETA
     */

    const {
      error:
        clientCompanyError,
    } =
      await supabase
        .from(
          "client_companies"
        )
        .upsert(
          {
            client_id:
              client.id,

            company_id:
              ESTAFETA_COMPANY_ID,

            status:
              "active",
          },
          {
            onConflict:
              "client_id,company_id",
          }
        );

    if (
      clientCompanyError
    ) {
      throw clientCompanyError;
    }

    /*
     * ENDEREÇO
     */

    const addressId =
      await getPrimaryAddress(
        client.id
      );

    if (addressId) {
      stats.addressesFound++;
    } else {
      stats.addressesMissing++;
    }

    /*
     * ENTREGADOR
     */

    const driverId =
      await getOrCreateDriver(
        record.driver_name,
        record.driver_code
      );

    /*
     * ROTA
     */

    const routeId =
      await getOrCreateRoute(
        record.route_code,
        record.route_name,
        driverId
      );

    /*
     * VERIFICAR VÍNCULO
     */

    const {
      data:
        existingLink,
      error:
        existingLinkError,
    } =
      await supabase
        .from(
          "delivery_route_clients"
        )
        .select(
          "id"
        )
        .eq(
          "route_id",
          routeId
        )
        .eq(
          "client_id",
          client.id
        )
        .maybeSingle();

    if (
      existingLinkError
    ) {
      throw existingLinkError;
    }

    const notes =
      [
        record.subscription_number
          ? `Assinatura: ${record.subscription_number}`
          : null,

        record.legacy_code
          ? `Código cliente: ${record.legacy_code}`
          : null,
      ]
        .filter(
          Boolean
        )
        .join(
          " | "
        );

    /*
     * ATUALIZAR
     */

    if (existingLink) {
      const {
        error:
          updateError,
      } =
        await supabase
          .from(
            "delivery_route_clients"
          )
          .update({
            address_id:
              addressId,

            delivery_order:
              record.delivery_order,

            notes,

            active:
              true,
          })
          .eq(
            "id",
            existingLink.id
          );

      if (
        updateError
      ) {
        throw updateError;
      }

      stats.linksUpdated++;

      return;
    }

    /*
     * CRIAR
     */

    const {
      error:
        insertError,
    } =
      await supabase
        .from(
          "delivery_route_clients"
        )
        .insert({
          route_id:
            routeId,

          client_id:
            client.id,

          address_id:
            addressId,

          delivery_order:
            record.delivery_order,

          notes,

          active:
            true,
        });

    if (
      insertError
    ) {
      throw insertError;
    }

    stats.linksCreated++;
  } catch (error) {
    stats.errors++;

    errors.push({
      type:
        "processing_error",

      record,

      error:
        error instanceof
        Error
          ? error.message
          : String(error),
    });

    console.error(
      `Erro em ${record.legacy_code} - ${record.client_name}:`,
      error
    );
  }
}

/*
 * =========================
 * EXECUTAR
 * =========================
 */

async function main() {
  console.log(
    "================================"
  );

  console.log(
    "IMPORTAÇÃO DE ROTAS - O ESTAFETA"
  );

  console.log(
    "================================"
  );

  console.log(
    `Registros recebidos: ${records.length}`
  );

  console.log("");

  /*
   * Rodamos sequencialmente
   * para reduzir risco de rate
   * limit e facilitar auditoria.
   */

  for (
    let index = 0;
    index <
    records.length;
    index++
  ) {
    const record =
      records[index];

    console.log(
      `[${index + 1}/${records.length}] ${record.route_code} | ${record.delivery_order} | ${record.legacy_code} | ${record.client_name}`
    );

    await processRecord(
      record
    );
  }

  /*
   * =========================
   * SALVAR ERROS
   * =========================
   */

  const errorPath =
    path.join(
      process.cwd(),
      "scripts",
      "import-rotas-estafeta-erros.json"
    );

  fs.writeFileSync(
    errorPath,
    JSON.stringify(
      errors,
      null,
      2
    ),
    "utf8"
  );

  /*
   * =========================
   * RESUMO
   * =========================
   */

  console.log("");

  console.log(
    "================================"
  );

  console.log(
    "RESUMO"
  );

  console.log(
    "================================"
  );

  console.table(
    stats
  );

  console.log("");

  console.log(
    `Arquivo de revisão: ${errorPath}`
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