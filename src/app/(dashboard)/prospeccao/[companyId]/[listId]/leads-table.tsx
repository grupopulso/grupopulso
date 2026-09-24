"use client";

import { useMemo, useState } from "react";

import LeadRow from "./lead-row";
import { STATUS_OPTIONS } from "./status";

type Seller = {
  id: string;
  name: string | null;
};

type Lead = {
  id: string;
  client_name: string;
  seller_user_id: string | null;
  value: number | string | null;
  size: string | null;
  status: string;
  billing_note: string | null;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export default function LeadsTable({
  companyId,
  listId,
  leads,
  sellers,
  children,
}: {
  companyId: string;
  listId: string;
  leads: Lead[];
  sellers: Seller[];
  children?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [sellerFilter, setSellerFilter] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState("");

  const filteredLeads = useMemo(() => {
    const term = normalize(search);

    return leads.filter((lead) => {
      const matchesSearch =
        !term ||
        normalize(
          lead.client_name
        ).includes(term);

      const matchesSeller =
        !sellerFilter ||
        lead.seller_user_id ===
          sellerFilter;

      const matchesStatus =
        !statusFilter ||
        lead.status === statusFilter;

      return (
        matchesSearch &&
        matchesSeller &&
        matchesStatus
      );
    });
  }, [
    leads,
    search,
    sellerFilter,
    statusFilter,
  ]);

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(sellerFilter) ||
    Boolean(statusFilter);

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Buscar cliente..."
          className="input h-10 flex-1 min-w-[200px]"
        />

        <select
          value={sellerFilter}
          onChange={(event) =>
            setSellerFilter(
              event.target.value
            )
          }
          className="input h-10"
        >
          <option value="">
            Todos os vendedores
          </option>

          {sellers.map((seller) => (
            <option
              key={seller.id}
              value={seller.id}
            >
              {seller.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
          className="input h-10"
        >
          <option value="">
            Todas as situações
          </option>

          {STATUS_OPTIONS.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSellerFilter("");
              setStatusFilter("");
            }}
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            Limpar filtros
          </button>
        )}

        <span className="text-xs text-slate-400">
          {filteredLeads.length} de{" "}
          {leads.length} cliente(s)
        </span>
      </div>

      {children}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <Header>Cliente</Header>
                <Header>
                  Vendedor
                </Header>
                <Header>Valor</Header>
                <Header>
                  Tamanho
                </Header>
                <Header>
                  Situação
                </Header>
                <Header>
                  Cobrança
                </Header>
                <Header>{""}</Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map(
                (lead) => (
                  <LeadRow
                    key={lead.id}
                    companyId={
                      companyId
                    }
                    listId={listId}
                    lead={lead}
                    sellers={sellers}
                  />
                )
              )}

              {filteredLeads.length ===
                0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    {leads.length === 0
                      ? "Nenhum cliente adicionado ainda."
                      : "Nenhum cliente encontrado para esse filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Header({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
