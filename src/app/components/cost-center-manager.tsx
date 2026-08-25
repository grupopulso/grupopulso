"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/app/lib/supabase/client";

type Company = {
  id: string;
  name: string;
};

type Center = {
  id: string;
  name: string;
  description: string | null;
  company_id: string | null;
  company:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

export default function CostCenterManager({
  initialCenters,
  companies,
}: {
  initialCenters: Center[];
  companies: Company[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [description, setDescription] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    await supabase.from("cost_centers").insert({
      name,
      company_id: companyId || null,
      description: description || null,
      active: true,
    });

    setName("");
    setDescription("");

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-slate-900">
          Centros de Custo
        </h1>

        <form
          onSubmit={handleSubmit}
          className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex.: Administrativo"
              className="input"
            />

            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="input"
            >
              <option value="">
                Todas / Grupo Pulso
              </option>

              {companies.map((company) => (
                <option
                  key={company.id}
                  value={company.id}
                >
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
            className="input mt-5 min-h-[100px]"
          />

          <button className="mt-5 rounded-xl bg-[#15704f] px-5 py-3 text-sm font-semibold text-white">
            Adicionar centro de custo
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
          {initialCenters.map((center) => {
            const company = Array.isArray(center.company)
              ? center.company[0]
              : center.company;

            return (
              <div
                key={center.id}
                className="flex items-center justify-between border-b border-slate-100 px-5 py-4 last:border-0"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {center.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {company?.name ?? "Grupo Pulso"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}