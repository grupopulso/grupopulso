import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FilePlus2,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";

import {
  createClient,
} from "@/app/lib/supabase/server";

import { getSelectedCompanyId } from "@/app/lib/company-filter";

import {
  requireAnyCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import {
  getContractStatus,
  getMostUrgentContractStatus,
  normalizeStoredStatus,
} from "@/app/lib/contract-status";

type ClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Company = {
  id: string;
  name: string;
  color: string | null;
};

type ClientCompany = {
  company_id: string;
  status: string;
  company:
    | Company[]
    | Company
    | null;
};

type Address = {
  id: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  reference: string | null;
  is_primary: boolean;
};

type ContractCompany = {
  id: string;
  name: string;
  color: string | null;
};

type Product = {
  id: string;
  name: string;
};

type Contract = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  value: number;
  billing_frequency:
    | string
    | null;
  status: string;

  company:
    | ContractCompany[]
    | ContractCompany
    | null;

  product:
    | Product[]
    | Product
    | null;
};

type FinancialEntry = {
  id: string;
  description: string;
  type: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
  contract_id: string | null;
};

export default async function ClientPage({
  params,
}: ClientPageProps) {
  await requireModulePermission(
    "clients",
    "view"
  );

  const { id } =
    await params;

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * =========================
   * CLIENTE
   * =========================
   */

  const {
    data: client,
    error,
  } = await supabase
    .from("clients")
    .select(`
      id,
      type,
      name,
      trade_name,
      cpf_cnpj,
      email,
      phone,
      whatsapp,
      notes,
      active,
      created_at,

      client_addresses (
        id,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        postal_code,
        reference,
        is_primary
      ),

      client_companies (
        company_id,
        status,

        company:companies (
          id,
          name,
          color
        )
      )
    `)
    .eq("id", id)
    .single();

  if (
    error ||
    !client
  ) {
    notFound();
  }

  /*
   * Escopo de empresa: cliente é N:N com empresa
   * (client_companies). O usuário só pode ver a ficha se
   * tiver vínculo com pelo menos uma das empresas do
   * cliente (admin sempre passa).
   */
  const access =
    await requireAnyCompanyAccess(
      (
        client.client_companies ??
        []
      ).map(
        (relation) =>
          relation.company_id
      )
    );

  const isAdmin =
    access.profile.role === "admin";

  const selectedCompanyId =
    await getSelectedCompanyId();

  /*
   * As sublistas abaixo são por client_id. Se o cliente é
   * compartilhado entre empresas:
   * - um usuário não-admin não vê contratos/lançamentos de
   *   empresas às quais não tem acesso;
   * - se há uma empresa selecionada no topo, só mostramos
   *   os registros dela (não misturar empresas do grupo).
   */
  const canSeeCompany = (
    companyId: string | null | undefined
  ) => {
    if (
      selectedCompanyId &&
      companyId !== selectedCompanyId
    ) {
      return false;
    }

    return (
      isAdmin ||
      (Boolean(companyId) &&
        access.companyIds.includes(
          companyId as string
        ))
    );
  };

  /*
   * =========================
   * CONTRATOS
   * =========================
   */

  const {
    data: contractsData,
    error: contractsError,
  } = await supabase
    .from("contracts")
    .select(`
      id,
      title,
      start_date,
      end_date,
      value,
      billing_frequency,
      status,
      company_id,

      company:companies (
        id,
        name,
        color
      ),

      product:products (
        id,
        name
      )
    `)
    .eq(
      "client_id",
      id
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (
    contractsError
  ) {
    console.error(
      "Erro ao carregar contratos do cliente:",
      JSON.stringify(
        contractsError,
        null,
        2
      )
    );
  }

  const contracts = (
    (contractsData ??
      []) as (Contract & {
      company_id: string | null;
    })[]
  ).filter((contract) =>
    canSeeCompany(contract.company_id)
  );

  /*
   * =========================
   * FINANCEIRO
   * =========================
   */

  const {
    data: financialData,
    error: financialError,
  } = await supabase
    .from(
      "financial_entries"
    )
    .select(`
      id,
      description,
      type,
      due_date,
      amount,
      amount_paid,
      status,
      contract_id,
      company_id
    `)
    .eq(
      "client_id",
      id
    )
    .order(
      "due_date",
      {
        ascending: false,
      }
    );

  if (
    financialError
  ) {
    console.error(
      "Erro ao carregar financeiro do cliente:",
      JSON.stringify(
        financialError,
        null,
        2
      )
    );
  }

  const financialEntries = (
    (financialData ??
      []) as (FinancialEntry & {
      company_id: string | null;
    })[]
  ).filter((entry) =>
    canSeeCompany(entry.company_id)
  );

  /*
   * =========================
   * RELACIONAMENTOS
   * =========================
   */

  const relations =
    (client.client_companies ??
      []) as ClientCompany[];

  const addresses =
    (client.client_addresses ??
      []) as Address[];

  const mainAddress =
    addresses.find(
      (address) =>
        address.is_primary
    ) ??
    addresses[0] ??
    null;

  const mainStatus =
    getMostUrgentContractStatus(
      contracts
    ) ??
    normalizeStoredStatus(
      getMainStatus(
        relations.map(
          (relation) =>
            relation.status
        )
      )
    );

  /*
   * =========================
   * RESUMOS
   * =========================
   */

  const activeContracts =
    contracts.filter(
      (contract) => {
        const status =
          getContractStatus(
            contract
          );

        return (
          status ===
            "active" ||
          status ===
            "expiring"
        );
      }
    );

  const openFinancialEntries =
    financialEntries.filter(
      (entry) =>
        entry.type ===
          "income" &&
        [
          "pending",
          "overdue",
          "partial",
        ].includes(
          entry.status
        )
    );

  const totalReceivable =
    openFinancialEntries.reduce(
      (
        total,
        entry
      ) => {
        const amount =
          Number(
            entry.amount ??
              0
          );

        const paid =
          Number(
            entry.amount_paid ??
              0
          );

        return (
          total +
          Math.max(
            amount -
              paid,
            0
          )
        );
      },
      0
    );

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const nextDue =
    openFinancialEntries
      .filter(
        (entry) =>
          entry.due_date >=
          today
      )
      .sort(
        (a, b) =>
          a.due_date.localeCompare(
            b.due_date
          )
      )[0] ??
    null;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        {/* TOPO */}

        <div className="mb-6">
          <Link
            href="/clientes"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />

            Voltar para clientes
          </Link>
        </div>

        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                {client.name}
              </h1>

              <StatusBadge
                status={
                  mainStatus
                }
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>
                {client.type ===
                "company"
                  ? "Pessoa Jurídica"
                  : "Pessoa Física"}
              </span>

              {client.cpf_cnpj && (
                <>
                  <span>
                    •
                  </span>

                  <span>
                    {
                      client.cpf_cnpj
                    }
                  </span>
                </>
              )}
            </div>
          </div>

          {/* AÇÕES */}

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/contratos/novo?clientId=${id}`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#15704f]/20 bg-white px-4 text-sm font-semibold text-[#15704f] transition hover:bg-[#15704f]/5"
            >
              <FilePlus2 className="h-4 w-4" />

              Novo contrato
            </Link>

            <Link
              href={`/financeiro/novo?clientId=${id}`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <CircleDollarSign className="h-4 w-4" />

              Novo lançamento
            </Link>

            <Link
              href={`/clientes/${id}/editar`}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41]"
            >
              <Pencil className="h-4 w-4" />

              Editar cliente
            </Link>
          </div>
        </div>

        {/* CARDS */}

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={
              Building2
            }
            label="Empresas vinculadas"
            value={String(
              relations.length
            )}
          />

          <SummaryCard
            icon={
              FileText
            }
            label="Contratos ativos"
            value={String(
              activeContracts.length
            )}
          />

          <SummaryCard
            icon={
              CircleDollarSign
            }
            label="A receber"
            value={formatCurrency(
              totalReceivable
            )}
          />

          <SummaryCard
            icon={
              CalendarDays
            }
            label="Próximo vencimento"
            value={
              nextDue
                ? formatDateOnly(
                    nextDue.due_date
                  )
                : "—"
            }
          />
        </div>

        {/* CONTEÚDO */}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {/* DADOS */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Dados do cliente
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Informações cadastrais e de contato.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <InfoItem
                  icon={
                    UserRound
                  }
                  label={
                    client.type ===
                    "company"
                      ? "Razão Social"
                      : "Nome"
                  }
                  value={
                    client.name
                  }
                />

                {client.type ===
                  "company" && (
                  <InfoItem
                    icon={
                      Building2
                    }
                    label="Nome Fantasia"
                    value={
                      client.trade_name ||
                      "—"
                    }
                  />
                )}

                <InfoItem
                  icon={
                    Mail
                  }
                  label="E-mail"
                  value={
                    client.email ||
                    "—"
                  }
                />

                <InfoItem
                  icon={
                    Phone
                  }
                  label="Telefone"
                  value={
                    client.phone ||
                    "—"
                  }
                />

                <InfoItem
                  icon={
                    Phone
                  }
                  label="WhatsApp"
                  value={
                    client.whatsapp ||
                    "—"
                  }
                />

                <InfoItem
                  icon={
                    FileText
                  }
                  label="CPF / CNPJ"
                  value={
                    client.cpf_cnpj ||
                    "—"
                  }
                />
              </div>
            </section>

            {/* EMPRESAS */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Empresas vinculadas
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Relacionamento deste cliente dentro do Grupo Pulso.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {relations.length >
                0 ? (
                  relations.map(
                    (
                      relation,
                      index
                    ) => {
                      const company =
                        getCompany(
                          relation.company
                        );

                      if (
                        !company
                      ) {
                        return null;
                      }

                      return (
                        <div
                          key={`${company.id}-${index}`}
                          className="flex flex-col justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{
                                backgroundColor:
                                  company.color ??
                                  "#94a3b8",
                              }}
                            />

                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {
                                  company.name
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                Cliente vinculado
                              </p>
                            </div>
                          </div>

                          <StatusBadge
                            status={
                              getMostUrgentContractStatus(
                                contracts.filter(
                                  (contract) =>
                                    getCompany(
                                      contract.company
                                    )?.id ===
                                    company.id
                                )
                              ) ??
                              normalizeStoredStatus(
                                relation.status
                              )
                            }
                          />
                        </div>
                      );
                    }
                  )
                ) : (
                  <EmptyState text="Nenhuma empresa vinculada." />
                )}
              </div>
            </section>

            {/* CONTRATOS */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Contratos e assinaturas
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Produtos e serviços contratados pelo cliente.
                  </p>
                </div>

                <Link
                  href={`/contratos/novo?clientId=${id}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#15704f]/20 px-4 text-sm font-semibold text-[#15704f] transition hover:bg-[#15704f]/5"
                >
                  <Plus className="h-4 w-4" />

                  Novo contrato
                </Link>
              </div>

              <div className="mt-6 space-y-3">
                {contracts.length >
                0 ? (
                  contracts.map(
                    (contract) => {
                      const company =
                        getFirst(
                          contract.company
                        );

                      const product =
                        getFirst(
                          contract.product
                        );

                      return (
                        <div
                          key={
                            contract.id
                          }
                          className="rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50"
                        >
                          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {
                                  contract.title
                                }
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                {product?.name ??
                                  "Sem produto vinculado"}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                                {company && (
                                  <span>
                                    {
                                      company.name
                                    }
                                  </span>
                                )}

                                <span>
                                  {formatBillingLabel(
                                    contract.billing_frequency
                                  )}
                                </span>

                                <span>
                                  {formatDateOnly(
                                    contract.start_date
                                  )}
                                  {" → "}
                                  {contract.end_date
                                    ? formatDateOnly(
                                        contract.end_date
                                      )
                                    : "sem término"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <p className="text-sm font-semibold text-slate-900">
                                {formatCurrency(
                                  Number(
                                    contract.value
                                  )
                                )}
                              </p>

                              <StatusBadge
                                status={getContractStatus(
                                  contract
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )
                ) : (
                  <EmptyState text="Nenhum contrato cadastrado ainda." />
                )}
              </div>
            </section>

            {/* FINANCEIRO */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Financeiro
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Lançamentos e movimentações deste cliente.
                  </p>
                </div>

                <Link
                  href={`/financeiro/novo?clientId=${id}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#15704f]/20 px-4 text-sm font-semibold text-[#15704f] transition hover:bg-[#15704f]/5"
                >
                  <Plus className="h-4 w-4" />

                  Novo lançamento
                </Link>
              </div>

              <div className="mt-6 space-y-3">
                {financialEntries.length >
                0 ? (
                  financialEntries
                    .slice(
                      0,
                      10
                    )
                    .map(
                      (
                        entry
                      ) => (
                        <Link
                          key={
                            entry.id
                          }
                          href={`/financeiro/${entry.id}`}
                          className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {
                                entry.description
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Vencimento{" "}
                              {formatDateOnly(
                                entry.due_date
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <p
                              className={`text-sm font-semibold ${
                                entry.type ===
                                "income"
                                  ? "text-emerald-700"
                                  : "text-red-600"
                              }`}
                            >
                              {entry.type ===
                              "income"
                                ? "+"
                                : "-"}{" "}
                              {formatCurrency(
                                Number(
                                  entry.amount
                                )
                              )}
                            </p>

                            <FinancialStatusBadge
                              status={
                                entry.status
                              }
                            />
                          </div>
                        </Link>
                      )
                    )
                ) : (
                  <EmptyState text="Nenhum lançamento financeiro cadastrado." />
                )}
              </div>
            </section>
          </div>

          {/* LATERAL */}

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#15704f]" />

                <h2 className="font-semibold text-slate-900">
                  Endereço
                </h2>
              </div>

              {mainAddress ? (
                <div className="mt-5 text-sm leading-6 text-slate-600">
                  <p className="font-medium text-slate-900">
                    {formatStreet(
                      mainAddress
                    )}
                  </p>

                  {mainAddress.complement && (
                    <p>
                      {
                        mainAddress.complement
                      }
                    </p>
                  )}

                  {mainAddress.neighborhood && (
                    <p>
                      {
                        mainAddress.neighborhood
                      }
                    </p>
                  )}

                  {(mainAddress.city ||
                    mainAddress.state) && (
                    <p>
                      {[
                        mainAddress.city,
                        mainAddress.state,
                      ]
                        .filter(
                          Boolean
                        )
                        .join(
                          " - "
                        )}
                    </p>
                  )}

                  {mainAddress.postal_code && (
                    <p>
                      CEP{" "}
                      {
                        mainAddress.postal_code
                      }
                    </p>
                  )}

                  {mainAddress.reference && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Referência
                      </p>

                      <p className="mt-1">
                        {
                          mainAddress.reference
                        }
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState text="Nenhum endereço cadastrado." />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">
                Observações
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {client.notes ||
                  "Nenhuma observação cadastrada."}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">
                Informações do cadastro
              </h2>

              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Cadastrado em
                </p>

                <p className="mt-1 text-sm text-slate-700">
                  {formatDate(
                    client.created_at
                  )}
                </p>
              </div>

              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Cadastro
                </p>

                <p className="mt-1 text-sm text-slate-700">
                  {client.active
                    ? "Ativo"
                    : "Inativo"}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15704f]/10">
          <Icon className="h-5 w-5 text-[#15704f]" />
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>

        <p className="mt-1 text-sm font-medium text-slate-700">
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    active:
      "bg-emerald-50 text-emerald-700 border-emerald-100",

    expiring:
      "bg-amber-50 text-amber-700 border-amber-100",

    expired:
      "bg-red-50 text-red-700 border-red-100",

    cancelled:
      "bg-slate-100 text-slate-600 border-slate-200",
  };

  const labels: Record<
    string,
    string
  > = {
    active:
      "Ativo",

    expiring:
      "A vencer",

    expired:
      "Vencido",

    cancelled:
      "Cancelado",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] ??
        status}
    </span>
  );
}

function FinancialStatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    pending:
      "bg-amber-50 text-amber-700",

    overdue:
      "bg-red-50 text-red-700",

    partial:
      "bg-blue-50 text-blue-700",

    paid:
      "bg-emerald-50 text-emerald-700",

    cancelled:
      "bg-slate-100 text-slate-500",
  };

  const labels: Record<
    string,
    string
  > = {
    pending:
      "Pendente",

    overdue:
      "Vencido",

    partial:
      "Parcial",

    paid:
      "Pago",

    cancelled:
      "Cancelado",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-500"
      }`}
    >
      {labels[status] ??
        status}
    </span>
  );
}

function getMainStatus(
  statuses: string[]
) {
  if (
    statuses.includes(
      "expired"
    )
  ) {
    return "expired";
  }

  if (
    statuses.includes(
      "expiring"
    )
  ) {
    return "expiring";
  }

  if (
    statuses.includes(
      "active"
    )
  ) {
    return "active";
  }

  if (
    statuses.includes(
      "cancelled"
    )
  ) {
    return "cancelled";
  }

  return "active";
}

function getCompany(
  company:
    | Company[]
    | Company
    | null
): Company | null {
  if (!company) {
    return null;
  }

  if (
    Array.isArray(
      company
    )
  ) {
    return (
      company[0] ??
      null
    );
  }

  return company;
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

  return Array.isArray(
    value
  )
    ? value[0] ??
        null
    : value;
}

function formatStreet(
  address: Address
) {
  const street =
    address.street ||
    "Endereço";

  if (
    address.number
  ) {
    return `${street}, ${address.number}`;
  }

  return street;
}

function formatDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(
    new Date(date)
  );
}

function formatDateOnly(
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
      style: "currency",
      currency: "BRL",
    }
  ).format(
    value
  );
}

function formatBillingLabel(
  value: string | null
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

  return value
    ? labels[value] ??
        value
    : "—";
}