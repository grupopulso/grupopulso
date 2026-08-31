"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

type CreateClientInput = {
  type: string;
  name: string;
  tradeName?: string | null;
  cpfCnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  notes?: string | null;

  status: string;
  companyIds: string[];

  address: {
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    reference?: string | null;
  };
};

type CreateClientResult =
  | {
      success: true;
      clientId: string;
    }
  | {
      success: false;
      error: string;
    };

export async function createClientRecord(
  input: CreateClientInput
): Promise<CreateClientResult> {
  const access =
    await requireModulePermission(
      "clients",
      "create"
    );

  const supabase =
    await createClient();

  /*
   * Escritas usam o cliente administrativo (service role):
   * o acesso já foi validado acima por `requireModulePermission`
   * e o escopo de empresa é checado manualmente mais abaixo.
   * Isso evita bloqueio por RLS ao inserir em `clients`.
   */
  const adminDb = createAdminClient();

  const name =
    input.name.trim();

  if (!name) {
    return {
      success: false,
      error:
        "Informe o nome do cliente.",
    };
  }

  if (!input.cpfCnpj?.trim()) {
    return {
      success: false,
      error:
        input.type === "company"
          ? "Informe o CNPJ do cliente."
          : "Informe o CPF do cliente.",
    };
  }

  if (
    !input.phone?.trim() &&
    !input.whatsapp?.trim()
  ) {
    return {
      success: false,
      error:
        "Informe um telefone ou WhatsApp.",
    };
  }

  if (!input.address?.street?.trim()) {
    return {
      success: false,
      error:
        "Informe o endereço do cliente.",
    };
  }

  const companyIds =
    [
      ...new Set(
        input.companyIds.filter(
          Boolean
        )
      ),
    ];

  if (!companyIds.length) {
    return {
      success: false,
      error:
        "Selecione pelo menos uma empresa.",
    };
  }

  /*
   * Escopo de empresa: o company_id vem do formulário.
   * Um usuário não-admin só pode vincular o cliente a
   * empresas às quais ele tem acesso.
   */
  if (
    access.profile.role !== "admin"
  ) {
    const invalidCompany =
      companyIds.find(
        (companyId) =>
          !access.companyIds.includes(
            companyId
          )
      );

    if (invalidCompany) {
      return {
        success: false,
        error:
          "Você não tem acesso a uma das empresas selecionadas.",
      };
    }
  }

  /*
   * Confirma que as empresas existem e estão ativas.
   */
  const {
    data: validCompanies,
    error: companiesError,
  } = await supabase
    .from("companies")
    .select("id")
    .eq("active", true)
    .in("id", companyIds);

  if (
    companiesError ||
    (validCompanies ?? []).length !==
      companyIds.length
  ) {
    return {
      success: false,
      error:
        "Uma ou mais empresas selecionadas são inválidas.",
    };
  }

  /*
   * =========================
   * CLIENTE
   * =========================
   */

  const {
    data: client,
    error: clientError,
  } = await adminDb
    .from("clients")
    .insert({
      type: input.type,
      name,
      trade_name:
        input.tradeName?.trim() ||
        null,
      cpf_cnpj:
        input.cpfCnpj?.trim() ||
        null,
      email:
        input.email?.trim() ||
        null,
      phone:
        input.phone?.trim() ||
        null,
      whatsapp:
        input.whatsapp?.trim() ||
        null,
      notes:
        input.notes?.trim() ||
        null,
    })
    .select("id")
    .single();

  if (
    clientError ||
    !client
  ) {
    console.error(
      "Erro ao cadastrar cliente:",
      clientError
    );

    return {
      success: false,
      error:
        clientError?.message ??
        "Não foi possível cadastrar o cliente.",
    };
  }

  /*
   * =========================
   * ENDEREÇO PRINCIPAL
   * =========================
   */

  const address =
    input.address;

  const hasAddress =
    Boolean(
      address.street ||
        address.number ||
        address.neighborhood ||
        address.city ||
        address.postalCode ||
        address.complement ||
        address.state ||
        address.reference
    );

  if (hasAddress) {
    const {
      error: addressError,
    } = await adminDb
      .from("client_addresses")
      .insert({
        client_id: client.id,
        street:
          address.street?.trim() ||
          null,
        number:
          address.number?.trim() ||
          null,
        complement:
          address.complement?.trim() ||
          null,
        neighborhood:
          address.neighborhood?.trim() ||
          null,
        city:
          address.city?.trim() ||
          null,
        state:
          address.state?.trim() ||
          null,
        postal_code:
          address.postalCode?.trim() ||
          null,
        reference:
          address.reference?.trim() ||
          null,
        is_primary: true,
      });

    if (addressError) {
      await rollbackClient(
        adminDb,
        client.id
      );

      console.error(
        "Erro ao cadastrar endereço do cliente:",
        addressError
      );

      return {
        success: false,
        error:
          addressError.message,
      };
    }
  }

  /*
   * =========================
   * EMPRESAS
   * =========================
   */

  const {
    error: relationsError,
  } = await adminDb
    .from("client_companies")
    .insert(
      companyIds.map(
        (companyId) => ({
          client_id: client.id,
          company_id: companyId,
          status: input.status,
        })
      )
    );

  if (relationsError) {
    await rollbackClient(
      adminDb,
      client.id
    );

    console.error(
      "Erro ao vincular empresas ao cliente:",
      relationsError
    );

    return {
      success: false,
      error:
        relationsError.message,
    };
  }

  await createAuditLog({
    module: "clients",
    action: "create",
    entityType: "client",
    entityId: client.id,
    description:
      `Cliente ${name} foi cadastrado.`,
    newData: {
      name,
      type: input.type,
      cpf_cnpj:
        input.cpfCnpj?.trim() ||
        null,
      email:
        input.email?.trim() ||
        null,
      companyIds,
      status: input.status,
    },
  });

  revalidatePath("/clientes");

  return {
    success: true,
    clientId: client.id,
  };
}

async function rollbackClient(
  supabase: ReturnType<
    typeof createAdminClient
  >,
  clientId: string
) {
  await supabase
    .from("client_addresses")
    .delete()
    .eq("client_id", clientId);

  await supabase
    .from("client_companies")
    .delete()
    .eq("client_id", clientId);

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId);

  if (error) {
    console.error(
      "Erro ao desfazer cadastro de cliente:",
      error
    );
  }
}
