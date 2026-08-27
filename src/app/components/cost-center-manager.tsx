"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createCostCenter } from "@/app/(dashboard)/financeiro/configuracoes/actions";

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
  isAdmin,
}: {
  initialCenters: Center[];
  companies: Company[];
  isAdmin: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await createCostCenter({
        name,
        companyId: companyId || null,
        description: description || null,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setName("");
      setDescription("");

      router.refresh();
    });
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
                {isAdmin
                  ? "Todas / Grupo Pulso"
                  : "Selecione a empresa"}
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

          <button
            disabled={isPending}
            className="mt-5 rounded-xl bg-[#15704f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isPending
              ? "Adicionando..."
              : "Adicionar centro de custo"}
          </button>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
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