import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import {
  createClient,
} from "@supabase/supabase-js";

dotenv.config({
  path: ".env.local",
});

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

type MissingClientRecord = {
  legacy_code: string;
  subscription_number: string;
  client_name: string;
  type: "individual" | "company";

  route_code: string;
  route_name: string;

  driver_code: string;
  driver_name: string;

  delivery_order: number;

  address: {
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    reference: string | null;
  };
};

const inputPath =
  path.join(
    process.cwd(),
    "scripts",
    "data",
    "clientes-faltantes-rotas.json"
  );

if (!fs.existsSync(inputPath)) {
  throw new Error(
    `Arquivo não encontrado: ${inputPath}`
  );
}

const records =
  JSON.parse(
    fs.readFileSync(
      inputPath,
      "utf8"
    )
  ) as MissingClientRecord[];

const stats = {
  total: records.length,
  clientsCreated: 0,
  clientsAlreadyExisted: 0,
  addressesCreated: 0,
  addressesAlreadyExisted: 0,
  companyLinksCreatedOrUpdated: 0,
  routeLinksCreated: 0,
  routeLinksUpdated: 0,
  routesNotFound: 0,
  errors: 0,
};

const errors: unknown[] = [];

async function findOrCreateClient(
  record: MissingClientRecord
) {
  const {
    data: existing,
    error: findError,
  } = await supabase
    .from("clients")
    .select("id, name, active")
    .eq(
      "legacy_code",
      record.legacy_code
    )
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    stats.clientsAlreadyExisted++;

    if (!existing.active) {
      const {
        error: activateError,
      } = await supabase
        .from("clients")
        .update({
          active: true,
        })
        .eq(
          "id",
          existing.id
        );

      if (activateError) {
        throw activateError;
      }
    }

    return existing.id;
  }

  const {
    data: created,
    error: createError,
  } = await supabase
    .from("clients")
    .insert({
      type:
        record.type,

      name:
        record.client_name,

      trade_name:
        null,

      cpf_cnpj:
        null,

      email:
        null,

      phone:
        null,

      whatsapp:
        null,

      notes:
        `Cadastro operacional criado a partir do roteiro de entrega ${record.route_code}. Assinatura legada: ${record.subscription_number}. Dados contratuais pendentes de revisão.`,

      active:
        true,

      legacy_code:
        record.legacy_code,
    })
    .select("id")
    .single();

  if (
    createError ||
    !created
  ) {
    throw (
      createError ??
      new Error(
        "Não foi possível criar o cliente."
      )
    );
  }

  stats.clientsCreated++;

  return created.id;
}

async function ensureAddress(
  clientId: string,
  record: MissingClientRecord
) {
  const {
    data: existingAddress,
    error: addressFindError,
  } = await supabase
    .from(
      "client_addresses"
    )
    .select("id")
    .eq(
      "client_id",
      clientId
    )
    .eq(
      "is_primary",
      true
    )
    .maybeSingle();

  if (addressFindError) {
    throw addressFindError;
  }

  if (existingAddress) {
    stats.addressesAlreadyExisted++;
    return existingAddress.id;
  }

  const {
    data: createdAddress,
    error: addressInsertError,
  } = await supabase
    .from(
      "client_addresses"
    )
    .insert({
      client_id:
        clientId,

      street:
        record.address.street,

      number:
        record.address.number,

      complement:
        record.address.complement,

      neighborhood:
        record.address.neighborhood,

      city:
        record.address.city,

      state:
        record.address.state,

      postal_code:
        record.address.postal_code,

      reference:
        record.address.reference,

      is_primary:
        true,
    })
    .select("id")
    .single();

  if (
    addressInsertError ||
    !createdAddress
  ) {
    throw (
      addressInsertError ??
      new Error(
        "Não foi possível criar o endereço."
      )
    );
  }

  stats.addressesCreated++;

  return createdAddress.id;
}

async function ensureCompanyLink(
  clientId: string
) {
  const {
    error,
  } = await supabase
    .from(
      "client_companies"
    )
    .upsert(
      {
        client_id:
          clientId,

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

  if (error) {
    throw error;
  }

  stats.companyLinksCreatedOrUpdated++;
}

async function findRoute(
  routeCode: string
) {
  const {
    data: routes,
    error,
  } = await supabase
    .from(
      "delivery_routes"
    )
    .select(`
      id,
      description
    `)
    .eq(
      "company_id",
      ESTAFETA_COMPANY_ID
    );

  if (error) {
    throw error;
  }

  return (
    routes?.find(
      (route) =>
        route.description?.includes(
          `Código legado: ${routeCode}`
        )
    ) ??
    null
  );
}

async function ensureRouteLink(
  clientId: string,
  addressId: string | null,
  record: MissingClientRecord
) {
  const route =
    await findRoute(
      record.route_code
    );

  if (!route) {
    stats.routesNotFound++;

    throw new Error(
      `Rota ${record.route_code} não encontrada.`
    );
  }

  const {
    data: existingLink,
    error: findError,
  } = await supabase
    .from(
      "delivery_route_clients"
    )
    .select("id")
    .eq(
      "route_id",
      route.id
    )
    .eq(
      "client_id",
      clientId
    )
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  const notes =
    [
      `Assinatura: ${record.subscription_number}`,
      `Código cliente: ${record.legacy_code}`,
      "Cliente criado a partir do roteiro atual.",
    ].join(" | ");

  if (existingLink) {
    const {
      error: updateError,
    } = await supabase
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

    if (updateError) {
      throw updateError;
    }

    stats.routeLinksUpdated++;

    return;
  }

  const {
    error: insertError,
  } = await supabase
    .from(
      "delivery_route_clients"
    )
    .insert({
      route_id:
        route.id,

      client_id:
        clientId,

      address_id:
        addressId,

      delivery_order:
        record.delivery_order,

      notes,

      active:
        true,
    });

  if (insertError) {
    throw insertError;
  }

  stats.routeLinksCreated++;
}

async function processRecord(
  record: MissingClientRecord
) {
  try {
    const clientId =
      await findOrCreateClient(
        record
      );

    await ensureCompanyLink(
      clientId
    );

    const addressId =
      await ensureAddress(
        clientId,
        record
      );

    await ensureRouteLink(
      clientId,
      addressId,
      record
    );
  } catch (error) {
    stats.errors++;

    errors.push({
      legacy_code:
        record.legacy_code,

      subscription_number:
        record.subscription_number,

      client_name:
        record.client_name,

      route_code:
        record.route_code,

      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    console.error(
      `Erro em ${record.legacy_code} - ${record.client_name}:`,
      error
    );
  }
}

async function main() {
  console.log(
    "========================================"
  );
  console.log(
    "COMPLETAR CLIENTES FALTANTES DAS ROTAS"
  );
  console.log(
    "========================================"
  );

  console.log(
    `Registros: ${records.length}`
  );
  console.log("");

  for (
    let index = 0;
    index < records.length;
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

  const errorPath =
    path.join(
      process.cwd(),
      "scripts",
      "completar-clientes-rotas-erros.json"
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

  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "RESUMO"
  );
  console.log(
    "========================================"
  );

  console.table(
    stats
  );

  console.log("");
  console.log(
    "IMPORTANTE: nenhum contrato e nenhum lançamento financeiro foram criados."
  );

  console.log(
    "Os dados contratuais desses registros devem ser revisados antes de criar contratos."
  );

  console.log(
    `Erros: ${errorPath}`
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
