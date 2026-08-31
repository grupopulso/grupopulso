import Link from "next/link";

import {
  ArrowLeft,
  Newspaper,
  Plus,
  ShoppingCart,
} from "lucide-react";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

type PageProps = {
  searchParams: Promise<{
    edicao?: string;
    status?: string;
    q?: string;
  }>;
};

type SaleRow = {
  id: string;
  edition_id: string;
  client_id: string | null;
  seller_user_id: string | null;
  status: string;
  total_amount: number | string;
  created_at: string;

  edition:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;

  client:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "draft", label: "Rascunho" },
  { value: "confirmed", label: "Confirmada" },
  { value: "cancelled", label: "Cancelada" },
];

export default async function VendasPublicidadePage({
  searchParams,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const { edicao, status, q } =
    await searchParams;

  const statusFilter =
    STATUS_OPTIONS.some(
      (option) => option.value === status
    )
      ? (status as string)
      : "all";

  const search = (q ?? "").trim();

  /*
   * Service role: acesso já validado por
   * `requireEstafetaAccess()` e tudo é filtrado por
   * `access.estafetaCompany.id`.
   */
  const supabase =
    createAdminClient();

  /*
   * EDIÇÕES (para o filtro)
   */

  const { data: editions } =
    await supabase
      .from("newspaper_editions")
      .select("id, name, status")
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .order("publication_date", {
        ascending: false,
      });

  /*
   * VENDAS
   */

  let query = supabase
    .from("edition_sales")
    .select(`
      id,
      edition_id,
      client_id,
      seller_user_id,
      status,
      total_amount,
      created_at,

      edition:newspaper_editions ( id, name ),
      client:clients ( id, name )
    `)
    .eq(
      "company_id",
      access.estafetaCompany.id
    )
    .order("created_at", {
      ascending: false,
    });

  if (edicao) {
    query = query.eq("edition_id", edicao);
  }

  if (statusFilter !== "all") {
    query = query.eq(
      "status",
      statusFilter
    );
  }

  const { data: salesData, error } =
    await query;

  if (error) {
    console.error(
      "Erro ao carregar vendas:",
      error
    );
  }

  const sales = (salesData ??
    []) as SaleRow[];

  /*
   * NOMES DOS VENDEDORES
   */

  const sellerIds = [
    ...new Set(
      sales
        .map(
          (sale) => sale.seller_user_id
        )
        .filter(
          (value): value is string =>
            Boolean(value)
        )
    ),
  ];

  const sellerNames = new Map<
    string,
    string
  >();

  if (sellerIds.length > 0) {
    const { data: profiles } =
      await supabase
        .from("user_profiles")
        .select("id, name")
        .in("id", sellerIds);

    for (const profile of profiles ?? []) {
      sellerNames.set(
        profile.id,
        profile.name ?? "Vendedor"
      );
    }
  }

  /*
   * FILTRO POR TEXTO (cliente) — em memória
   */

  const normalizedSearch = search
    .toLocaleLowerCase("pt-BR");

  const filteredSales = sales.filter(
    (sale) => {
      if (!normalizedSearch) {
        return true;
      }

      const client = getFirst(sale.client);

      return (client?.name ?? "")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch);
    }
  );

  const totalAmount = filteredSales.reduce(
    (total, sale) =>
      total + Number(sale.total_amount ?? 0),
    0
  );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/edicoes"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para edições
        </Link>

        <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
              <ShoppingCart className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Vendas de publicidade
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Todas as vendas avulsas de todas as edições.
              </p>
            </div>
          </div>

          <Link
            href="/edicoes/vendas/nova"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <Plus className="h-4 w-4" />
            Nova venda
          </Link>
        </div>

        {/* FILTROS */}

        <form
          method="get"
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
        >
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Buscar por cliente..."
            className="h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-[#15704f]"
          />

          <select
            name="edicao"
            defaultValue={edicao ?? ""}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-[#15704f]"
          >
            <option value="">
              Todas as edições
            </option>

            {(editions ?? []).map(
              (edition) => (
                <option
                  key={edition.id}
                  value={edition.id}
                >
                  {edition.name}
                </option>
              )
            )}
          </select>

          <select
            name="status"
            defaultValue={statusFilter}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-[#15704f]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Filtrar
          </button>

          {(search ||
            edicao ||
            statusFilter !== "all") && (
            <Link
              href="/edicoes/vendas"
              className="text-sm font-medium text-slate-500 hover:text-slate-900 sm:px-2"
            >
              Limpar
            </Link>
          )}
        </form>

        {/* TABELA */}

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Cliente</Th>
                  <Th>Edição</Th>
                  <Th>Vendedor</Th>
                  <Th>Valor</Th>
                  <Th>Status</Th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => {
                  const client = getFirst(
                    sale.client
                  );

                  const edition = getFirst(
                    sale.edition
                  );

                  return (
                    <tr
                      key={sale.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/edicoes/${sale.edition_id}/vendas/${sale.id}`}
                          className="text-sm font-semibold text-slate-900 hover:text-[#15704f]"
                        >
                          {client?.name ??
                            "Cliente não identificado"}
                        </Link>
                      </td>

                      <td className="px-5 py-4">
                        {edition ? (
                          <Link
                            href={`/edicoes/${edition.id}`}
                            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#15704f]"
                          >
                            <Newspaper className="h-3.5 w-3.5" />
                            {edition.name}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-400">
                            —
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {sale.seller_user_id
                          ? sellerNames.get(
                              sale.seller_user_id
                            ) ?? "Vendedor"
                          : "—"}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          Number(
                            sale.total_amount ??
                              0
                          )
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={sale.status}
                        />
                      </td>
                    </tr>
                  );
                })}

                {!filteredSales.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-sm text-slate-400"
                    >
                      Nenhuma venda encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredSales.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
              <span>
                {filteredSales.length}{" "}
                venda
                {filteredSales.length === 1
                  ? ""
                  : "s"}
              </span>

              <span className="font-semibold text-slate-700">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Th({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    confirmed:
      "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-600",
  };

  const labels: Record<string, string> = {
    draft: "Rascunho",
    confirmed: "Confirmada",
    cancelled: "Cancelada",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function getFirst<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(
    Number.isFinite(value) ? value : 0
  );
}
