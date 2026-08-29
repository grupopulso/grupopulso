"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  MapPin,
  Monitor,
  Save,
} from "lucide-react";

import {
  createClient,
} from "@/app/lib/supabase/client";

import {
  updateContract,
} from "./actions";

import {
  buildDueDates,
  distributeAmount,
} from "@/app/lib/date-utils";

const POTTENCIALIZA_COMPANY_ID =
  "9d08d74c-c5fe-48c9-b0c5-382cea273d99";

type BillingFrequency =
  | "one_time"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "custom";

type Props = {
  contract: {
    id: string;

    clientId: string;
    companyId: string;

    productId:
      | string
      | null;

    title: string;

    startDate: string;

    endDate:
      | string
      | null;

    value: number;

    billingFrequency:
      string;

    autoRenew:
      boolean;

    paymentMethodId:
      string;

    installments:
      number;

    firstDueDate:
      string;

    installmentSchedule: {
      dueDate: string;
      amount: number;
    }[];

    tvIds: string[];

    notes:
      | string
      | null;
  };
};

type Client = {
  id: string;
  name: string;
};

type Company = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  company_id: string;
  name: string;
};

type PaymentMethod = {
  id: string;
  name: string;
};

type Tv = {
  id: string;
  name: string;

  location:
    | string
    | null;
};

