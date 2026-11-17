"use client";

import { useMemo, useState } from "react";

import ColumnClearBar from "./column-clear-bar";
import LeadRow from "./lead-row";
import type { BulkClearFields } from "./actions";
import {
  KIND_OPTIONS,
  STATUS_OPTIONS,
} from "./status";

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
  kind?: string | null;
};

const NO_COLUMNS: BulkClearFields = {
  seller: false,
  value: false,
  size: false,
  status: false,
  billingNote: false,
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
  showKind = false,
  children,
}: {
  companyId: string;
  listId: string;
  leads: Lead[];
  sellers: Seller[];
  showKind?: boolean;
  children?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [sellerFilter, setSellerFilter] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState("");
  const [kindFilter, setKindFilter] =
    useState("");

  /*
   * Colunas marcadas pra apagar (no cabeçalho). Vale para todas
   * as linhas que estão na tela (respeita os filtros).
   */
  const [columns, setColumns] =
    useState<BulkClearFields>(NO_COLUMNS);

  function toggleColumn(key: keyof BulkClearFields) {
    setColumns((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  const columnCheckbox = (
    key: keyof BulkClearFields,
    label: string
  ) => (
    <input
      type="checkbox"
      checked={columns[key]}
      onChange={() => toggleColumn(key)}
      title={`Marcar a coluna ${label} para apagar`}
      aria-label={`Marcar a coluna ${label} para apagar`}
      className="mr-2 h-3.5 w-3.5 cursor-pointer align-middle accent-[#15704f]"
    />
  );

  const filteredLeads = useMemo(() => {
    const term = normalize(search);

    return leads.filter((lead) => {
      /*
       * A busca olha o nome e também as observações (é lá que
       * ficam contato, data da cobrança, etc.).
       */
      const matchesSearch =
        !term ||
        normalize(
          lead.client_name
        ).includes(term) ||
        normalize(
          lead.billing_note ?? ""
        ).includes(term);

      const matchesSeller =
        !sellerFilter ||
        lead.seller_user_id ===
          sellerFilter;

      const matchesStatus =
        !statusFilter ||
        lead.status === statusFilter;

      const matchesKind =
        !kindFilter ||
        lead.kind === kindFilter;

      return (
        matchesSearch &&
        matchesSeller &&
        matchesStatus &&
        matchesKind
      );
    });
  }, [
    leads,
    search,
    sellerFilter,
    statusFilter,
    kindFilter,
  ]);

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(sellerFilter) ||
    Boolean(statusFilter) ||
    Boolean(kindFilter);

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
          placeholder="Buscar cliente ou observação..."
          className="input h-10 flex-1 min-w-[200px]"
        />

        {showKind && (
          <select
            value={kindFilter}
            onChange={(event) =>
              setKindFilter(
                event.target.value
              )
            }
            className="input h-10"
          >
            <option value="">
              Telão e TV
            </option>

            {KIND_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        )}

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
              setKindFilter("");
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

      <ColumnClearBar
        companyId={companyId}
        listId={listId}
        columns={columns}
        leadIds={filteredLeads.map((lead) => lead.id)}
        totalCount={leads.length}
        filtered={hasActiveFilters}
        onDone={() => setColumns(NO_COLUMNS)}
      />

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <Header>Cliente</Header>
                {showKind && (
                  <Header>Tipo</Header>
                )}
                <Header>
                  {columnCheckbox("seller", "Vendedor")}
                  Vendedor
                </Header>
                <Header>
                  {columnCheckbox("value", "Valor")}
                  Valor
                </Header>
                <Header>
                  {columnCheckbox("size", "Tamanho")}
                  Tamanho
                </Header>
                <Header>
                  {columnCheckbox("status", "Situação")}
                  Situação
                </Header>
                <Header>
                  {columnCheckbox(
                    "billingNote",
                    "Observações"
                  )}
                  Observações
                </Header>
                <Header>{""}</Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map(
                (lead) => (
                  <LeadRow
                    key={`${lead.id}:${lead.status}:${lead.seller_user_id ?? ""}:${lead.value ?? ""}:${lead.size ?? ""}:${lead.billing_note ?? ""}`}
                    companyId={
                      companyId
                    }
                    listId={listId}
                    lead={lead}
                    sellers={sellers}
                    showKind={showKind}
                  />
                )
              )}

              {filteredLeads.length ===
                0 && (
                <tr>
                  <td
                    colSpan={showKind ? 8 : 7}
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
    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
