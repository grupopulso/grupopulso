import Link from "next/link";
import { FilePlus2 } from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";
import { getSelectedCompanyId } from "@/app/lib/company-filter";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function ContratosPage() {
  const access =
    await requireModulePermission(
      "contracts",
      "view"
    );

  const supabase =
    await createClient();

  const selectedCompanyId =
    await getSelectedCompanyId();

  let query = supabase
    .from("contracts")
    .select(`
      id,
      title,
      start_date,
      end_date,
      value,
      billing_frequency,
      status,
      auto_renew,

      client:clients (
        id,
        name
      ),

      company:companies (
        id,
        name,
        color
      ),

      product:products (
        id,
        name
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
    query = query.eq(
      "company_id",
      "00000000-0000-0000-0000-000000000000"
    );
  }
}

  const { data: contracts, error } =
    await query.order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Erro ao buscar contratos:",
      error
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Contratos e Assinaturas
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {selectedCompanyId
                ? "Gerencie os contratos e assinaturas da empresa selecionada."
                : "Gerencie contratos, serviços recorrentes e assinaturas do Grupo Pulso."}
            </p>
          </div>

          <Link
            href="/contratos/novo"
            className="flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
          >
            <FilePlus2 className="h-4 w-4" />
            Novo contrato
          </Link>
        </div>

        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Cliente
                  </TableHeader>

                  <TableHeader>
                    Produto / Serviço
                  </TableHeader>

                  <TableHeader>
                    Empresa
                  </TableHeader>

                  <TableHeader>
                    Vigência
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
                {contracts?.map((contract) => {
                  const client = getFirst(
                    contract.client
                  );

                  const company = getFirst(
                    contract.company
                  );

                  const product = getFirst(
                    contract.product
                  );

                  return (
                    <tr
                      key={contract.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        {client ? (
                          <Link
                            href={`/clientes/${client.id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-[#15704f]"
                          >
                            {client.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-slate-400">
                            —
                          </span>
                        )}

                    <Link
  href={`/contratos/${contract.id}`}
  className="mt-1 block text-xs font-medium text-[#15704f] hover:underline"
>
  {contract.title}
</Link>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {product?.name ?? "—"}
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

                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-700">
                          {formatDate(
                            contract.start_date
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          até{" "}
                          {contract.end_date
                            ? formatDate(
                                contract.end_date
                              )
                            : "sem término"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            Number(
                              contract.value
                            )
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {getBillingLabel(
                            contract.billing_frequency
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={
                            contract.status
                          }
                        />
                      </td>
                    </tr>
                  );
                })}

                {!contracts?.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-slate-400"
                    >
                      {selectedCompanyId
                        ? "Nenhum contrato cadastrado para a empresa selecionada."
                        : "Nenhum contrato cadastrado."}
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    active:
      "bg-emerald-50 text-emerald-700",

    expiring:
      "bg-amber-50 text-amber-700",

    expired:
      "bg-red-50 text-red-700",

    cancelled:
      "bg-slate-100 text-slate-600",
  };

  const labels: Record<string, string> = {
    active: "Ativo",
    expiring: "A vencer",
    expired: "Vencido",
    cancelled: "Cancelado",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] ?? status}
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

function formatDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "pt-BR"
  ).format(
    new Date(
      `${date}T12:00:00`
    )
  );
}

function formatCurrency(
  value: number | null
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(value ?? 0);
}

function getBillingLabel(
  frequency: string | null
) {
  const labels: Record<string, string> = {
    one_time:
      "Pagamento único",
    monthly:
      "Mensal",
    quarterly:
      "Trimestral",
    semiannual:
      "Semestral",
    annual:
      "Anual",
    custom:
      "Personalizado",
  };

  return frequency
    ? labels[frequency] ??
        frequency
    : "—";
}