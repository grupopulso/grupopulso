"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireAnyCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  createAuditLog,
} from "@/app/lib/audit";

export async function updateClient(
  clientId: string,
  formData: FormData
) {
  const access =
    await requireModulePermission(
      "clients",
      "edit"
    );

  const supabase = await createClient();

  /*
   * Escritas via cliente administrativo (service role):
   * o acesso já foi validado por `requireModulePermission`
   * e `requireAnyCompanyAccess` logo abaixo. Evita bloqueio
   * de RLS ao gravar em `clients`.
   */
  const adminDb = createAdminClient();

  const {
  data: oldClient,
} = await supabase
  .from("clients")
  .select(`
    id,
    name,
    cpf_cnpj,
    email,
    phone,
    whatsapp,
    type,
    active
  `)
  .eq("id", clientId)
  .maybeSingle();

  /*
   * Escopo de empresa: cliente é N:N com empresa. O usuário
   * só pode editar se já tiver vínculo com pelo menos uma
   * das empresas atuais do cliente (admin sempre passa).
   */
  const {
    data: currentRelations,
  } = await supabase
    .from("client_companies")
    .select("company_id")
    .eq("client_id", clientId);

  const currentCompanyIds =
    (currentRelations ?? []).map(
      (relation) =>
        relation.company_id
    );

  await requireAnyCompanyAccess(
    currentCompanyIds
  );

  const name = String(
    formData.get("name") ?? ""
  ).trim();

  const cpfCnpj = String(
    formData.get("cpf_cnpj") ?? ""
  ).trim();

  const email = String(
    formData.get("email") ?? ""
  ).trim();

  const phone = String(
    formData.get("phone") ?? ""
  ).trim();

  const whatsapp = String(
    formData.get("whatsapp") ?? ""
  ).trim();

  const type = String(
  formData.get("type") ?? "individual"
);

  const active =
    formData.get("active") === "on";

  const companyIds =
    formData
      .getAll("companies")
      .map(String)
      .filter(Boolean);

  /*
   * O formulário lista todas as empresas do grupo. Um usuário
   * não-admin não pode vincular o cliente a uma empresa nova
   * fora do seu escopo — mas pode manter as que o cliente já
   * possuía (mesmo que não sejam dele).
   */
  if (
    access.profile.role !== "admin"
  ) {
    const invalidCompany =
      companyIds.find(
        (companyId) =>
          !access.companyIds.includes(
            companyId
          ) &&
          !currentCompanyIds.includes(
            companyId
          )
      );

    if (invalidCompany) {
      redirect(
        `/clientes/${clientId}/editar?error=empresas`
      );
    }
  }

  const street = String(
    formData.get("street") ?? ""
  ).trim();

  const number = String(
    formData.get("number") ?? ""
  ).trim();

  const complement = String(
    formData.get("complement") ?? ""
  ).trim();

  const neighborhood = String(
    formData.get("neighborhood") ?? ""
  ).trim();

  const city = String(
    formData.get("city") ?? ""
  ).trim();

  const state = String(
    formData.get("state") ?? ""
  ).trim();

  const postalCode = String(
    formData.get("postal_code") ?? ""
  ).trim();

  const reference = String(
    formData.get("reference") ?? ""
  ).trim();

  if (!name) {
    redirect(
      `/clientes/${clientId}/editar?error=nome`
    );
  }

  const {
    error: clientError,
  } = await adminDb
    .from("clients")
    .update({
      name,
      cpf_cnpj:
        cpfCnpj || null,
      email:
        email || null,
      phone:
        phone || null,
      whatsapp:
        whatsapp || null,
      type,
      active,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", clientId);

  if (clientError) {
  console.error(
    "ERRO COMPLETO AO ATUALIZAR CLIENTE:",
    JSON.stringify(
      clientError,
      null,
      2
    )
  );

  throw new Error(
    `Erro ao atualizar cliente: ${clientError.message}`
  );
}

  /*
   * EMPRESAS
   */
  const {
    error: deleteCompaniesError,
  } = await adminDb
    .from("client_companies")
    .delete()
    .eq("client_id", clientId);

  if (deleteCompaniesError) {
    console.error(
      "Erro ao atualizar empresas do cliente:",
      deleteCompaniesError
    );

    redirect(
      `/clientes/${clientId}/editar?error=empresas`
    );
  }

  if (companyIds.length) {
    const {
      error: insertCompaniesError,
    } = await adminDb
      .from("client_companies")
      .insert(
        companyIds.map(
          (companyId) => ({
            client_id:
              clientId,
            company_id:
              companyId,
            status:
              "active",
          })
        )
      );

    if (
      insertCompaniesError
    ) {
      console.error(
        "Erro ao salvar empresas:",
        insertCompaniesError
      );

      redirect(
        `/clientes/${clientId}/editar?error=empresas`
      );
    }
  }

  /*
   * ENDEREÇO PRINCIPAL
   */
  const {
    data: primaryAddress,
  } = await supabase
    .from("client_addresses")
    .select("id")
    .eq("client_id", clientId)
    .eq("is_primary", true)
    .maybeSingle();

  const hasAddressData =
    street ||
    number ||
    neighborhood ||
    city ||
    state ||
    postalCode ||
    complement ||
    reference;

  if (
    primaryAddress &&
    hasAddressData
  ) {
    const {
      error: addressError,
    } = await adminDb
      .from("client_addresses")
      .update({
        street:
          street || null,
        number:
          number || null,
        complement:
          complement || null,
        neighborhood:
          neighborhood || null,
        city:
          city || null,
        state:
          state || null,
        postal_code:
          postalCode || null,
        reference:
          reference || null,
        is_primary:
          true,
      })
      .eq(
        "id",
        primaryAddress.id
      );

    if (addressError) {
      console.error(
        "Erro ao atualizar endereço:",
        addressError
      );
    }
  }

  if (
    !primaryAddress &&
    hasAddressData
  ) {
    const {
      error: addressError,
    } = await adminDb
      .from("client_addresses")
      .insert({
        client_id:
          clientId,
        street:
          street || null,
        number:
          number || null,
        complement:
          complement || null,
        neighborhood:
          neighborhood || null,
        city:
          city || null,
        state:
          state || null,
        postal_code:
          postalCode || null,
        reference:
          reference || null,
        is_primary:
          true,
      });

    if (addressError) {
      console.error(
        "Erro ao cadastrar endereço:",
        addressError
      );
    }
  }

  await createAuditLog({
  module: "clients",
  action: "update",
  entityType: "client",
  entityId: clientId,
  description:
    `Cliente ${name} foi atualizado.`,
  oldData:
    oldClient ?? undefined,
  newData: {
    name,

    cpf_cnpj:
      cpfCnpj || null,

    email:
      email || null,

    phone:
      phone || null,

    whatsapp:
      whatsapp || null,

    type,

    active,

    companyIds,

    address: {
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      postalCode,
      reference,
    },
  },
});
  revalidatePath("/clientes");
  revalidatePath(
    `/clientes/${clientId}`
  );
  revalidatePath(
    `/clientes/${clientId}/editar`
  );

  redirect(
    `/clientes/${clientId}`
  );
}