export default function EditContractForm({
  contract,
}: Props) {
  const router =
    useRouter();

  const [supabase] =
    useState(() =>
      createClient()
    );

  /*
   * =========================
   * DADOS AUXILIARES
   * =========================
   */

  const [
    clients,
    setClients,
  ] =
    useState<Client[]>([]);

  const [
    companies,
    setCompanies,
  ] =
    useState<Company[]>([]);

  const [
    products,
    setProducts,
  ] =
    useState<Product[]>([]);

  const [
    paymentMethods,
    setPaymentMethods,
  ] =
    useState<
      PaymentMethod[]
    >([]);

  const [
    tvs,
    setTvs,
  ] =
    useState<Tv[]>([]);

  /*
   * =========================
   * CONTRATO
   * =========================
   */

  const [
    clientId,
    setClientId,
  ] =
    useState(
      contract.clientId
    );

  const [
    companyId,
    setCompanyId,
  ] =
    useState(
      contract.companyId
    );

  const [
    productId,
    setProductId,
  ] =
    useState(
      contract.productId ??
      ""
    );

  const [
    title,
    setTitle,
  ] =
    useState(
      contract.title
    );

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      contract.startDate
    );

  const [
    endDate,
    setEndDate,
  ] =
    useState(
      contract.endDate ??
      ""
    );

  const [
    value,
    setValue,
  ] =
    useState(
      formatValue(
        contract.value
      )
    );

  const [
    billingFrequency,
    setBillingFrequency,
  ] =
    useState<BillingFrequency>(
      contract.billingFrequency as BillingFrequency
    );

  const [
    paymentMethodId,
    setPaymentMethodId,
  ] =
    useState(
      contract.paymentMethodId
    );

  const [
    installments,
    setInstallments,
  ] =
    useState(
      contract.installments
    );

  const [
    intervalDays,
    setIntervalDays,
  ] =
    useState(30);

  const [
    firstDueDate,
    setFirstDueDate,
  ] =
    useState(
      contract.firstDueDate
    );

  const [
    schedule,
    setSchedule,
  ] =
    useState<
      {
        dueDate: string;
        amount: string;
      }[]
    >(() =>
      contract.installmentSchedule
        .length > 0
        ? contract.installmentSchedule.map(
            (row) => ({
              dueDate: row.dueDate,
              amount: formatValue(
                row.amount
              ),
            })
          )
        : []
    );

  const scheduleFirstRun =
    useRef(true);

  const scheduleTouched =
    useRef(false);

  const [
    autoRenew,
    setAutoRenew,
  ] =
    useState(
      contract.autoRenew
    );

  const [
    notes,
    setNotes,
  ] =
    useState(
      contract.notes ??
      ""
    );

  /*
   * =========================
   * TVs
   * =========================
   */

  const [
    selectedTvIds,
    setSelectedTvIds,
  ] =
    useState<string[]>(
      contract.tvIds ??
        []
    );

  /*
   * =========================
   * UI
   * =========================
   */

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    loadingData,
    setLoadingData,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  /*
   * =========================
   * CARNÊ (datas + valores)
   * =========================
   */

  const numericValueForSchedule =
    parseMoney(value);

  useEffect(
    () => {
      if (scheduleFirstRun.current) {
        scheduleFirstRun.current = false;

        if (schedule.length > 0) {
          return;
        }
      }

      scheduleTouched.current = true;

      const count = Math.max(
        installments,
        1
      );

      const amounts =
        Number.isFinite(
          numericValueForSchedule
        ) &&
        numericValueForSchedule > 0
          ? distributeAmount(
              numericValueForSchedule,
              count
            )
          : Array.from(
              { length: count },
              () => 0
            );

      const dueDates = buildDueDates(
        firstDueDate,
        count,
        intervalDays
      );

      setSchedule(
        Array.from(
          { length: count },
          (_, index) => ({
            dueDate:
              dueDates[index] ?? "",
            amount: formatValue(
              amounts[index] ?? 0
            ),
          })
        )
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      numericValueForSchedule,
      installments,
      firstDueDate,
      intervalDays,
    ]
  );

  const scheduleTotal =
    schedule.reduce(
      (total, row) =>
        total + parseMoney(row.amount),
      0
    );

  const scheduleBalanced =
    numericValueForSchedule > 0 &&
    Math.abs(
      scheduleTotal -
        numericValueForSchedule
    ) < 0.01;

  function updateScheduleRow(
    index: number,
    field: "dueDate" | "amount",
    newValue: string
  ) {
    scheduleTouched.current = true;

    setSchedule((current) =>
      current.map((row, itemIndex) =>
        itemIndex === index
          ? {
              ...row,
              [field]: newValue,
            }
          : row
      )
    );
  }

  /*
   * =========================
   * CARREGAR DADOS
   * =========================
   */

  useEffect(() => {
    async function loadData() {
      setLoadingData(
        true
      );

      const [
        clientsResult,
        companiesResult,
        productsResult,
        methodsResult,
        tvsResult,
      ] =
        await Promise.all([
          supabase
            .from(
              "clients"
            )
            .select(
              "id, name"
            )
            .eq(
              "active",
              true
            )
            .order(
              "name"
            ),

          supabase
            .from(
              "companies"
            )
            .select(
              "id, name"
            )
            .eq(
              "active",
              true
            )
            .order(
              "name"
            ),

          supabase
            .from(
              "products"
            )
            .select(`
              id,
              company_id,
              name
            `)
            .eq(
              "active",
              true
            )
            .order(
              "name"
            ),

          supabase
            .from(
              "payment_methods"
            )
            .select(
              "id, name"
            )
            .eq(
              "active",
              true
            )
            .in(
              "use_for",
              [
                "income",
                "both",
              ]
            )
            .order(
              "name"
            ),

          supabase
            .from(
              "pottencializa_tvs"
            )
            .select(`
              id,
              name,
              location
            `)
            .eq(
              "company_id",
              POTTENCIALIZA_COMPANY_ID
            )
            .eq(
              "active",
              true
            )
            .order(
              "name"
            ),
        ]);

      if (
        clientsResult.error
      ) {
        console.error(
          "Erro ao carregar clientes:",
          clientsResult.error
        );
      }

      if (
        companiesResult.error
      ) {
        console.error(
          "Erro ao carregar empresas:",
          companiesResult.error
        );
      }

      if (
        productsResult.error
      ) {
        console.error(
          "Erro ao carregar produtos:",
          productsResult.error
        );
      }

      if (
        methodsResult.error
      ) {
        console.error(
          "Erro ao carregar formas de pagamento:",
          methodsResult.error
        );
      }

      if (
        tvsResult.error
      ) {
        console.error(
          "Erro ao carregar TVs:",
          tvsResult.error
        );
      }

      setClients(
        clientsResult.data ??
          []
      );

      setCompanies(
        companiesResult.data ??
          []
      );

      setProducts(
        productsResult.data ??
          []
      );

      setPaymentMethods(
        methodsResult.data ??
          []
      );

      setTvs(
        (tvsResult.data ??
          []) as Tv[]
      );

      setLoadingData(
        false
      );
    }

    loadData();
  }, [
    supabase,
  ]);

  /*
   * =========================
   * PRODUTOS
   * =========================
   */

  const availableProducts =
    useMemo(
      () =>
        products.filter(
          (product) =>
            product.company_id ===
            companyId
        ),
      [
        products,
        companyId,
      ]
    );

  /*
   * =========================
   * EMPRESA
   * =========================
   */

  function handleCompanyChange(
    newCompanyId: string
  ) {
    setCompanyId(
      newCompanyId
    );

    setProductId(
      ""
    );

    /*
     * Se sair da
     * Pottencializa,
     * removemos as TVs.
     */

    if (
      newCompanyId !==
      POTTENCIALIZA_COMPANY_ID
    ) {
      setSelectedTvIds(
        []
      );
    }
  }

  /*
   * =========================
   * TVs
   * =========================
   */

  function toggleTv(
    tvId: string
  ) {
    setSelectedTvIds(
      (current) =>
        current.includes(
          tvId
        )
          ? current.filter(
              (id) =>
                id !==
                tvId
            )
          : [
              ...current,
              tvId,
            ]
    );
  }

  function selectAllTvs() {
    setSelectedTvIds(
      tvs.map(
        (tv) =>
          tv.id
      )
    );
  }

  function clearTvs() {
    setSelectedTvIds(
      []
    );
  }

  /*
   * =========================
   * SALVAR
   * =========================
   */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    const numericValue =
      parseMoney(
        value
      );

    if (
      numericValue <=
      0
    ) {
      setError(
        "Informe um valor válido."
      );

      return;
    }

    if (
      !paymentMethodId
    ) {
      setError(
        "Selecione a forma de pagamento."
      );

      return;
    }

    if (
      !Number.isInteger(
        installments
      ) ||
      installments < 1
    ) {
      setError(
        "Informe uma quantidade válida de parcelas."
      );

      return;
    }

    if (
      schedule.length !==
        installments ||
      schedule.some(
        (row) => !row.dueDate
      )
    ) {
      setError(
        "Informe a data de vencimento de todas as parcelas."
      );

      return;
    }

    if (!scheduleBalanced) {
      setError(
        `A soma das parcelas precisa ser ${formatValue(
          numericValueForSchedule
        )}.`
      );

      return;
    }

    setLoading(
      true
    );

    const result =
      await updateContract({
        contractId:
          contract.id,

        clientId,

        companyId,

        productId:
          productId ||
          null,

        title,

        startDate,

        endDate:
          endDate ||
          null,

        value:
          numericValue,

        billingFrequency,

        paymentMethodId,

        installments,

        firstDueDate,

        installmentValues:
          schedule.map((row) =>
            parseMoney(row.amount)
          ),

        installmentDues:
          schedule.map(
            (row) => row.dueDate
          ),

        scheduleTouched:
          scheduleTouched.current,

        autoRenew,

        tvIds:
          companyId ===
          POTTENCIALIZA_COMPANY_ID
            ? selectedTvIds
            : [],

        notes:
          notes ||
          null,
      });

    if (
      !result.success
    ) {
      setError(
        result.error ??
          "Não foi possível atualizar o contrato."
      );

      setLoading(
        false
      );

      return;
    }

    router.push(
      `/contratos/${contract.id}`
    );

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <form
        onSubmit={
          handleSubmit
        }
        className="mx-auto max-w-5xl"
      >
        {/* CABEÇALHO */}

        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />

          Voltar
        </button>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Editar contrato
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Altere dados,
              vigência e condições
              comerciais.
            </p>
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              loadingData
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />

            {loading
              ? "Salvando..."
              : "Salvar alterações"}
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* INFORMAÇÕES */}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Informações principais
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field label="Cliente">
              <select
                value={
                  clientId
                }
                onChange={(
                  event
                ) =>
                  setClientId(
                    event.target
                      .value
                  )
                }
                className="input"
                required
              >
                {clients.map(
                  (client) => (
                    <option
                      key={
                        client.id
                      }
                      value={
                        client.id
                      }
                    >
                      {
                        client.name
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Empresa">
              <select
                value={
                  companyId
                }
                onChange={(
                  event
                ) =>
                  handleCompanyChange(
                    event.target
                      .value
                  )
                }
                className="input"
                required
              >
                {companies.map(
                  (company) => (
                    <option
                      key={
                        company.id
                      }
                      value={
                        company.id
                      }
                    >
                      {
                        company.name
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Produto / Serviço">
              <select
                value={
                  productId
                }
                onChange={(
                  event
                ) =>
                  setProductId(
                    event.target
                      .value
                  )
                }
                className="input"
              >
                <option value="">
                  Sem produto
                </option>

                {availableProducts.map(
                  (product) => (
                    <option
                      key={
                        product.id
                      }
                      value={
                        product.id
                      }
                    >
                      {
                        product.name
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Título">
              <input
                value={
                  title
                }
                onChange={(
                  event
                ) =>
                  setTitle(
                    event.target
                      .value
                  )
                }
                className="input"
                required
              />
            </Field>

            <Field label="Valor total">
              <input
                value={
                  value
                }
                onChange={(
                  event
                ) =>
                  setValue(
                    event.target
                      .value
                  )
                }
                inputMode="decimal"
                className="input"
                required
              />
            </Field>

            <Field label="Periodicidade">
              <select
                value={
                  billingFrequency
                }
                onChange={(
                  event
                ) =>
                  setBillingFrequency(
                    event.target
                      .value as BillingFrequency
                  )
                }
                className="input"
              >
                <option value="one_time">
                  Pagamento único
                </option>

                <option value="monthly">
                  Mensal
                </option>

                <option value="quarterly">
                  Trimestral
                </option>

                <option value="semiannual">
                  Semestral
                </option>

                <option value="annual">
                  Anual
                </option>

                <option value="custom">
                  Personalizado
                </option>
              </select>
            </Field>
          </div>
        </section>

        {/* TVs / TELÕES */}

        {companyId ===
          POTTENCIALIZA_COMPANY_ID && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-[#15704f]" />

                  <h2 className="font-semibold text-slate-900">
                    TVs / Telões vinculados
                  </h2>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Selecione os pontos de exibição vinculados a este contrato.
                </p>
              </div>

              {tvs.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={
                      selectAllTvs
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Selecionar todas
                  </button>

                  <button
                    type="button"
                    onClick={
                      clearTvs
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>

            {tvs.length > 0 ? (
              <>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {tvs.map(
                    (tv) => {
                      const selected =
                        selectedTvIds.includes(
                          tv.id
                        );

                      return (
                        <button
                          key={
                            tv.id
                          }
                          type="button"
                          onClick={() =>
                            toggleTv(
                              tv.id
                            )
                          }
                          className={`rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-[#15704f] bg-[#15704f]/5"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={
                                selected
                              }
                              readOnly
                              className="mt-0.5 h-4 w-4 accent-[#15704f]"
                            />

                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {
                                  tv.name
                                }
                              </p>

                              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />

                                <span>
                                  {tv.location ||
                                    "Localização não informada"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-500">
                    Pontos selecionados
                  </span>

                  <span className="text-sm font-semibold text-[#15704f]">
                    {
                      selectedTvIds.length
                    }{" "}
                    de{" "}
                    {
                      tvs.length
                    }
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                Nenhuma TV ativa cadastrada para a Pottencializa.
              </div>
            )}
          </section>
        )}

        {/* VIGÊNCIA */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Vigência e cobrança
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Data de início">
              <input
                type="date"
                value={
                  startDate
                }
                onChange={(
                  event
                ) =>
                  setStartDate(
                    event.target
                      .value
                  )
                }
                className="input"
                required
              />
            </Field>

            <Field label="Data de término">
              <input
                type="date"
                value={
                  endDate
                }
                onChange={(
                  event
                ) =>
                  setEndDate(
                    event.target
                      .value
                  )
                }
                className="input"
              />
            </Field>

            <Field label="Forma de pagamento">
              <select
                value={
                  paymentMethodId
                }
                onChange={(
                  event
                ) =>
                  setPaymentMethodId(
                    event.target
                      .value
                  )
                }
                className="input"
                required
              >
                <option value="">
                  Selecione...
                </option>

                {paymentMethods.map(
                  (method) => (
                    <option
                      key={
                        method.id
                      }
                      value={
                        method.id
                      }
                    >
                      {
                        method.name
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Parcelas">
              <input
                type="number"
                min={1}
                max={120}
                value={
                  installments
                }
                onChange={(
                  event
                ) =>
                  setInstallments(
                    Math.max(
                      1,
                      Number(
                        event.target
                          .value
                      ) ||
                        1
                    )
                  )
                }
                className="input"
              />
            </Field>

            <Field label="Primeiro vencimento">
              <input
                type="date"
                value={
                  firstDueDate
                }
                onChange={(
                  event
                ) =>
                  setFirstDueDate(
                    event.target
                      .value
                  )
                }
                className="input"
                required
              />
            </Field>

            <Field label="Intervalo entre parcelas (dias)">
              <input
                type="number"
                min={1}
                max={365}
                value={intervalDays}
                onChange={(event) =>
                  setIntervalDays(
                    Math.max(
                      1,
                      Number(
                        event.target.value
                      ) || 30
                    )
                  )
                }
                className="input"
              />
            </Field>
          </div>

          {numericValueForSchedule > 0 &&
            schedule.length > 0 && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Parcelas — datas e valores
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Ajuste a data ou o valor de qualquer parcela.
                    </p>
                  </div>

                  <p
                    className={`text-sm font-semibold ${
                      scheduleBalanced
                        ? "text-emerald-700"
                        : "text-red-600"
                    }`}
                  >
                    Soma:{" "}
                    {formatValue(
                      scheduleTotal
                    )}
                  </p>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {schedule.map(
                    (row, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Parcela {index + 1}
                        </p>

                        <label className="mt-2 block text-[11px] font-medium text-slate-400">
                          Vencimento
                          <input
                            type="date"
                            value={row.dueDate}
                            onChange={(event) =>
                              updateScheduleRow(
                                index,
                                "dueDate",
                                event.target.value
                              )
                            }
                            className="input mt-1"
                          />
                        </label>

                        <label className="mt-2 block text-[11px] font-medium text-slate-400">
                          Valor
                          <div className="relative mt-1">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                              R$
                            </span>

                            <input
                              inputMode="decimal"
                              value={row.amount}
                              onChange={(event) =>
                                updateScheduleRow(
                                  index,
                                  "amount",
                                  event.target.value
                                )
                              }
                              className="input mt-0 pl-10"
                            />
                          </div>
                        </label>
                      </div>
                    )
                  )}
                </div>

                {!scheduleBalanced && (
                  <p className="mt-3 text-xs font-medium text-red-600">
                    A soma das parcelas precisa ser {formatValue(numericValueForSchedule)}.
                  </p>
                )}
              </div>
            )}

          <label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={
                autoRenew
              }
              onChange={(
                event
              ) =>
                setAutoRenew(
                  event.target
                    .checked
                )
              }
            />

            <span className="text-sm font-medium text-slate-700">
              Renovação automática
            </span>
          </label>
        </section>

        {/* OBSERVAÇÕES */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <Field label="Observações">
            <textarea
              value={
                notes
              }
              onChange={(
                event
              ) =>
                setNotes(
                  event.target
                    .value
                )
              }
              rows={5}
              className="input min-h-[130px]"
            />
          </Field>
        </section>
      </form>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;

  children:
    React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}

function parseMoney(
  value: string
) {
  return Number(
    value
      .replace(
        /\./g,
        ""
      )
      .replace(
        ",",
        "."
      )
  );
}

function formatValue(
  value: number
) {
  return Number(
    value
  ).toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  );
}