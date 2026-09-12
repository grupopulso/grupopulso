"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Save,
} from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/app/lib/supabase/client";

type Client = {
  id: string;
  name: string;
};

type Supplier = {
  id: string;
  name: string;
};

type Company = {
  id: string;
  name: string;
};

type Contract = {
  id: string;
  client_id: string;
  company_id: string;
  product_id: string | null;
  title: string;
  value: number;
};

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "both";
};

type CostCenter = {
  id: string;
  company_id: string | null;
  name: string;
};

type FinancialAccount = {
  id: string;
  company_id: string | null;
  name: string;
};

type PaymentMethod = {
  id: string;
  name: string;
  usage_type: "income" | "expense" | "both";
  active: boolean;
};

type FinancialEntryFormProps = {
  initialClientId?: string;

  /*
   * Naturezas que o usuário pode lançar. Um usuário que só
   * cuida de contas a receber recebe canExpense={false} e o
   * seletor de tipo fica travado em "Receita".
   */
  canIncome?: boolean;
  canExpense?: boolean;
};

export default function FinancialEntryForm({
  initialClientId = "",
  canIncome = true,
  canExpense = true,
}: FinancialEntryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = createClient();

  const bothTypes = canIncome && canExpense;

  const initialType: "income" | "expense" =
    !canIncome
      ? "expense"
      : !canExpense
        ? "income"
        : searchParams.get("tipo") === "expense"
          ? "expense"
          : "income";

  const [entryType, setEntryType] =
    useState<"income" | "expense">(initialType);

  const [clients, setClients] =
    useState<Client[]>([]);

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [companies, setCompanies] =
    useState<Company[]>([]);

  const [contracts, setContracts] =
    useState<Contract[]>([]);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [costCenters, setCostCenters] =
    useState<CostCenter[]>([]);

  const [financialAccounts, setFinancialAccounts] =
    useState<FinancialAccount[]>([]);

  const [paymentMethods, setPaymentMethods] =
    useState<PaymentMethod[]>([]);

  const [companyIds, setCompanyIds] =
    useState<string[]>([]);

  const [companyPercentages, setCompanyPercentages] =
    useState<Record<string, string>>({});

  const [
  clientId,
  setClientId,
] = useState(
  initialClientId
);
  const [supplierId, setSupplierId] =
    useState("");

  const [contractId, setContractId] =
    useState("");

  const [categoryId, setCategoryId] =
    useState("");

  const [costCenterId, setCostCenterId] =
    useState("");

  const [
    financialAccountId,
    setFinancialAccountId,
  ] = useState("");

  const [paymentMethodId, setPaymentMethodId] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [documentNumber, setDocumentNumber] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [issueDate, setIssueDate] =
    useState(today());

  const [competenceDate, setCompetenceDate] =
    useState(today());

  const [dueDate, setDueDate] =
    useState("");

  const [interest, setInterest] =
    useState("0");

  const [fine, setFine] =
    useState("0");

  const [discount, setDiscount] =
    useState("0");

  const [recurring, setRecurring] =
    useState(false);

  const [
    recurrenceFrequency,
    setRecurrenceFrequency,
  ] = useState("monthly");

  const [notes, setNotes] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadData() {
      const [
        clientsResult,
        suppliersResult,
        companiesResult,
        contractsResult,
        categoriesResult,
        costCentersResult,
        accountsResult,
        paymentMethodsResult,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name")
          .eq("active", true)
          .order("name"),

        supabase
          .from("suppliers")
          .select("id, name")
          .eq("active", true)
          .order("name"),

        supabase
          .from("companies")
          .select("id, name")
          .eq("active", true)
          .order("name"),

        supabase
          .from("contracts")
          .select(`
            id,
            client_id,
            company_id,
            product_id,
            title,
            value
          `)
          .neq("status", "cancelled")
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("financial_categories")
          .select("id, name, type")
          .eq("active", true)
          .order("name"),

        supabase
          .from("cost_centers")
          .select("id, company_id, name")
          .eq("active", true)
          .order("name"),

        supabase
          .from("financial_accounts")
          .select("id, company_id, name")
          .eq("active", true)
          .order("name"),

        supabase
          .from("financial_payment_methods")
          .select("id, name, usage_type, active")
          .eq("active", true)
          .order("name"),
      ]);

      setClients(clientsResult.data ?? []);
      setSuppliers(suppliersResult.data ?? []);
      setCompanies(companiesResult.data ?? []);
      setContracts(contractsResult.data ?? []);
      setCategories(categoriesResult.data ?? []);
      setCostCenters(costCentersResult.data ?? []);
      setFinancialAccounts(accountsResult.data ?? []);
      setPaymentMethods(paymentMethodsResult.data ?? []);

      if (companiesResult.data?.length) {
        const firstCompanyId =
          companiesResult.data[0].id;

        setCompanyIds([firstCompanyId]);
        setCompanyPercentages({
          [firstCompanyId]: "100",
        });
      }
    }

    loadData();
  }, [supabase]);

  const availableContracts = useMemo(() => {
    return contracts.filter(
      (contract) =>
        companyIds.includes(contract.company_id)
    );
  }, [contracts, companyIds]);

  const availableCategories = useMemo(() => {
    return categories.filter(
      (category) =>
        category.type === entryType ||
        category.type === "both"
    );
  }, [categories, entryType]);

  const availableCostCenters = useMemo(() => {
    return costCenters.filter(
      (center) =>
        !center.company_id ||
        companyIds.includes(center.company_id)
    );
  }, [costCenters, companyIds]);

  const availableAccounts = useMemo(() => {
    return financialAccounts.filter(
      (account) =>
        !account.company_id ||
        companyIds.includes(account.company_id)
    );
  }, [financialAccounts, companyIds]);

  const availablePaymentMethods = useMemo(() => {
    return paymentMethods.filter(
      (method) =>
        method.usage_type === entryType ||
        method.usage_type === "both"
    );
  }, [paymentMethods, entryType]);

  const percentagesTotal = useMemo(() => {
    return companyIds.reduce(
      (sum, id) =>
        sum +
        parsePercentage(
          companyPercentages[id] ?? "0"
        ),
      0
    );
  }, [companyIds, companyPercentages]);

  useEffect(() => {
    setCategoryId("");
  }, [entryType]);

  useEffect(() => {
    if (
      paymentMethodId &&
      !availablePaymentMethods.some(
        (method) => method.id === paymentMethodId
      )
    ) {
      setPaymentMethodId("");
    }
  }, [availablePaymentMethods, paymentMethodId]);

  useEffect(() => {
    if (
      contractId &&
      !availableContracts.some(
        (contract) =>
          contract.id === contractId
      )
    ) {
      setContractId("");
    }
  }, [
    availableContracts,
    contractId,
  ]);

  useEffect(() => {
    /*
     * Contrato pertence a uma única empresa - com mais de uma
     * empresa selecionada não há como manter o vínculo.
     */
    if (companyIds.length > 1 && contractId) {
      setContractId("");
    }
  }, [companyIds, contractId]);

  function toggleCompany(id: string) {
    setCompanyIds((current) => {
      const next = current.includes(id)
        ? current.filter(
            (companyId) => companyId !== id
          )
        : [...current, id];

      /*
       * Ao mudar a seleção, reparte 100% igualmente entre as
       * empresas escolhidas - o usuário pode ajustar o % de
       * cada uma depois.
       */
      const equalShare = next.length
        ? Number((100 / next.length).toFixed(2))
        : 0;

      const nextPercentages: Record<string, string> = {};

      next.forEach((companyId) => {
        nextPercentages[companyId] =
          String(equalShare);
      });

      setCompanyPercentages(nextPercentages);

      return next;
    });
  }

  function handlePercentageChange(
    id: string,
    value: string
  ) {
    setCompanyPercentages((current) => ({
      ...current,
      [id]: value,
    }));
  }

  function handleTypeChange(
    type: "income" | "expense"
  ) {
    if (type === "income" && !canIncome) return;
    if (type === "expense" && !canExpense) return;

    setEntryType(type);

    setClientId("");
    setSupplierId("");
    setContractId("");
  }

  function handleContractChange(
    id: string
  ) {
    setContractId(id);

    const contract =
      contracts.find(
        (item) => item.id === id
      );

    if (!contract) {
      return;
    }

    setClientId(
      contract.client_id
    );

    setCompanyIds([
      contract.company_id,
    ]);

    setCompanyPercentages({
      [contract.company_id]: "100",
    });

    setDescription(
      contract.title
    );

    setAmount(
      formatValueForInput(
        contract.value
      )
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (
      (entryType === "income" && !canIncome) ||
      (entryType === "expense" && !canExpense)
    ) {
      setError(
        "Seu acesso não permite lançar esse tipo de movimentação."
      );
      return;
    }

    if (!companyIds.length) {
      setError(
        "Selecione ao menos uma empresa."
      );
      return;
    }

    if (!description.trim()) {
      setError(
        "Informe a descrição do lançamento."
      );
      return;
    }

    if (!dueDate) {
      setError(
        "Informe a data de vencimento."
      );
      return;
    }

    if (
      entryType === "income" &&
      !clientId
    ) {
      setError(
        "Selecione o cliente da receita."
      );
      return;
    }

    if (
      entryType === "expense" &&
      !supplierId
    ) {
      setError(
        "Selecione o fornecedor da despesa."
      );
      return;
    }

    const numericAmount =
      parseMoney(amount);

    const numericInterest =
      parseMoney(interest);

    const numericFine =
      parseMoney(fine);

    const numericDiscount =
      parseMoney(discount);

    if (
      Number.isNaN(numericAmount) ||
      numericAmount <= 0
    ) {
      setError(
        "Informe um valor válido."
      );
      return;
    }

    const companyShares = companyIds.map(
      (id) =>
        parsePercentage(
          companyPercentages[id] ?? "0"
        )
    );

    if (companyIds.length > 1) {
      const percentagesSum = companyShares.reduce(
        (sum, percentage) => sum + percentage,
        0
      );

      if (
        Math.abs(percentagesSum - 100) > 0.01
      ) {
        setError(
          "As porcentagens das empresas devem somar 100%."
        );
        return;
      }
    }

    setLoading(true);

    const selectedContract =
      contracts.find(
        (contract) =>
          contract.id === contractId
      );

    /*
     * Com mais de uma empresa selecionada, o valor total é
     * dividido conforme o % de cada uma e um lançamento é
     * criado por empresa (cada uma com sua própria RLS/escopo).
     */
    const amountShares =
      companyIds.length === 1
        ? [numericAmount]
        : splitAmountByPercentage(
            numericAmount,
            companyShares
          );

    const interestShares =
      companyIds.length === 1
        ? [numericInterest]
        : splitAmountByPercentage(
            numericInterest,
            companyShares
          );

    const fineShares =
      companyIds.length === 1
        ? [numericFine]
        : splitAmountByPercentage(
            numericFine,
            companyShares
          );

    const discountShares =
      companyIds.length === 1
        ? [numericDiscount]
        : splitAmountByPercentage(
            numericDiscount,
            companyShares
          );

    const entriesToInsert =
      companyIds.map(
        (companyId, index) => ({
          company_id: companyId,

          type: entryType,

          client_id:
            entryType === "income"
              ? clientId || null
              : null,

          supplier_id:
            entryType === "expense"
              ? supplierId || null
              : null,

          contract_id:
            entryType === "income" &&
            companyIds.length === 1
              ? contractId || null
              : null,

          product_id:
            entryType === "income" &&
            companyIds.length === 1
              ? selectedContract?.product_id ??
                null
              : null,

          category_id:
            categoryId || null,

          cost_center_id:
            costCenterId || null,

          financial_account_id:
            financialAccountId || null,

          ...(paymentMethodId
            ? { payment_method_id: paymentMethodId }
            : {}),

          description:
            description.trim(),

          document_number:
            documentNumber || null,

          issue_date:
            issueDate,

          competence_date:
            competenceDate || null,

          due_date:
            dueDate,

          amount:
            amountShares[index],

          amount_paid: 0,

          interest:
            interestShares[index],

          fine:
            fineShares[index],

          discount:
            discountShares[index],

          status:
            "pending",

          recurring,

          recurrence_frequency:
            recurring
              ? recurrenceFrequency
              : null,

          notes:
            notes || null,
        })
      );

    const { error: insertError } =
      await supabase
        .from("financial_entries")
        .insert(entriesToInsert);

    if (insertError) {
      setError(
        insertError.message
      );

      setLoading(false);
      return;
    }

    router.push("/financeiro");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-6xl"
      >
        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Novo lançamento financeiro
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Registre uma receita ou despesa do Grupo Pulso.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />

            {loading
              ? "Salvando..."
              : "Salvar lançamento"}
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* TIPO */}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Tipo de movimentação
          </h2>

          {bothTypes ? (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  handleTypeChange(
                    "income"
                  )
                }
                className={`rounded-2xl border p-5 text-left transition ${
                  entryType === "income"
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p
                  className={`font-semibold ${
                    entryType === "income"
                      ? "text-emerald-700"
                      : "text-slate-800"
                  }`}
                >
                  Receita
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Valores que a empresa tem a receber.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleTypeChange(
                    "expense"
                  )
                }
                className={`rounded-2xl border p-5 text-left transition ${
                  entryType === "expense"
                    ? "border-red-300 bg-red-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p
                  className={`font-semibold ${
                    entryType === "expense"
                      ? "text-red-700"
                      : "text-slate-800"
                  }`}
                >
                  Despesa
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Valores que a empresa tem a pagar.
                </p>
              </button>
            </div>
          ) : (
            <div
              className={`mt-5 rounded-2xl border p-5 ${
                entryType === "income"
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-red-300 bg-red-50"
              }`}
            >
              <p
                className={`font-semibold ${
                  entryType === "income"
                    ? "text-emerald-700"
                    : "text-red-700"
                }`}
              >
                {entryType === "income"
                  ? "Receita"
                  : "Despesa"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {entryType === "income"
                  ? "Valores que a empresa tem a receber."
                  : "Valores que a empresa tem a pagar."}{" "}
                Seu acesso permite lançar apenas{" "}
                {entryType === "income"
                  ? "receitas"
                  : "despesas"}
                .
              </p>
            </div>
          )}
        </section>

        {/* ORIGEM */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Informações do lançamento
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Empresa(s)
              </span>

              <div className="flex flex-wrap gap-2">
                {companies.map(
                  (company) => {
                    const selected =
                      companyIds.includes(
                        company.id
                      );

                    return (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() =>
                          toggleCompany(
                            company.id
                          )
                        }
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          selected
                            ? "border-[#15704f] bg-[#15704f]/10 text-[#15704f]"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {company.name}
                      </button>
                    );
                  }
                )}
              </div>

              {companyIds.length > 1 && (
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      % de cada empresa
                    </p>

                    <p
                      className={`text-xs font-semibold ${
                        Math.abs(
                          percentagesTotal - 100
                        ) < 0.01
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      Total: {percentagesTotal.toLocaleString(
                        "pt-BR",
                        {
                          maximumFractionDigits: 2,
                        }
                      )}%
                    </p>
                  </div>

                  <div className="space-y-2">
                    {companyIds.map((id) => {
                      const company = companies.find(
                        (item) => item.id === id
                      );

                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3"
                        >
                          <span className="flex-1 text-sm text-slate-600">
                            {company?.name ??
                              "Empresa"}
                          </span>

                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={
                                companyPercentages[
                                  id
                                ] ?? ""
                              }
                              onChange={(event) =>
                                handlePercentageChange(
                                  id,
                                  event.target
                                    .value
                                )
                              }
                              className="input h-9 w-20 text-right"
                            />

                            <span className="text-sm text-slate-400">
                              %
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {entryType === "income" ? (
              <Field label="Cliente">
                <select
                  value={clientId}
                  onChange={(event) =>
                    setClientId(
                      event.target.value
                    )
                  }
                  required
                  className="input"
                >
                  <option value="">
                    Selecione...
                  </option>

                  {clients.map(
                    (client) => (
                      <option
                        key={client.id}
                        value={client.id}
                      >
                        {client.name}
                      </option>
                    )
                  )}
                </select>
              </Field>
            ) : (
              <Field label="Fornecedor">
                <select
                  value={supplierId}
                  onChange={(event) =>
                    setSupplierId(
                      event.target.value
                    )
                  }
                  required
                  className="input"
                >
                  <option value="">
                    Selecione...
                  </option>

                  {suppliers.map(
                    (supplier) => (
                      <option
                        key={supplier.id}
                        value={supplier.id}
                      >
                        {supplier.name}
                      </option>
                    )
                  )}
                </select>
              </Field>
            )}

            {entryType === "income" &&
              companyIds.length === 1 && (
                <Field label="Contrato">
                  <select
                    value={contractId}
                    onChange={(event) =>
                      handleContractChange(
                        event.target.value
                      )
                    }
                    className="input"
                  >
                    <option value="">
                      Sem contrato
                    </option>

                    {availableContracts.map(
                      (contract) => (
                        <option
                          key={contract.id}
                          value={contract.id}
                        >
                          {contract.title}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              )}

            <Field label="Categoria">
              <select
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(
                    event.target.value
                  )
                }
                className="input"
              >
                <option value="">
                  Sem categoria
                </option>

                {availableCategories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Centro de custo">
              <select
                value={costCenterId}
                onChange={(event) =>
                  setCostCenterId(
                    event.target.value
                  )
                }
                className="input"
              >
                <option value="">
                  Sem centro de custo
                </option>

                {availableCostCenters.map(
                  (center) => (
                    <option
                      key={center.id}
                      value={center.id}
                    >
                      {center.name}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Conta / Caixa">
              <select
                value={
                  financialAccountId
                }
                onChange={(event) =>
                  setFinancialAccountId(
                    event.target.value
                  )
                }
                className="input"
              >
                <option value="">
                  Não definida
                </option>

                {availableAccounts.map(
                  (account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.name}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Forma de pagamento (prevista)">
              <select
                value={paymentMethodId}
                onChange={(event) =>
                  setPaymentMethodId(
                    event.target.value
                  )
                }
                className="input"
              >
                <option value="">
                  Não definida
                </option>

                {availablePaymentMethods.map(
                  (method) => (
                    <option
                      key={method.id}
                      value={method.id}
                    >
                      {method.name}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Descrição">
              <input
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                required
                className="input"
              />
            </Field>

            <Field label="Nº documento">
              <input
                value={documentNumber}
                onChange={(event) =>
                  setDocumentNumber(
                    event.target.value
                  )
                }
                placeholder="NF, recibo, boleto..."
                className="input"
              />
            </Field>
          </div>
        </section>

        {/* VALORES */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Valores
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Valor principal">
              <input
                value={amount}
                onChange={(event) =>
                  setAmount(
                    event.target.value
                  )
                }
                placeholder="0,00"
                required
                className="input"
              />
            </Field>

            <Field label="Juros">
              <input
                value={interest}
                onChange={(event) =>
                  setInterest(
                    event.target.value
                  )
                }
                placeholder="0,00"
                className="input"
              />
            </Field>

            <Field label="Multa">
              <input
                value={fine}
                onChange={(event) =>
                  setFine(
                    event.target.value
                  )
                }
                placeholder="0,00"
                className="input"
              />
            </Field>

            <Field label="Desconto">
              <input
                value={discount}
                onChange={(event) =>
                  setDiscount(
                    event.target.value
                  )
                }
                placeholder="0,00"
                className="input"
              />
            </Field>
          </div>

          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Valor final
            </p>

            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatCurrency(
                Math.max(
                  parseMoney(amount) +
                    parseMoney(interest) +
                    parseMoney(fine) -
                    parseMoney(discount),
                  0
                )
              )}
            </p>
          </div>

          {companyIds.length > 1 && (
            <div className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Divisão por empresa
              </p>

              {splitAmountByPercentage(
                Math.max(
                  parseMoney(amount) +
                    parseMoney(interest) +
                    parseMoney(fine) -
                    parseMoney(discount),
                  0
                ),
                companyIds.map((id) =>
                  parsePercentage(
                    companyPercentages[id] ?? "0"
                  )
                )
              ).map((share, index) => {
                const company = companies.find(
                  (item) =>
                    item.id === companyIds[index]
                );

                return (
                  <div
                    key={companyIds[index]}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-600">
                      {company?.name ?? "Empresa"}{" "}
                      <span className="text-slate-400">
                        (
                        {companyPercentages[
                          companyIds[index]
                        ] ?? "0"}
                        %)
                      </span>
                    </span>

                    <span className="font-semibold text-slate-800">
                      {formatCurrency(share)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* DATAS */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Datas
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
            <Field label="Emissão">
              <input
                type="date"
                value={issueDate}
                onChange={(event) =>
                  setIssueDate(
                    event.target.value
                  )
                }
                required
                className="input"
              />
            </Field>

            <Field label="Competência">
              <input
                type="date"
                value={competenceDate}
                onChange={(event) =>
                  setCompetenceDate(
                    event.target.value
                  )
                }
                className="input"
              />
            </Field>

            <Field label="Vencimento">
              <input
                type="date"
                value={dueDate}
                onChange={(event) =>
                  setDueDate(
                    event.target.value
                  )
                }
                required
                className="input"
              />
            </Field>
          </div>
        </section>

        {/* RECORRÊNCIA */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(event) =>
                setRecurring(
                  event.target.checked
                )
              }
              className="mt-1 h-4 w-4"
            />

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Lançamento recorrente
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Utilize para aluguel, mensalidades, softwares, contratos recorrentes e outras movimentações periódicas.
              </p>
            </div>
          </label>

          {recurring && (
            <div className="mt-5 max-w-sm">
              <Field label="Periodicidade">
                <select
                  value={
                    recurrenceFrequency
                  }
                  onChange={(event) =>
                    setRecurrenceFrequency(
                      event.target.value
                    )
                  }
                  className="input"
                >
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
                    Personalizada
                  </option>
                </select>
              </Field>
            </div>
          )}
        </section>

        {/* OBSERVAÇÕES */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <Field label="Observações">
            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
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
  children: React.ReactNode;
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
  if (!value.trim()) {
    return 0;
  }

  const parsed = Number(
    value
      .replace(/\./g, "")
      .replace(",", ".")
  );

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function parsePercentage(
  value: string
) {
  const parsed = Number(
    value.replace(",", ".")
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function splitAmountByPercentage(
  total: number,
  percentages: number[]
) {
  if (percentages.length <= 1) {
    return [total];
  }

  const totalCents = Math.round(
    total * 100
  );

  const rawShares = percentages.map(
    (percentage) =>
      (totalCents * percentage) / 100
  );

  const baseCents = rawShares.map(
    (share) => Math.floor(share)
  );

  const distributedCents = baseCents.reduce(
    (sum, cents) => sum + cents,
    0
  );

  let remainder =
    totalCents - distributedCents;

  /*
   * Método dos maiores restos: sobra de centavos (por
   * arredondamento) vai para quem tem a maior parte
   * fracionária, mantendo a soma exata do total.
   */
  const order = rawShares
    .map((share, index) => ({
      index,
      fraction: share - baseCents[index],
    }))
    .sort(
      (a, b) => b.fraction - a.fraction
    );

  const finalCents = [...baseCents];

  for (
    let i = 0;
    i < order.length && remainder > 0;
    i += 1
  ) {
    finalCents[order[i].index] += 1;
    remainder -= 1;
  }

  return finalCents.map(
    (cents) => cents / 100
  );
}

function formatValueForInput(
  value: number
) {
  return Number(value).toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
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
  ).format(value);
}

function today() {
  const date = new Date();

  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}