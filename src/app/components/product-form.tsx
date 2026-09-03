"use client";

import {
  FormEvent,
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  BadgePercent,
  Save,
} from "lucide-react";

import {
  createProductRecord,
} from "@/app/(dashboard)/produtos/novo/actions";

import {
  updateProductRecord,
} from "@/app/(dashboard)/produtos/[id]/editar/actions";

type Company = {
  id: string;
  name: string;
};

type ExistingProduct = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  category: string | null;
  type: string;
  defaultPrice: number | null;
  commissionPercentage: number | null;
  billingFrequency: string;
  active: boolean;
};

type Props = {
  companies: Company[];
  product?: ExistingProduct;
};

function moneyToInput(
  value: number | null
) {
  if (value === null) {
    return "";
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ProductForm({
  companies,
  product,
}: Props) {
  const router =
    useRouter();

  const isEdit = Boolean(product);

  const [
    companyId,
    setCompanyId,
  ] =
    useState(
      product?.companyId ??
        companies[0]?.id ??
        ""
    );

  const [
    name,
    setName,
  ] =
    useState(
      product?.name ?? ""
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      product?.description ?? ""
    );

  const [
    category,
    setCategory,
  ] =
    useState(
      product?.category ?? ""
    );

  const [
    type,
    setType,
  ] =
    useState(
      product?.type ?? "service"
    );

  const [
    price,
    setPrice,
  ] =
    useState(
      moneyToInput(
        product?.defaultPrice ?? null
      )
    );

  const [
    commissionPercentage,
    setCommissionPercentage,
  ] =
    useState(
      product?.commissionPercentage !==
        undefined &&
        product?.commissionPercentage !==
          null
        ? String(
            product.commissionPercentage
          ).replace(".", ",")
        : ""
    );

  const [
    billingFrequency,
    setBillingFrequency,
  ] =
    useState(
      product?.billingFrequency ??
        "one_time"
    );

  const [
    active,
    setActive,
  ] =
    useState(
      product?.active ?? true
    );

  const [
    isPending,
    startTransition,
  ] =
    useTransition();

  const [
    error,
    setError,
  ] =
    useState("");

  /*
   * =====================================================
   * SALVAR
   * =====================================================
   */

  function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (
      !companyId
    ) {
      setError(
        "Selecione a empresa."
      );

      return;
    }

    if (
      !name.trim()
    ) {
      setError(
        "Informe o nome do produto ou serviço."
      );

      return;
    }

    const parsedPrice =
      price.trim()
        ? parseMoney(
            price
          )
        : null;

    if (
      parsedPrice !==
        null &&
      (
        !Number.isFinite(
          parsedPrice
        ) ||
        parsedPrice <
          0
      )
    ) {
      setError(
        "Informe um valor padrão válido."
      );

      return;
    }

    /*
     * Comissão vazia = null.
     *
     * Isso significa:
     * usar comissão padrão
     * do vendedor.
     *
     * Comissão 0 = produto
     * explicitamente sem comissão.
     */

    const parsedCommission =
      commissionPercentage
        .trim() ===
      ""
        ? null
        : parsePercentage(
            commissionPercentage
          );

    if (
      parsedCommission !==
        null &&
      (
        !Number.isFinite(
          parsedCommission
        ) ||
        parsedCommission <
          0 ||
        parsedCommission >
          100
      )
    ) {
      setError(
        "Informe uma comissão válida entre 0% e 100%."
      );

      return;
    }

    startTransition(
      async () => {
        const result =
          isEdit && product
            ? await updateProductRecord({
                productId:
                  product.id,

                companyId,

                name: name.trim(),

                description:
                  description.trim() ||
                  null,

                category:
                  category.trim() ||
                  null,

                type,

                defaultPrice:
                  parsedPrice,

                commissionPercentage:
                  parsedCommission,

                billingFrequency,

                active,
              })
            : await createProductRecord({
                companyId,

                name: name.trim(),

                description:
                  description.trim() ||
                  null,

                category:
                  category.trim() ||
                  null,

                type,

                defaultPrice:
                  parsedPrice,

                commissionPercentage:
                  parsedCommission,

                billingFrequency,
              });

        if (
          !result.success
        ) {
          setError(
            result.error
          );

          return;
        }

        router.push(
          "/produtos"
        );

        router.refresh();
      }
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <form
        onSubmit={
          handleSubmit
        }
        className="mx-auto max-w-4xl"
      >

        {/* VOLTAR */}

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

        {/* CABEÇALHO */}

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {isEdit
                ? "Editar produto ou serviço"
                : "Novo produto ou serviço"}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {isEdit
                ? "Atualize os dados do produto ou serviço."
                : "Cadastre o que será comercializado por uma das empresas do Grupo Pulso."}
            </p>
          </div>

          <button
            type="submit"
            disabled={
              isPending
            }
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />

            {isPending
              ? "Salvando..."
              : "Salvar"}
          </button>
        </div>

        {/* ERRO */}

        {error && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {
              error
            }
          </div>
        )}

        {/* DADOS */}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* EMPRESA */}

            <Field label="Empresa">
              <select
                value={
                  companyId
                }
                onChange={(
                  event
                ) =>
                  setCompanyId(
                    event.target
                      .value
                  )
                }
                required
                className="input"
              >
                {companies.map(
                  (
                    company
                  ) => (
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

            {/* NOME */}

            <Field label="Nome">
              <input
                value={
                  name
                }
                onChange={(
                  event
                ) =>
                  setName(
                    event.target
                      .value
                  )
                }
                required
                placeholder="Ex.: Anúncio página inteira"
                className="input"
              />
            </Field>

            {/* CATEGORIA */}

            <Field label="Categoria">
              <input
                value={
                  category
                }
                onChange={(
                  event
                ) =>
                  setCategory(
                    event.target
                      .value
                  )
                }
                placeholder="Ex.: Publicidade, Assinaturas..."
                className="input"
              />
            </Field>

            {/* TIPO */}

            <Field label="Tipo">
              <select
                value={
                  type
                }
                onChange={(
                  event
                ) =>
                  setType(
                    event.target
                      .value
                  )
                }
                className="input"
              >
                <option value="product">
                  Produto
                </option>

                <option value="service">
                  Serviço
                </option>

                <option value="subscription">
                  Assinatura
                </option>

                <option value="advertising">
                  Publicidade
                </option>

                <option value="other">
                  Outro
                </option>
              </select>
            </Field>

            {/* VALOR */}

            <Field label="Valor padrão">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  R$
                </span>

                <input
                  value={
                    price
                  }
                  onChange={(
                    event
                  ) =>
                    setPrice(
                      event.target
                        .value
                    )
                  }
                  inputMode="decimal"
                  placeholder="190,00"
                  className="input pl-10"
                />
              </div>
            </Field>

            {/* COMISSÃO */}

            <Field label="Comissão do produto">
              <div className="relative">
                <BadgePercent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={
                    commissionPercentage
                  }
                  onChange={(
                    event
                  ) =>
                    setCommissionPercentage(
                      event.target
                        .value
                    )
                  }
                  inputMode="decimal"
                  placeholder="Ex.: 10"
                  className="input pl-10 pr-10"
                />

                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  %
                </span>
              </div>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Deixe vazio para usar a comissão padrão do vendedor. Informe 0% para este produto não gerar comissão.
              </p>
            </Field>

            {/* COBRANÇA */}

            <Field label="Forma de cobrança">
              <select
                value={
                  billingFrequency
                }
                onChange={(
                  event
                ) =>
                  setBillingFrequency(
                    event.target
                      .value
                  )
                }
                className="input"
              >
                <option value="one_time">
                  Único
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

          {/* DESCRIÇÃO */}

          <div className="mt-5">
            <Field label="Descrição">
              <textarea
                value={
                  description
                }
                onChange={(
                  event
                ) =>
                  setDescription(
                    event.target
                      .value
                  )
                }
                rows={
                  5
                }
                placeholder="Descreva o produto ou serviço..."
                className="input min-h-[130px] resize-none"
              />
            </Field>
          </div>

          {isEdit && (
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) =>
                  setActive(
                    event.target.checked
                  )
                }
                className="mt-1 h-4 w-4"
              />

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Produto ativo
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Produtos inativos não aparecem para seleção em novas vendas e contratos.
                </p>
              </div>
            </label>
          )}
        </section>

        {/* EXPLICAÇÃO DA COMISSÃO */}

        <section className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700">
              <BadgePercent className="h-4 w-4" />
            </div>

            <div>
              <p className="text-sm font-semibold text-blue-900">
                Regra de comissão
              </p>

              <p className="mt-1 text-sm leading-6 text-blue-700">
                Quando este produto possuir uma comissão configurada, esse percentual poderá ser usado na venda ou contrato no lugar da comissão padrão do vendedor.
              </p>
            </div>
          </div>
        </section>
      </form>
    </main>
  );
}

/*
 * =====================================================
 * FIELD
 * =====================================================
 */

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
        {
          label
        }
      </span>

      {
        children
      }
    </label>
  );
}

/*
 * =====================================================
 * DINHEIRO
 * =====================================================
 */

function parseMoney(
  value: string
) {
  const clean =
    value
      .trim()
      .replace(
        /\s/g,
        ""
      );

  if (
    !clean
  ) {
    return 0;
  }

  if (
    clean.includes(
      ","
    )
  ) {
    return Number(
      clean
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

  return Number(
    clean
  );
}

/*
 * =====================================================
 * PERCENTUAL
 * =====================================================
 */

function parsePercentage(
  value: string
) {
  const clean =
    value
      .trim()
      .replace(
        "%",
        ""
      )
      .replace(
        /\s/g,
        ""
      )
      .replace(
        ",",
        "."
      );

  return Number(
    clean
  );
}