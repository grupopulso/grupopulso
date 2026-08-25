"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

import { createClient } from "@/app/lib/supabase/client";

type Company = {
  id: string;
  name: string;
};

export default function ProductForm() {
  const router = useRouter();
  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);

  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("service");
  const [price, setPrice] = useState("");
  const [billingFrequency, setBillingFrequency] =
    useState("one_time");

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

      if (data?.length) {
        setCompanyId(data[0].id);
      }
    }

    loadCompanies();
  }, [supabase]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const parsedPrice = price
      ? Number(
          price
            .replace(/\./g, "")
            .replace(",", ".")
        )
      : null;

    const { error: insertError } = await supabase
      .from("products")
      .insert({
        company_id: companyId,
        name,
        description: description || null,
        category: category || null,
        type,
        default_price: parsedPrice,
        billing_frequency: billingFrequency,
        active: true,
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/produtos");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-4xl"
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
              Novo produto ou serviço
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre o que será comercializado por uma das
              empresas do Grupo Pulso.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white hover:bg-[#105c41] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Empresa">
              <select
                value={companyId}
                onChange={(e) =>
                  setCompanyId(e.target.value)
                }
                required
                className="input"
              >
                {companies.map((company) => (
                  <option
                    key={company.id}
                    value={company.id}
                  >
                    {company.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Nome">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input"
              />
            </Field>

            <Field label="Categoria">
              <input
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value)
                }
                placeholder="Ex.: Publicidade, Assinaturas..."
                className="input"
              />
            </Field>

            <Field label="Tipo">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input"
              >
                <option value="product">Produto</option>
                <option value="service">Serviço</option>
                <option value="subscription">
                  Assinatura
                </option>
                <option value="advertising">
                  Publicidade
                </option>
                <option value="other">Outro</option>
              </select>
            </Field>

            <Field label="Valor padrão">
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="190,00"
                className="input"
              />
            </Field>

            <Field label="Forma de cobrança">
              <select
                value={billingFrequency}
                onChange={(e) =>
                  setBillingFrequency(e.target.value)
                }
                className="input"
              >
                <option value="one_time">
                  Pagamento único
                </option>

                <option value="monthly">
                  Mensal
                </option>

                <option value="quarterly">
                  Trimestral
                </option>

                <option value="semiannual">
                  Semestral
                </option>

                <option value="annual">
                  Anual
                </option>

                <option value="custom">
                  Personalizado
                </option>
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Descrição">
              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                rows={5}
                className="input min-h-[130px]"
              />
            </Field>
          </div>
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