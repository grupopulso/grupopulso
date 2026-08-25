import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type SourceRecord = {
  numero_assinatura: string;
  codigo_cliente: string;
  cliente: string;
  endereco: string;
  fone: string;
  vendedor: string;
  emissao_original: string;
  emissao: string | null;
  vencimento_original: string;
  vencimento: string | null;
  forma_pagamento: string;
  situacao_original: string;
  status_sistema: "active" | "expiring" | "expired" | "cancelled";
  comissao: number | null;
  desconto: number | null;
  total: number | null;
  pendencias: string;
  registro_bruto: string;
};

type SourcePayload = {
  summary: Record<string, unknown>;
  records: SourceRecord[];
};

const COMPANY_ID = "ec5ed2f3-0052-4d6a-83ac-d60d768c7398";
const COMPANY_NAME = "O Estafeta";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalIndex = line.indexOf("=");

    if (equalIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalIndex).trim();

    let value = line
      .slice(equalIndex + 1)
      .trim();

    if (
      (value.startsWith('"') &&
        value.endsWith('"')) ||
      (value.startsWith("'") &&
        value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  return digits || null;
}

function inferClientType(
  name: string
): "individual" | "company" {
  const upper =
    name.toUpperCase();

  const organizationTerms = [
    "LTDA",
    "EIRELI",
    "ME ",
    " ME",
    "S/A",
    "S.A.",
    "BANCO",
    "COOPERATIVA",
    "ESCOLA",
    "PREFEITURA",
    "MUNICÍPIO",
    "MUNICIPIO",
    "CÂMARA",
    "CAMARA",
    "SECRETARIA",
    "SEC.",
    "SINDICATO",
    "HOSPITAL",
    "CLÍNICA",
    "CLINICA",
    "RESTAURANTE",
    "IMOBILIÁRIA",
    "IMOBILIARIA",
    "FARMÁCIA",
    "FARMACIA",
    "OFICINA",
    "MECÂNICA",
    "MECANICA",
    "AUTO PEÇAS",
    "AUTO PECAS",
    "MERCADO",
    "POSTO",
    "IND.",
    "COM.",
    "COMERCIO",
    "COMÉRCIO",
    "CONSTRUTORA",
    "METALÚRGICA",
    "METALURGICA",
    "ASSOCIAÇÃO",
    "ASSOCIACAO",
    "SOCIEDADE",
    "APAE",
    "UNIMED",
    "ACIV",
  ];

  return organizationTerms.some(
    (term) => upper.includes(term)
  )
    ? "company"
    : "individual";
}

type ParsedAddress = {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  reference: string | null;
};

function parseAddress(
  rawAddress: string
): ParsedAddress {
  const clean = rawAddress
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return {
      street: null,
      number: null,
      complement: null,
      neighborhood: null,
      city: null,
      state: null,
      postal_code: null,
      reference: null,
    };
  }

  const pieces = clean
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean);

  if (pieces.length === 1) {
    return {
      street: pieces[0],
      number: null,
      complement: null,
      neighborhood: null,
      city: null,
      state: null,
      postal_code: null,
      reference: clean,
    };
  }

  const street =
    pieces[0] || null;

  const possibleNumber =
    pieces[1] || "";

  const number =
    /^(s\/?n|sn|0|-|\d+[a-zA-Z/-]*)$/i.test(
      possibleNumber
    )
      ? possibleNumber
      : null;

  const city =
    pieces.length >= 3
      ? pieces[
          pieces.length - 1
        ]
      : null;

  const neighborhood =
    pieces.length >= 4
      ? pieces[
          pieces.length - 2
        ]
      : null;

  const middleStart =
    number ? 2 : 1;

  const middleEnd =
    pieces.length >= 4
      ? pieces.length - 2
      : pieces.length - 1;

  const complementParts =
    pieces.slice(
      middleStart,
      middleEnd
    );

  const complement =
    complementParts.length
      ? complementParts.join(", ")
      : null;

  return {
    street,
    number,
    complement,
    neighborhood,
    city,
    state: null,
    postal_code: null,
    reference: clean,
  };
}

