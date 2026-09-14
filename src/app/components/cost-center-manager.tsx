"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createCostCenter,
  updateCostCenter,
} from "@/app/(dashboard)/financeiro/configuracoes/actions";

type Company = {
  id: string;
  name: string;
};

type Center = {
  id: string;
  name: string;
  description: string | null;
  company_id: string | null;
  active: boolean;
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

        <div className="mt-6 space-y-3">
          {initialCenters.map((center) => (
            <CostCenterRow
              key={center.id}
              center={center}
              companies={companies}
              isAdmin={isAdmin}
            />
          ))}

          {initialCenters.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              Nenhum centro de custo cadastrado.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function CostCenterRow({
  center,
  companies,
  isAdmin,
}: {
  center: Center;
  companies: Company[];
  isAdmin: boolean;
}) {
  const router = useRouter();

  const company = Array.isArray(center.company)
    ? center.company[0]
    : center.company;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(center.name);
  const [companyId, setCompanyId] = useState(
    center.company_id ?? ""
  );
  const [description, setDescription] = useState(
    center.description ?? ""
  );
  const [active, setActive] = useState(center.active);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setName(center.name);
    setCompanyId(center.company_id ?? "");
    setDescription(center.description ?? "");
    setActive(center.active);
    setError("");
    setEditing(false);
  }

  function handleSave() {
    setError("");

    startTransition(async () => {
      const result = await updateCostCenter({
        id: center.id,
        name,
        companyId: companyId || null,
        description: description || null,
        active,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div
        className={`flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 ${
          center.active ? "" : "opacity-60"
        }`}
      >
        <div>
          <p className="font-medium text-slate-900">
            {center.name}

            {!center.active && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                Inativo
              </span>
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {company?.name ?? "Grupo Pulso"}
            {center.description
              ? ` · ${center.description}`
              : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#15704f]/30 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
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

          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição"
        className="input mt-4 min-h-[80px]"
      />

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4"
        />
        Ativo
      </label>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="rounded-xl bg-[#15704f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>

        <button
          type="button"
          onClick={handleCancel}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}