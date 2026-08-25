import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowLeft,
  Building2,
  MapPin,
  Save,
  UserRound,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  updateClient,
} from "./actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function EditarClientePage({
  params,
  searchParams,
}: PageProps) {
  await requireModulePermission(
    "clients",
    "edit"
  );

  const { id } = await params;
  const query =
    await searchParams;

  const supabase =
    await createClient();

  const [
    clientResult,
    companiesResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(`
        id,
        name,
        cpf_cnpj,
        email,
        phone,
        whatsapp,
        type,
        active,

        client_companies (
          company_id,
          status
        ),

        client_addresses (
          id,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          postal_code,
          reference,
          is_primary
        )
      `)
      .eq("id", id)
      .maybeSingle(),

    supabase
      .from("companies")
      .select(`
        id,
        name,
        color
      `)
      .eq("active", true)
      .order("name"),
  ]);

  const client =
    clientResult.data;

  if (
    clientResult.error ||
    !client
  ) {
    console.error(
      "Erro ao carregar cliente:",
      clientResult.error
    );

    notFound();
  }

  const companies =
    companiesResult.data ?? [];

  const selectedCompanyIds =
    new Set(
      (
        client.client_companies ??
        []
      ).map(
        (relation) =>
          relation.company_id
      )
    );

  const primaryAddress =
    (
      client.client_addresses ??
      []
    ).find(
      (address) =>
        address.is_primary
    ) ??
    client.client_addresses?.[0] ??
    null;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/clientes/${client.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para cliente
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <UserRound className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Editar cliente
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Atualize os dados cadastrais, empresas e endereço principal.
            </p>
          </div>
        </div>

        {query.error && (
          <ErrorMessage
            error={query.error}
          />
        )}

        <form
          action={updateClient.bind(
            null,
            client.id
          )}
          className="mt-7 space-y-6"
        >
          {/* DADOS PRINCIPAIS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <UserRound className="h-5 w-5 text-[#15704f]" />

              <div>
                <h2 className="font-semibold text-slate-900">
                  Dados do cliente
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Informações principais do cadastro.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Nome *">
                <input
                  name="name"
                  required
                  defaultValue={
                    client.name
                  }
                  className="input"
                />
              </Field>

              <Field label="Tipo">
                <select
                  name="type"
                  defaultValue={
  client.type ??
  "individual"
}
                  className="input"
                >
                 <option value="individual">
  Pessoa Física
</option>

<option value="company">
  Pessoa Jurídica
</option>
                </select>
              </Field>

              <Field label="CPF / CNPJ">
                <input
                  name="cpf_cnpj"
                  defaultValue={
                    client.cpf_cnpj ??
                    ""
                  }
                  className="input"
                />
              </Field>

              <Field label="E-mail">
                <input
                  type="email"
                  name="email"
                  defaultValue={
                    client.email ??
                    ""
                  }
                  className="input"
                />
              </Field>

              <Field label="Telefone">
                <input
                  name="phone"
                  defaultValue={
                    client.phone ??
                    ""
                  }
                  className="input"
                />
              </Field>

              <Field label="WhatsApp">
                <input
                  name="whatsapp"
                  defaultValue={
                    client.whatsapp ??
                    ""
                  }
                  className="input"
                />
              </Field>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={
                    client.active
                  }
                  className="mt-1 h-4 w-4"
                />

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Cliente ativo
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Clientes inativos permanecem cadastrados, mas podem ser ocultados das operações principais.
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* EMPRESAS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-[#15704f]" />

              <div>
                <h2 className="font-semibold text-slate-900">
                  Empresas
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Defina em quais empresas do grupo este cliente está vinculado.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {companies.map(
                (company) => (
                  <label
                    key={company.id}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            company.color ??
                            "#94a3b8",
                        }}
                      />

                      <span className="text-sm font-medium text-slate-700">
                        {company.name}
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      name="companies"
                      value={company.id}
                      defaultChecked={selectedCompanyIds.has(
                        company.id
                      )}
                      className="h-4 w-4"
                    />
                  </label>
                )
              )}
            </div>
          </section>

          {/* ENDEREÇO */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-[#15704f]" />

              <div>
                <h2 className="font-semibold text-slate-900">
                  Endereço principal
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Endereço utilizado principalmente para entregas e rotas.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Rua">
                <input
                  name="street"
                  defaultValue={
                    primaryAddress?.street ??
                    ""
                  }
                  className="input"
                />
              </Field>

              <Field label="Número">
                <input
                  name="number"
                  defaultValue={
                    primaryAddress?.number ??
                    ""
                  }
                  className="input"
                />
              </Field>

              <Field label="Complemento">
                <input
                  name="complement"
                  defaultValue={
                    primaryAddress?.complement ??
                    ""
                  }
                  className="input"
                />
              </Field>

              <Field label="Bairro">
                <input
                  name="neighborhood"
                  defaultValue={
                    primaryAddress?.neighborhood ??
                    ""
                  }
                  className="input"
                />
              </Field>

              <Field label="Cidade">
                <input
                  name="city"
                  defaultValue={
                    primaryAddress?.city ??
                    ""
                  }
                  className="input"
                />
              </Field>

              <Field label="Estado">
                <input
                  name="state"
                  defaultValue={
                    primaryAddress?.state ??
                    ""
                  }
                  className="input"
                />
              </Field>

              <Field label="CEP">
                <input
                  name="postal_code"
                  defaultValue={
                    primaryAddress?.postal_code ??
                    ""
                  }
                  className="input"
                />
              </Field>

              <Field label="Referência">
                <input
                  name="reference"
                  defaultValue={
                    primaryAddress?.reference ??
                    ""
                  }
                  placeholder="Ex.: casa ao lado da farmácia"
                  className="input"
                />
              </Field>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <Link
              href={`/clientes/${client.id}`}
              className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
            >
              <Save className="h-4 w-4" />
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}

function ErrorMessage({
  error,
}: {
  error: string;
}) {
  const messages: Record<
    string,
    string
  > = {
    nome:
      "Informe o nome do cliente.",

    salvar:
      "Não foi possível atualizar os dados do cliente.",

    empresas:
      "Não foi possível atualizar os vínculos com as empresas.",
  };

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {messages[error] ??
        "Não foi possível salvar as alterações."}
    </div>
  );
}