function buildNotes(
  record: SourceRecord
) {
  const parts = [
    `Importação legado O Estafeta`,
    `Código cliente legado: ${record.codigo_cliente}`,
    `Assinatura legado: ${record.numero_assinatura}`,
  ];

  if (record.forma_pagamento) {
    parts.push(
      `Forma de pagamento original: ${record.forma_pagamento}`
    );
  }

  if (record.vendedor) {
    parts.push(
      `Vendedor original: ${record.vendedor}`
    );
  }

  if (
    record.comissao !== null
  ) {
    parts.push(
      `Comissão original: ${record.comissao}`
    );
  }

  if (
    record.desconto !== null
  ) {
    parts.push(
      `Desconto original: ${record.desconto}`
    );
  }

  if (
    record.situacao_original
  ) {
    parts.push(
      `Situação original: ${record.situacao_original}`
    );
  }

  return parts.join("\n");
}

async function main() {
  loadEnvLocal();

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local."
    );
  }

  const sourcePath = path.resolve(
    process.cwd(),
    "scripts",
    "data",
    "assinaturas_prontas_supabase.json"
  );

  if (
    !fs.existsSync(sourcePath)
  ) {
    throw new Error(
      `Arquivo não encontrado: ${sourcePath}`
    );
  }

  const payload = JSON.parse(
    fs.readFileSync(
      sourcePath,
      "utf8"
    )
  ) as SourcePayload;

  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken:
            false,
          persistSession:
            false,
        },
      }
    );

  const {
    data: company,
    error: companyError,
  } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", COMPANY_ID)
    .single();

  if (
    companyError ||
    !company
  ) {
    throw new Error(
      `Empresa ${COMPANY_NAME} não encontrada: ${companyError?.message ?? "sem retorno"}`
    );
  }

  const stats = {
    total:
      payload.records.length,
    clientsCreated: 0,
    clientsUpdated: 0,
    addressesCreated: 0,
    addressesUpdated: 0,
    companyLinksCreated: 0,
    companyLinksUpdated: 0,
    contractsCreated: 0,
    contractsUpdated: 0,
    errors: 0,
  };

  const errors: Array<{
    numero_assinatura: string;
    codigo_cliente: string;
    cliente: string;
    error: string;
  }> = [];

  console.log(
    `\nImportando ${stats.total} assinaturas para ${company.name}...\n`
  );

  for (
    let index = 0;
    index < payload.records.length;
    index++
  ) {
    const record =
      payload.records[index];

    try {
      if (!record.emissao) {
        throw new Error(
          "Data de emissão ausente."
        );
      }

      /*
       * 1. CLIENTE
       */
      const {
        data: existingClient,
        error:
          existingClientError,
      } = await supabase
        .from("clients")
        .select("id")
        .eq(
          "legacy_code",
          record.codigo_cliente
        )
        .maybeSingle();

      if (existingClientError) {
        throw existingClientError;
      }

      let clientId: string;

      const clientPayload = {
        type: inferClientType(
          record.cliente
        ),
        name: record.cliente,
        phone: normalizePhone(
          record.fone
        ),
        active:
          record.status_sistema !==
          "cancelled",
        legacy_code:
          record.codigo_cliente,
      };

      if (existingClient) {
        clientId =
          existingClient.id;

        const {
          error: updateError,
        } = await supabase
          .from("clients")
          .update(clientPayload)
          .eq("id", clientId);

        if (updateError) {
          throw updateError;
        }

        stats.clientsUpdated++;
      } else {
        const {
          data: insertedClient,
          error: insertError,
        } = await supabase
          .from("clients")
          .insert(clientPayload)
          .select("id")
          .single();

        if (
          insertError ||
          !insertedClient
        ) {
          throw (
            insertError ??
            new Error(
              "Cliente não retornou ID."
            )
          );
        }

        clientId =
          insertedClient.id;

        stats.clientsCreated++;
      }

      /*
       * 2. ENDEREÇO PRINCIPAL
       */

      
      const parsedAddress =
        parseAddress(
          record.endereco
        );

      const {
        data:
          existingAddress,
        error:
          existingAddressError,
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

      if (
        existingAddressError
      ) {
        throw existingAddressError;
      }

    const addressPayload: ParsedAddress & {
  client_id: string;
  is_primary: boolean;
} = {
  client_id:
    clientId,

  street:
    parsedAddress.street,

  number:
    parsedAddress.number,

  complement:
    parsedAddress.complement,

  neighborhood:
    parsedAddress.neighborhood,

  city:
    parsedAddress.city,

  state:
    parsedAddress.state,

  postal_code:
    parsedAddress.postal_code,

  reference:
    parsedAddress.reference,

  is_primary: true,
};

      if (existingAddress) {
        const {
          error: addressUpdateError,
        } = await supabase
          .from(
            "client_addresses"
          )
          .update(
            addressPayload
          )
          .eq(
            "id",
            existingAddress.id
          );

        if (
          addressUpdateError
        ) {
          throw addressUpdateError;
        }

        stats.addressesUpdated++;
      } else {
        const {
          error:
            addressInsertError,
        } = await supabase
          .from(
            "client_addresses"
          )
          .insert(
            addressPayload
          );

        if (
          addressInsertError
        ) {
          throw addressInsertError;
        }

        stats.addressesCreated++;
      }

      /*
       * 3. VÍNCULO COM A EMPRESA
       */
      const {
        data: existingLink,
        error:
          existingLinkError,
      } = await supabase
        .from(
          "client_companies"
        )
        .select("id")
        .eq(
          "client_id",
          clientId
        )
        .eq(
          "company_id",
          COMPANY_ID
        )
        .maybeSingle();

      if (
        existingLinkError
      ) {
        throw existingLinkError;
      }

      const linkPayload = {
        client_id:
          clientId,
        company_id:
          COMPANY_ID,
        status:
          record.status_sistema,
        notes:
          buildNotes(
            record
          ),
      };

      if (existingLink) {
        const {
          error: linkUpdateError,
        } = await supabase
          .from(
            "client_companies"
          )
          .update(
            linkPayload
          )
          .eq(
            "id",
            existingLink.id
          );

        if (
          linkUpdateError
        ) {
          throw linkUpdateError;
        }

        stats.companyLinksUpdated++;
      } else {
        const {
          error: linkInsertError,
        } = await supabase
          .from(
            "client_companies"
          )
          .insert(
            linkPayload
          );

        if (
          linkInsertError
        ) {
          throw linkInsertError;
        }

        stats.companyLinksCreated++;
      }

      /*
       * 4. CONTRATO / ASSINATURA
       */
      const {
        data:
          existingContract,
        error:
          existingContractError,
      } = await supabase
        .from("contracts")
        .select("id")
        .eq(
          "legacy_subscription_number",
          record.numero_assinatura
        )
        .eq(
          "company_id",
          COMPANY_ID
        )
        .maybeSingle();

      if (
        existingContractError
      ) {
        throw existingContractError;
      }

      const contractPayload = {
        company_id:
          COMPANY_ID,
        client_id:
          clientId,
        product_id: null,
        title:
          `Assinatura O Estafeta #${record.numero_assinatura}`,
        start_date:
          record.emissao,
        end_date:
          record.vencimento,
        value:
          record.total ?? 0,
        billing_frequency:
          "annual",
        status:
          record.status_sistema,
        auto_renew: false,
        notes:
          buildNotes(
            record
          ),
        legacy_subscription_number:
          record.numero_assinatura,
      };

      if (
        existingContract
      ) {
        const {
          error:
            contractUpdateError,
        } = await supabase
          .from("contracts")
          .update(
            contractPayload
          )
          .eq(
            "id",
            existingContract.id
          );

        if (
          contractUpdateError
        ) {
          throw contractUpdateError;
        }

        stats.contractsUpdated++;
      } else {
        const {
          error:
            contractInsertError,
        } = await supabase
          .from("contracts")
          .insert(
            contractPayload
          );

        if (
          contractInsertError
        ) {
          throw contractInsertError;
        }

        stats.contractsCreated++;
      }

      if (
        (index + 1) % 25 ===
          0 ||
        index ===
          payload.records.length -
            1
      ) {
        console.log(
          `[${index + 1}/${stats.total}] processados`
        );
      }
    } catch (error) {
      stats.errors++;

      const message =
        error instanceof Error
          ? error.message
          : JSON.stringify(
              error
            );

      errors.push({
        numero_assinatura:
          record.numero_assinatura,
        codigo_cliente:
          record.codigo_cliente,
        cliente:
          record.cliente,
        error: message,
      });

      console.error(
        `ERRO assinatura ${record.numero_assinatura} / cliente ${record.codigo_cliente}:`,
        message
      );
    }
  }

  console.log(
    "\n=============================="
  );
  console.log(
    "IMPORTAÇÃO CONCLUÍDA"
  );
  console.log(
    "=============================="
  );
  console.table(stats);

  if (errors.length) {
    const errorPath =
      path.resolve(
        process.cwd(),
        "scripts",
        "import-assinaturas-erros.json"
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

    console.log(
      `\nErros salvos em: ${errorPath}`
    );
  }
}

main().catch((error) => {
  console.error(
    "\nFalha fatal na importação:",
    error
  );

  process.exit(1);
});
