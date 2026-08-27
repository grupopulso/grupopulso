import {
  notFound,
} from "next/navigation";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import PrintButton from "./print-button";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ContractReceiptPage({
  params,
}: PageProps) {
  await requireModulePermission(
    "contracts",
    "view"
  );

  const {
    id,
  } = await params;

  const supabase =
    await createClient();

  /*
   * =========================
   * CONTRATO
   * =========================
   */

  const {
    data: contract,
    error,
  } =
    await supabase
      .from("contracts")
      .select(`
        id,
        company_id,
        title,
        start_date,
        end_date,
        value,
        billing_frequency,
        auto_renew,
        installments,
        first_due_date,
        notes,

        client:clients (
          id,
          name,
          cpf_cnpj,
          email,
          phone
        ),

        company:companies (
          id,
          name,
          legal_name,
          cnpj
        ),

        product:products (
          id,
          name
        ),

        payment_method:payment_methods (
          id,
          name
        )
      `)
      .eq(
        "id",
        id
      )
      .maybeSingle();

  if (
    error ||
    !contract
  ) {
    if (error) {
      console.error(
        "Erro ao buscar contrato:",
        error
      );
    }

    notFound();
  }

  /*
   * Escopo de empresa: o recibo expõe dados do contrato e do
   * cliente, então exige vínculo com a empresa do contrato
   * (admin sempre passa).
   */
  await requireCompanyAccess(
    contract.company_id
  );

  /*
   * =========================
   * PARCELAS
   * =========================
   */

  const {
    data: installments,
    error:
      installmentsError,
  } =
    await supabase
      .from(
        "contract_installments"
      )
      .select(`
        id,
        installment_number,
        due_date,
        amount
      `)
      .eq(
        "contract_id",
        id
      )
      .order(
        "installment_number",
        {
          ascending: true,
        }
      );

  if (
    installmentsError
  ) {
    console.error(
      "Erro ao buscar parcelas:",
      installmentsError
    );
  }

  /*
   * =========================
   * TVs / TELÕES
   * =========================
   */

  const {
    data: contractTvs,
    error:
      contractTvsError,
  } =
    await supabase
      .from(
        "contract_tvs"
      )
      .select(`
        id,
        tv_id,

        tv:pottencializa_tvs (
          id,
          name,
          location
        )
      `)
      .eq(
        "contract_id",
        id
      );

  if (
    contractTvsError
  ) {
    console.error(
      "Erro ao buscar TVs do contrato:",
      contractTvsError
    );
  }

  /*
   * =========================
   * RELACIONAMENTOS
   * =========================
   */

  const client =
    getFirst(
      contract.client
    );

  const company =
    getFirst(
      contract.company
    );

  const product =
    getFirst(
      contract.product
    );

  const paymentMethod =
    getFirst(
      contract.payment_method
    );

  const linkedTvs =
    (
      contractTvs ??
      []
    )
      .map(
        (item) =>
          getFirst(
            item.tv
          )
      )
      .filter(
        (
          tv
        ): tv is NonNullable<
          typeof tv
        > =>
          Boolean(tv)
      );

  /*
   * =========================
   * VALORES
   * =========================
   */

  const contractValue =
    Number(
      contract.value
    );

  const installmentCount =
    contract.installments ??
    installments?.length ??
    1;

  return (
  <main className="min-h-screen bg-slate-100 p-8 print:min-h-0 print:w-full print:bg-white print:p-0">
  <div className="mx-auto max-w-4xl print:m-0 print:w-full print:max-w-none">

    <article className="rounded-2xl bg-white p-10 shadow-sm print:m-0 print:w-full print:max-w-none print:rounded-none print:p-0 print:shadow-none">

          {/* CABEÇALHO */}

          <header className="border-b border-slate-200 pb-6">
            <div className="flex items-start justify-between gap-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#15704f]">
                  Contrato / Recibo
                </p>

                <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                  {company?.name ??
                    "Grupo Pulso"}
                </h1>

                {company?.legal_name && (
                  <p className="mt-1 text-sm text-slate-500">
                    {
                      company.legal_name
                    }
                  </p>
                )}

                {company?.cnpj && (
                  <p className="mt-1 text-sm text-slate-500">
                    CNPJ:{" "}
                    {
                      company.cnpj
                    }
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Contrato
                </p>

                <p className="mt-1 font-mono text-sm font-semibold text-slate-700">
                  {contract.id
                    .slice(
                      0,
                      8
                    )
                    .toUpperCase()}
                </p>
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
                  client?.cpf_cnpj ??
                  "—"
                }
              />

              <Info
                label="E-mail"
                value={
                  client?.email ??
                  "—"
                }
              />

              <Info
                label="Telefone"
                value={
                  client?.phone ??
                  "—"
                }
              />
            </div>
          </section>

          {/* OBJETO */}

          <section className="mt-8 border-t border-slate-100 pt-8 print:break-inside-avoid">
            <h2 className="text-lg font-semibold text-slate-900">
              Objeto do contrato
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
              <Info
                label="Título"
                value={
                  contract.title
                }
              />

              <Info
                label="Produto / Serviço"
                value={
                  product?.name ??
                  "—"
                }
              />

              <Info
                label="Valor total"
                value={formatCurrency(
                  contractValue
                )}
              />

              <Info
                label="Periodicidade"
                value={getBillingLabel(
                  contract.billing_frequency
                )}
              />
            </div>
          </section>

          {/* TVs / TELÕES */}

          {linkedTvs.length > 0 && (
            <section className="mt-8 border-t border-slate-100 pt-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Pontos de exibição
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    TVs / telões vinculados a este contrato.
                  </p>
                </div>

                <p className="text-sm font-semibold text-[#15704f]">
                  {
                    linkedTvs.length
                  }{" "}
                  {linkedTvs.length ===
                  1
                    ? "ponto"
                    : "pontos"}
                </p>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        TV / Ponto
                      </th>

                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Localização
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {linkedTvs.map(
                      (tv) => (
                        <tr
                          key={
                            tv.id
                          }
                          className="print:break-inside-avoid"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">
                            {
                              tv.name
                            }
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-600">
                            {tv.location ||
                              "Não informada"}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VIGÊNCIA */}

          <section className="mt-8 border-t border-slate-100 pt-8 print:break-inside-avoid">
            <h2 className="text-lg font-semibold text-slate-900">
              Vigência
            </h2>

            <div className="mt-4 grid grid-cols-3 gap-6">
              <Info
                label="Início"
                value={formatDate(
                  contract.start_date
                )}
              />

              <Info
                label="Término"
                value={
                  contract.end_date
                    ? formatDate(
                        contract.end_date
                      )
                    : "Sem término"
                }
              />

              <Info
                label="Renovação automática"
                value={
                  contract.auto_renew
                    ? "Sim"
                    : "Não"
                }
              />
            </div>
          </section>

          {/* PAGAMENTO */}

          <section className="mt-8 border-t border-slate-100 pt-8">
            <h2 className="text-lg font-semibold text-slate-900">
              Condições de pagamento
            </h2>

            <div className="mt-4 grid grid-cols-3 gap-6 print:break-inside-avoid">
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

              <Info
                label="1º vencimento"
                value={
                  contract.first_due_date
                    ? formatDate(
                        contract.first_due_date
                      )
                    : "—"
                }
              />
            </div>

            {!!installments?.length && (
              <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
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
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {installments.map(
                      (
                        installment
                      ) => (
                        <tr
                          key={
                            installment.id
                          }
                          className="print:break-inside-avoid"
                        >
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {
                              installment.installment_number
                            }
                            /
                            {
                              installmentCount
                            }
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-700">
                            {formatDate(
                              installment.due_date
                            )}
                          </td>

                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              Number(
                                installment.amount
                              )
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* OBSERVAÇÕES */}

          {contract.notes && (
            <section className="mt-8 border-t border-slate-100 pt-8 print:break-inside-avoid">
              <h2 className="text-lg font-semibold text-slate-900">
                Observações
              </h2>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {
                  contract.notes
                }
              </p>
            </section>
          )}

          {/* RESUMO FINANCEIRO */}

          <section className="mt-8 rounded-xl bg-slate-50 p-5 print:break-inside-avoid">
            <div className="flex items-center justify-between gap-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Valor total contratado
                </p>

                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatCurrency(
                    contractValue
                  )}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Condição
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {installmentCount}x
                  {" • "}
                  {paymentMethod?.name ??
                    "Não informada"}
                </p>
              </div>
            </div>
          </section>

          {/* ASSINATURAS */}

         <section
  id="contract-signatures"
  className="mt-10 grid grid-cols-2 gap-16 pt-6 print:mt-4 print:break-inside-avoid print:pt-3"
>
            <div className="border-t border-slate-400 pt-3 text-center">
              <p className="text-sm font-medium text-slate-700">
                {
                  company?.name ??
                  "Empresa"
                }
              </p>

              {company?.cnpj && (
                <p className="mt-1 text-xs text-slate-400">
                  CNPJ{" "}
                  {
                    company.cnpj
                  }
                </p>
              )}
            </div>

            <div className="border-t border-slate-400 pt-3 text-center">
              <p className="text-sm font-medium text-slate-700">
                {
                  client?.name ??
                  "Cliente"
                }
              </p>

              {client?.cpf_cnpj && (
                <p className="mt-1 text-xs text-slate-400">
                  CPF/CNPJ{" "}
                  {
                    client.cpf_cnpj
                  }
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
  body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
  }

  body {
    background: white !important;
  }

  main {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: none !important;
  }

  main > div {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: none !important;
  }

  article {
    box-sizing: border-box !important;

    width: 100% !important;
    max-width: none !important;

    margin: 0 !important;

    /*
     * Só uma pequena margem interna.
     */
    padding: 6mm 5mm !important;

    border-radius: 0 !important;
    box-shadow: none !important;

    /*
     * O texto estava pequeno demais.
     */
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

  article table {
    width: 100% !important;
  }

  article table th {
    padding: 6px 10px !important;
    font-size: 9px !important;
  }

  article table td {
    padding: 6px 10px !important;
    font-size: 10px !important;
  }

  article tr {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

#contract-signatures {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

  article section {
    margin-top: 14px !important;
    padding-top: 14px !important;
  }

  article tr {
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

  return Array.isArray(
    value
  )
    ? value[0] ??
        null
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
  value: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",
    }
  ).format(
    value
  );
}

function getBillingLabel(
  frequency:
    | string
    | null
) {
  const labels: Record<
    string,
    string
  > = {
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
    ? labels[
        frequency
      ] ??
        frequency
    : "—";
}