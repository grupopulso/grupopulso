import Link from "next/link";

import {
  ArrowLeft,
  FileBarChart,
} from "lucide-react";

import { notFound } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import { PrintButton } from "../espelho/print-button";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ReportRow = {
  id: string;
  origin: "contract" | "standalone";
  clientName: string;
  productName: string | null;
  description: string;
  sizeDescription: string | null;
  sectionName: string | null;
  positionName: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export default async function EditionReportPage({
  params,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const { id: editionId } =
    await params;

  const supabase =
    await createClient();

  const {
    data: edition,
    error: editionError,
  } = await supabase
    .from("newspaper_editions")
    .select(`
      id,
      name,
      edition_number,
      publication_date,

      company:companies ( id, name )
    `)
    .eq("id", editionId)
    .eq(
      "company_id",
      access.estafetaCompany.id
    )
    .maybeSingle();

  if (editionError || !edition) {
    notFound();
  }

  const [
    publicationsResult,
    salesResult,
  ] = await Promise.all([
    supabase
      .from(
        "contract_edition_publications"
      )
      .select(`
        id,
        size_description,
        amount,

        section:edition_sections ( name ),
        position:edition_ad_positions ( name ),

        contract:contracts (
          id,
          title,
          client:clients ( name ),
          product:products ( name )
        )
      `)
      .eq("edition_id", editionId)
      .eq("active", true),

    supabase
      .from("edition_sales")
      .select(`
        id,
        status,

        client:clients ( name ),

        items:edition_sale_items (
          id,
          description,
          size_description,
          quantity,
          unit_price,
          total_amount,

          section:edition_sections ( name ),
          position:edition_ad_positions ( name ),
          product:products ( name )
        )
      `)
      .eq("edition_id", editionId)
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .eq("status", "confirmed"),
  ]);

  if (publicationsResult.error) {
    console.error(
      "Erro ao carregar publicações:",
      publicationsResult.error
    );
  }

  if (salesResult.error) {
    console.error(
      "Erro ao carregar vendas:",
      salesResult.error
    );
  }

  const rows: ReportRow[] = [];

  for (const publication of publicationsResult.data ??
    []) {
    const contract = getFirst(
      publication.contract
    );

    rows.push({
      id: `pub-${publication.id}`,
      origin: "contract",
      clientName:
        getFirst(contract?.client)
          ?.name ?? "Cliente",
      productName:
        getFirst(contract?.product)
          ?.name ?? null,
      description:
        contract?.title ?? "Anúncio",
      sizeDescription:
        publication.size_description,
      sectionName:
        getFirst(publication.section)
          ?.name ?? null,
      positionName:
        getFirst(publication.position)
          ?.name ?? null,
      quantity: 1,
      unitPrice: Number(
        publication.amount ?? 0
      ),
      amount: Number(
        publication.amount ?? 0
      ),
    });
  }

  for (const sale of salesResult.data ??
    []) {
    const clientName =
      getFirst(sale.client)?.name ??
      "Cliente";

    for (const item of sale.items ??
      []) {
      rows.push({
        id: `item-${item.id}`,
        origin: "standalone",
        clientName,
        productName:
          getFirst(item.product)
            ?.name ?? null,
        description:
          item.description ||
          "Anúncio avulso",
        sizeDescription:
          item.size_description,
        sectionName:
          getFirst(item.section)
            ?.name ?? null,
        positionName:
          getFirst(item.position)
            ?.name ?? null,
        quantity: Number(
          item.quantity ?? 1
        ),
        unitPrice: Number(
          item.unit_price ?? 0
        ),
        amount: Number(
          item.total_amount ?? 0
        ),
      });
    }
  }

  rows.sort((a, b) => {
    const section =
      (a.sectionName ?? "").localeCompare(
        b.sectionName ?? "",
        "pt-BR"
      );

    if (section !== 0) {
      return section;
    }

    return a.clientName.localeCompare(
      b.clientName,
      "pt-BR"
    );
  });

  const total = rows.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  const company = getFirst(
    edition.company
  );

  const contractCount = rows.filter(
    (row) => row.origin === "contract"
  ).length;

  const standaloneCount =
    rows.length - contractCount;

  return (
    <main className="min-h-screen bg-slate-100 p-8 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl print:max-w-none">
        <div className="print:hidden">
          <Link
            href={`/edicoes/${edition.id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para edição
          </Link>
        </div>

        <article className="mt-5 rounded-2xl bg-white p-10 shadow-sm print:m-0 print:rounded-none print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-8 border-b border-slate-200 pb-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#15704f]">
                Relatório da edição
              </p>

              <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                {edition.name}
              </h1>

              <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-slate-500">
                {edition.edition_number && (
                  <span>
                    Edição nº{" "}
                    {edition.edition_number}
                  </span>
                )}

                <span>
                  {formatDate(
                    edition.publication_date
                  )}
                </span>

                {company?.name && (
                  <span>{company.name}</span>
                )}
              </div>
            </div>

            <div className="print:hidden">
              <PrintButton />
            </div>
          </header>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <SummaryCell
              label="Publicações"
              value={String(rows.length)}
            />

            <SummaryCell
              label="Via contrato / avulsas"
              value={`${contractCount} / ${standaloneCount}`}
            />

            <SummaryCell
              label="Total comercializado"
              value={formatCurrency(total)}
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 print:rounded-none">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 print:bg-slate-100">
                <tr>
                  <Th>Cliente</Th>
                  <Th>Publicidade</Th>
                  <Th>Tamanho</Th>
                  <Th>Caderno / Posição</Th>
                  <Th>Origem</Th>
                  <Th className="text-right">
                    Valor
                  </Th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="print:break-inside-avoid"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.clientName}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {row.productName && (
                        <span className="font-medium text-slate-700">
                          {row.productName}
                        </span>
                      )}

                      {row.productName
                        ? " — "
                        : ""}

                      {row.description}

                      {row.quantity > 1
                        ? ` (${row.quantity}x ${formatCurrency(
                            row.unitPrice
                          )})`
                        : ""}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {row.sizeDescription ||
                        "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {row.sectionName ??
                        "Geral"}

                      {row.positionName
                        ? ` • ${row.positionName}`
                        : ""}
                    </td>

                    <td className="px-4 py-3 text-slate-500">
                      {row.origin ===
                      "contract"
                        ? "Contrato"
                        : "Avulsa"}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(
                        row.amount
                      )}
                    </td>
                  </tr>
                ))}

                {!rows.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      Nenhuma publicação comercializada nesta edição.
                    </td>
                  </tr>
                )}
              </tbody>

              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 print:bg-slate-100">
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Total
                    </td>

                    <td className="px-4 py-3 text-right text-base font-semibold text-slate-900">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <footer className="mt-8 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
            Relatório gerado pelo Sistema Grupo Pulso.
          </footer>
        </article>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4 portrait; margin: 8mm; }
              body { background: white !important; }
              table { font-size: 10px !important; }
              th, td { padding: 5px 8px !important; }
            }
          `,
        }}
      />
    </main>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}

function SummaryCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 print:bg-white">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-slate-900">
        {value}
      </p>
    </div>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(
    Number.isFinite(value) ? value : 0
  );
}
