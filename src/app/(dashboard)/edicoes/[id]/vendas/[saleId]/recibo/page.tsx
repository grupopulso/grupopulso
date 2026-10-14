import {
  notFound,
} from "next/navigation";

import {
  createAdminClient,
} from "@/app/lib/supabase/admin";

import {
  requireEstafetaAccess,
} from "@/app/lib/estafeta-access";

import PrintButton from "./print-button";

type PageProps = {
  params: Promise<{
    id: string;
    saleId: string;
  }>;
};

type FinancialEntry = {
  id: string;
  amount_paid: number | string | null;
  status: string;
};

export default async function SaleReceiptPage({
  params,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const {
    id: editionId,
    saleId,
  } = await params;

  /*
   * Service role: acesso já validado por
   * `requireEstafetaAccess()`; consultas filtradas por
   * `access.estafetaCompany.id` (mesmo padrão da tela
   * de detalhe da venda).
   */
  const supabase =
    createAdminClient();

  /*
   * =========================
   * EDIÇÃO
   * =========================
   */

  const {
    data: edition,
  } =
    await supabase
      .from(
        "newspaper_editions"
      )
      .select(`
        id,
        name,
        edition_number,
        publication_date
      `)
      .eq(
        "id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (!edition) {
    notFound();
  }

  /*
   * =========================
   * VENDA
   * =========================
   */

  const {
    data: sale,
    error: saleError,
  } =
    await supabase
      .from(
        "edition_sales"
      )
      .select(`
        id,
        seller_user_id,
        status,
        total_amount,
        installments,
        first_due_date,
        notes,
        created_at,

        client:clients (
          id,
          name,
          cpf_cnpj,
          email,
          phone,
          whatsapp
        ),

        company:companies (
          id,
          name,
          legal_name,
          cnpj
        ),

        payment_method:financial_payment_methods (
          id,
          name
        ),

        items:edition_sale_items (
          id,
          description,
          placement,
          print_type,
          quantity,
          unit_price,
          total_amount,

          section:edition_sections (
            id,
            name
          )
        )
      `)
      .eq(
        "id",
        saleId
      )
      .eq(
        "edition_id",
        editionId
      )
      .eq(
        "company_id",
        access.estafetaCompany.id
      )
      .maybeSingle();

  if (
    saleError ||
    !sale
  ) {
    if (saleError) {
      console.error(
        "Erro ao carregar venda:",
        saleError
      );
    }

    notFound();
  }

  /*
   * =========================
   * VENDEDOR
   * =========================
   */

  let sellerName:
    string | null =
    null;

  if (
    sale.seller_user_id
  ) {
    const {
      data: seller,
    } =
      await supabase
        .from(
          "user_profiles"
        )
        .select("name")
        .eq(
          "id",
          sale.seller_user_id
        )
        .maybeSingle();

    sellerName =
      seller?.name ??
      null;
  }

  /*
   * =========================
   * PARCELAS + RECEBIMENTOS
   * =========================
   */

  const {
    data: installments,
    error:
      installmentsError,
  } =
    await supabase
      .from(
        "edition_sale_installments"
      )
      .select(`
        id,
        installment_number,
        due_date,
        amount,
        financial_entry_id
      `)
      .eq(
        "sale_id",
        sale.id
      )
      .order(
        "installment_number"
      );

  if (
    installmentsError
  ) {
    console.error(
      "Erro ao carregar parcelas da venda:",
      installmentsError
    );
  }

  const financialEntryIds =
    (
      installments ??
      []
    )
      .map(
        (installment) =>
          installment.financial_entry_id
      )
      .filter(Boolean);

  let financialEntries:
    FinancialEntry[] =
    [];

  if (
    financialEntryIds.length >
    0
  ) {
    const {
      data,
    } =
      await supabase
        .from(
          "financial_entries"
        )
        .select(`
          id,
          amount_paid,
          status
        `)
        .in(
          "id",
          financialEntryIds
        );

    financialEntries =
      (data ??
        []) as FinancialEntry[];
  }

  const financialEntriesById =
    new Map(
      financialEntries.map(
        (entry) => [
          entry.id,
          entry,
        ]
      )
    );

  /*
   * =========================
   * RELACIONAMENTOS / VALORES
   * =========================
   */

  const client =
    getFirst(
      sale.client
    );

  const company =
    getFirst(
      sale.company
    );

  const paymentMethod =
    getFirst(
      sale.payment_method
    );

  const items =
    sale.items ??
    [];

  const saleTotal =
    Number(
      sale.total_amount
    );

  const installmentRows =
    (
      installments ??
      []
    ).map(
      (installment) => {
        const amount =
          Number(
            installment.amount
          );

        const entry =
          financialEntriesById.get(
            installment.financial_entry_id
          );

        // Igual à tela da venda: juros/multa não
        // contam como principal recebido.
        const paid =
          Math.max(
            0,
            Math.min(
              Number(
                entry?.amount_paid ??
                  0
              ),
              amount
            )
          );

        return {
          ...installment,
          amount,
          paid,
          status:
            entry?.status ??
            "pending",
        };
      }
    );

  const totalReceived =
    roundMoney(
      installmentRows.reduce(
        (total, row) =>
          total + row.paid,
        0
      )
    );

  const totalOpen =
    Math.max(
      roundMoney(
        saleTotal -
          totalReceived
      ),
      0
    );

  const installmentCount =
    sale.installments ??
    installmentRows.length ??
    1;

  const clientPhone =
    client?.phone ||
    client?.whatsapp ||
    "—";

  return (
    <main className="min-h-screen bg-slate-100 p-8 print:min-h-0 print:w-full print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl print:m-0 print:w-full print:max-w-none">

        <article className="rounded-2xl bg-white p-10 shadow-sm print:m-0 print:w-full print:max-w-none print:rounded-none print:p-0 print:shadow-none">

          {/* CABEÇALHO */}

          <header className="border-b border-slate-200 pb-6">
            <div className="flex items-start justify-between gap-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#15704f]">
                  Venda de publicidade / Recibo
                </p>

                <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                  {company?.name ??
                    "O Estafeta"}
                </h1>

                {company?.legal_name && (
                  <p className="mt-1 text-sm text-slate-500">
                    {company.legal_name}
                  </p>
                )}

                {company?.cnpj && (
                  <p className="mt-1 text-sm text-slate-500">
                    CNPJ: {company.cnpj}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Venda
                </p>

                <p className="mt-1 font-mono text-sm font-semibold text-slate-700">
                  {sale.id
                    .slice(0, 8)
                    .toUpperCase()}
                </p>

                {sale.status ===
                  "cancelled" && (
                  <p className="mt-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                    CANCELADA
                  </p>
                )}
              </div>
            </div>
          </header>

          {/* CLIENTE */}

          <section className="mt-8 print:break-inside-avoid">
            <h2 className="text-lg font-semibold text-slate-900">
              Cliente
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
              <Info
                label="Nome"
                value={
                  client?.name ??
                  "—"
                }
              />

              <Info
                label="CPF / CNPJ"
                value={
                  client?.cpf_cnpj ||
                  "—"
                }
              />

              <Info
                label="E-mail"
                value={
                  client?.email ||
                  "—"
                }
              />

              <Info
                label="Telefone"
                value={clientPhone}
              />
            </div>
          </section>

          {/* VENDA */}

          <section className="mt-8 border-t border-slate-100 pt-8 print:break-inside-avoid">
            <h2 className="text-lg font-semibold text-slate-900">
              Dados da venda
            </h2>

            <div className="mt-4 grid grid-cols-3 gap-6">
              <Info
                label="Edição"
                value={`${edition.name}${
                  edition.edition_number
                    ? ` (nº ${edition.edition_number})`
                    : ""
                }`}
              />

              <Info
                label="Data da publicação"
                value={formatDate(
                  edition.publication_date
                )}
              />

              <Info
                label="Data da venda"
                value={formatDateTime(
                  sale.created_at
                )}
              />

              <Info
                label="Vendedor"
                value={
                  sellerName ??
                  "—"
                }
              />

              <Info
                label="Forma de pagamento"
                value={
                  paymentMethod?.name ??
                  "—"
                }
              />

              <Info
                label="Parcelas"
                value={`${installmentCount}x`}
              />
            </div>
          </section>

          {/* ANÚNCIOS */}

          <section className="mt-8 border-t border-slate-100 pt-8">
            <h2 className="text-lg font-semibold text-slate-900">
              Anúncios contratados
            </h2>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                      Descrição
                    </th>

                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                      Qtd.
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                      Valor unit.
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {items.map(
                    (item) => {
                      const section =
                        getFirst(
                          item.section
                        );

                      const details =
                        [
                          section?.name,
                          item.placement,
                          item.print_type
                            ? getPrintTypeLabel(
                                item.print_type
                              )
                            : null,
                        ].filter(
                          Boolean
                        );

                      return (
                        <tr
                          key={item.id}
                          className="print:break-inside-avoid"
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-slate-800">
                              {item.description}
                            </p>

                            {details.length >
                              0 && (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {details.join(
                                  " • "
                                )}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center text-sm text-slate-700">
                            {item.quantity}
                          </td>

                          <td className="px-4 py-3 text-right text-sm text-slate-700">
                            {formatCurrency(
                              Number(
                                item.unit_price
                              )
                            )}
                          </td>

                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              Number(
                                item.total_amount
                              )
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* PAGAMENTO */}

          {installmentRows.length >
            0 && (
            <section className="mt-8 border-t border-slate-100 pt-8">
              <h2 className="text-lg font-semibold text-slate-900">
                Pagamento
              </h2>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                        Parcela
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                        Vencimento
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Valor
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Recebido
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Situação
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {installmentRows.map(
                      (row) => (
                        <tr
                          key={row.id}
                          className="print:break-inside-avoid"
                        >
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {row.installment_number}/
                            {installmentRows.length}
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-700">
                            {formatDate(
                              row.due_date
                            )}
                          </td>

                          <td className="px-4 py-3 text-right text-sm text-slate-900">
                            {formatCurrency(
                              row.amount
                            )}
                          </td>

                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              row.paid
                            )}
                          </td>

                          <td className="px-4 py-3 text-right text-sm text-slate-700">
                            {getInstallmentStatusLabel(
                              row.status,
                              row.paid,
                              row.amount
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* OBSERVAÇÕES */}

          {sale.notes && (
            <section className="mt-8 border-t border-slate-100 pt-8 print:break-inside-avoid">
              <h2 className="text-lg font-semibold text-slate-900">
                Observações
              </h2>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {sale.notes}
              </p>
            </section>
          )}

          {/* RESUMO FINANCEIRO */}

          <section className="mt-8 grid grid-cols-3 gap-6 rounded-xl bg-slate-50 p-5 print:break-inside-avoid">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Total da venda
              </p>

              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatCurrency(
                  saleTotal
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Recebido
              </p>

              <p className="mt-1 text-2xl font-semibold text-[#15704f]">
                {formatCurrency(
                  totalReceived
                )}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                A receber
              </p>

              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatCurrency(
                  totalOpen
                )}
              </p>
            </div>
          </section>

          {/* DECLARAÇÃO */}

          {totalReceived >
            0 && (
            <p className="mt-8 text-sm leading-6 text-slate-700 print:break-inside-avoid">
              Recebemos de{" "}
              <strong>
                {client?.name ??
                  "cliente"}
              </strong>{" "}
              a importância de{" "}
              <strong>
                {formatCurrency(
                  totalReceived
                )}
              </strong>
              , referente à veiculação de publicidade na edição{" "}
              <strong>
                {edition.name}
              </strong>
              {totalOpen > 0
                ? `, restando ${formatCurrency(
                    totalOpen
                  )} a receber.`
                : ", dando plena quitação do valor da venda."}
            </p>
          )}

          {/* ASSINATURAS */}

          <section
            id="sale-signatures"
            className="mt-10 grid grid-cols-2 gap-16 pt-6 print:mt-4 print:break-inside-avoid print:pt-3"
          >
            <div className="border-t border-slate-400 pt-3 text-center">
              <p className="text-sm font-medium text-slate-700">
                {company?.name ??
                  "Empresa"}
              </p>

              {company?.cnpj && (
                <p className="mt-1 text-xs text-slate-400">
                  CNPJ {company.cnpj}
                </p>
              )}
            </div>

            <div className="border-t border-slate-400 pt-3 text-center">
              <p className="text-sm font-medium text-slate-700">
                {client?.name ??
                  "Cliente"}
              </p>

              {client?.cpf_cnpj && (
                <p className="mt-1 text-xs text-slate-400">
                  CPF/CNPJ {client.cpf_cnpj}
                </p>
              )}
            </div>
          </section>

          <footer className="mt-10 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
            Documento gerado pelo Sistema Grupo Pulso.
          </footer>
        </article>

        <PrintButton />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 3mm;
              }

              html,
              body,
              main,
              main > div {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                min-width: 0 !important;
                max-width: none !important;
                background: white !important;
              }

              article {
                box-sizing: border-box !important;
                width: 100% !important;
                max-width: none !important;
                margin: 0 !important;
                padding: 6mm 5mm !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                font-size: 11px !important;
              }

              article h1 {
                font-size: 22px !important;
              }

              article h2 {
                font-size: 15px !important;
              }

              article p {
                line-height: 1.3 !important;
              }

              article table th {
                padding: 6px 10px !important;
                font-size: 9px !important;
              }

              article table td {
                padding: 6px 10px !important;
                font-size: 10px !important;
              }

              article section {
                margin-top: 14px !important;
                padding-top: 14px !important;
              }

              article tr,
              #sale-signatures {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }
          `,
        }}
      />
    </main>
  );
}

/*
 * =========================
 * COMPONENTES
 * =========================
 */

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}

/*
 * =========================
 * HELPERS
 * =========================
 */

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

function getPrintTypeLabel(
  value: string
) {
  const labels: Record<
    string,
    string
  > = {
    color:
      "Interno colorido",

    black_white:
      "Interno preto e branco",

    other:
      "Outro",
  };

  return (
    labels[value] ??
    value
  );
}

function getInstallmentStatusLabel(
  status: string,
  paid: number,
  amount: number
) {
  if (
    status === "cancelled"
  ) {
    return "Cancelada";
  }

  if (
    paid >= amount &&
    amount > 0
  ) {
    return "Paga";
  }

  if (paid > 0) {
    return "Parcial";
  }

  if (
    status === "overdue"
  ) {
    return "Vencida";
  }

  return "Em aberto";
}

function formatDate(
  date: string | null
) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(
    `${date.slice(0, 10)}T12:00:00`
  );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-BR"
  ).format(parsed);
}

function formatDateTime(
  date: string | null
) {
  if (!date) {
    return "—";
  }

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
      timeZone:
        "America/Sao_Paulo",
    }
  ).format(parsed);
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(value);
}

function roundMoney(
  value: number
) {
  return (
    Math.round(
      (value +
        Number.EPSILON) *
        100
    ) / 100
  );
}
