"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

import { createClient } from "@/app/lib/supabase/client";

type Company = {
  id: string;
  name: string;
};

export default function ClientForm() {
  const router = useRouter();
  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  const [type, setType] = useState("individual");
  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("RS");
  const [postalCode, setPostalCode] = useState("");
  const [reference, setReference] = useState("");

  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCompanies() {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .eq("active", true)
        .order("name");

      setCompanies(data ?? []);
    }

    loadCompanies();
  }, [supabase]);

  function toggleCompany(companyId: string) {
    setSelectedCompanies((current) =>
      current.includes(companyId)
        ? current.filter((id) => id !== companyId)
        : [...current, companyId]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCompanies.length) {
      setError("Selecione pelo menos uma empresa.");
      return;
    }

    setLoading(true);
    setError("");

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        type,
        name,
        trade_name: tradeName || null,
        cpf_cnpj: cpfCnpj || null,
        email: email || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (clientError || !client) {
      setError(
        clientError?.message ??
          "Não foi possível cadastrar o cliente."
      );
      setLoading(false);
      return;
    }

    if (
      street ||
      number ||
      neighborhood ||
      city ||
      postalCode
    ) {
      const { error: addressError } = await supabase
        .from("client_addresses")
        .insert({
          client_id: client.id,
          street: street || null,
          number: number || null,
          complement: complement || null,
          neighborhood: neighborhood || null,
          city: city || null,
          state: state || null,
          postal_code: postalCode || null,
          reference: reference || null,
          is_primary: true,
        });

      if (addressError) {
        setError(addressError.message);
        setLoading(false);
        return;
      }
    }

    const { error: relationsError } = await supabase
      .from("client_companies")
      .insert(
        selectedCompanies.map((companyId) => ({
          client_id: client.id,
          company_id: companyId,
          status,
        }))
      );

    if (relationsError) {
      setError(relationsError.message);
      setLoading(false);
      return;
    }

    router.push("/clientes");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-5xl"
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Novo cliente
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre um novo cliente no Grupo Pulso.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white hover:bg-[#105c41] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {loading ? "Salvando..." : "Salvar cliente"}
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Dados do cliente
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Tipo">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
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

            <Field label="Nome / Razão Social">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input"
              />
            </Field>

            {type === "company" && (
              <Field label="Nome Fantasia">
                <input
                  value={tradeName}
                  onChange={(e) =>
                    setTradeName(e.target.value)
                  }
                  className="input"
                />
              </Field>
            )}

            <Field label="CPF / CNPJ">
              <input
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="E-mail">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Telefone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="WhatsApp">
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="input"
              />
            </Field>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Empresas vinculadas
          </h2>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {companies.map((company) => {
              const selected =
                selectedCompanies.includes(company.id);

              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() =>
                    toggleCompany(company.id)
                  }
                  className={`rounded-xl border p-4 text-left text-sm font-medium transition ${
                    selected
                      ? "border-[#15704f] bg-[#15704f]/5 text-[#15704f]"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {company.name}
                </button>
              );
            })}
          </div>

          <div className="mt-5 max-w-xs">
            <Field label="Situação">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
                className="input"
              >
                <option value="active">Ativo</option>
                <option value="expiring">A vencer</option>
                <option value="expired">Vencido</option>
                <option value="cancelled">
                  Cancelado
                </option>
              </select>
            </Field>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Endereço
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Rua">
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Número">
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Complemento">
              <input
                value={complement}
                onChange={(e) =>
                  setComplement(e.target.value)
                }
                className="input"
              />
            </Field>

            <Field label="Bairro">
              <input
                value={neighborhood}
                onChange={(e) =>
                  setNeighborhood(e.target.value)
                }
                className="input"
              />
            </Field>

            <Field label="Cidade">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Estado">
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="CEP">
              <input
                value={postalCode}
                onChange={(e) =>
                  setPostalCode(e.target.value)
                }
                className="input"
              />
            </Field>

            <Field label="Ponto de referência">
              <input
                value={reference}
                onChange={(e) =>
                  setReference(e.target.value)
                }
                className="input"
              />
            </Field>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <Field label="Observações">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="input min-h-[110px] py-3"
            />
          </Field>
        </section>
      </form>
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