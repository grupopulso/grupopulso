import Link from "next/link";
import { PackagePlus } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function ProdutosPage() {
  const access =
    await requireModulePermission(
      "products",
      "view"
    );

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  let query = supabase
    .from("products")
    .select(`
      id,
      company_id,
      name,
      description,
      category,
      type,
      default_price,
      billing_frequency,
      active,

      company:companies (
        id,
        name,
        color
      )
    `);

if (selectedCompanyId) {
  query = query.eq(
    "company_id",
    selectedCompanyId
  );
} else if (
  access.profile.role !== "admin"
) {
  if (
    access.companyIds.length > 0
  ) {
    query = query.in(
      "company_id",
      access.companyIds
    );
  } else {
    /*
     * company_id é UUID.
     * Não podemos usar "__no_company__",
     * pois isso causa erro de UUID inválido.
     */
    query = query.eq(
      "company_id",
      "00000000-0000-0000-0000-000000000000"
    );
  }
}

  const {
    data: products,
    error,
  } = await query.order("name");

 if (error) {
  console.error(
    "ERRO COMPLETO AO CARREGAR PRODUTOS:",
    JSON.stringify(
      error,
      null,
      2
    )
  );
}

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Produtos e Serviços
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Produtos e serviços da empresa selecionada."
                : "Gerencie tudo que é comercializado pelas empresas do Grupo Pulso."}
            </p>
          </div>

          <Link
            href="/produtos/novo"
            className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <PackagePlus className="h-4 w-4" />
            Novo produto ou serviço
          </Link>
        </div>

        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Produto / Serviço
                  </TableHeader>

                  <TableHeader>
                    Empresa
                  </TableHeader>

                  <TableHeader>
                    Tipo
                  </TableHeader>

                  <TableHeader>
                    Cobrança
                  </TableHeader>

                  <TableHeader>
                    Valor
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {products?.map((product) => {
                  const company = getFirst(
                    product.company
                  );

                  return (
                    <tr
                      key={product.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">
                          {product.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {product.category ||
                            "Sem categoria"}
                        </p>

                        {product.description && (
                          <p className="mt-1 max-w-md truncate text-xs text-slate-400">
                            {product.description}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                company?.color ??
                                "#94a3b8",
                            }}
                          />

                          <span className="text-sm text-slate-700">
                            {company?.name ?? "—"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {getTypeLabel(
                          product.type
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {getBillingLabel(
                          product.billing_frequency
                        )}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-900">
                        {formatCurrency(
                          product.default_price
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <ProductStatusBadge
                          active={product.active}
                        />
                      </td>
                    </tr>
                  );
                })}

                {!products?.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-14 text-center"
                    >
                      <p className="text-sm font-medium text-slate-500">
                        Nenhum produto ou serviço encontrado.
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {selectedCompanyId
                          ? "Não há produtos cadastrados para a empresa selecionada."
                          : "Cadastre o primeiro produto ou serviço do Grupo Pulso."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function TableHeader({
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

function ProductStatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function getFirst<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function getTypeLabel(
  type: string
) {
  const labels: Record<string, string> = {
    product: "Produto",
    service: "Serviço",
    subscription: "Assinatura",
    advertising: "Publicidade",
    other: "Outro",
  };

  return labels[type] ?? type;
}

function getBillingLabel(
  frequency: string | null
) {
  if (!frequency) {
    return "—";
  }

  const labels: Record<string, string> = {
    one_time: "Pagamento único",
    monthly: "Mensal",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    annual: "Anual",
    custom: "Personalizado",
  };

  return labels[frequency] ?? frequency;
}

function formatCurrency(
  value: number | null
) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(Number(value));
}