"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  BadgePercent,
  CreditCard,
  FilePlus2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  updateEditionSale,
} from "../../actions";

type Client = {
  id: string;
  name: string;
};

type Seller = {
  id: string;
  full_name: string | null;
  email: string | null;
  commissionPercentage: number;
};

type Section = {
  id: string;
  name: string;
  description: string | null;
};

type PaymentMethod = {
  id: string;
  name: string;
  code: string;
};

type PrintType =
  | "color"
  | "black_white"
  | "other"
  | "";

type SaleItem = {
  localId: string;

  databaseId:
    | string
    | null;

  sectionId: string;

  description: string;

  placement: string;

  printType:
    PrintType;

  quantity: number;

  unitPrice: string;

  notes: string;
};

type Props = {
  sale: {
    id: string;

    editionId: string;

    clientId: string;

    sellerUserId: string;

    paymentMethodId:
      string;

    installments:
      number;

    firstDueDate:
      string;

    notes:
      string;

    items: {
      id: string;

      sectionId:
        string;

      description:
        string;

      placement:
        string;

      printType:
        string;

      quantity:
        number;

      unitPrice:
        number;

      notes:
        string;
    }[];
  };

  clients: Client[];

  sellers: Seller[];

  sections: Section[];

  paymentMethods:
    PaymentMethod[];

  sellerLocked:
    boolean;

  financialLocked:
    boolean;
};

function createEmptyItem(): SaleItem {
  return {
    localId:
      crypto.randomUUID(),

    databaseId:
      null,

    sectionId:
      "",

    description:
      "",

    placement:
      "",

    printType:
      "",

    quantity:
      1,

    unitPrice:
      "",

    notes:
      "",
  };
}

export default function EditSaleForm({
  sale,
  clients,
  sellers,
  sections,
  paymentMethods,
  sellerLocked,
  financialLocked,
}: Props) {
  const router =
    useRouter();

  const [
    clientId,
    setClientId,
  ] =
    useState(
      sale.clientId
    );

  const [
    sellerUserId,
    setSellerUserId,
  ] =
    useState(
      sale.sellerUserId
    );

  const [
    paymentMethodId,
    setPaymentMethodId,
  ] =
    useState(
      sale.paymentMethodId
    );

  const [
    installments,
    setInstallments,
  ] =
    useState(
      sale.installments
    );

  const [
    firstDueDate,
    setFirstDueDate,
  ] =
    useState(
      sale.firstDueDate
    );

  const [
    notes,
    setNotes,
  ] =
    useState(
      sale.notes
    );

  const [
    items,
    setItems,
  ] =
    useState<
      SaleItem[]
    >(
      sale.items.length
        ? sale.items.map(
            (
              item
            ) => ({
              localId:
                crypto.randomUUID(),

              databaseId:
                item.id,

              sectionId:
                item.sectionId,

              description:
                item.description,

              placement:
                item.placement,

              printType:
                item.printType as PrintType,

              quantity:
                item.quantity,

              unitPrice:
                formatEditableMoney(
                  item.unitPrice
                ),

              notes:
                item.notes,
            })
          )
        : [
            createEmptyItem(),
          ]
    );

  const [
    message,
    setMessage,
  ] =
    useState<{
      type:
        | "success"
        | "error";

      text: string;
    } | null>(
      null
    );

  const [
    isPending,
    startTransition,
  ] =
    useTransition();

  const selectedSeller =
    sellers.find(
      (
        seller
      ) =>
        seller.id ===
        sellerUserId
    );

  const commissionPercentage =
    selectedSeller
      ?.commissionPercentage ??
    0;

  const subtotal =
    useMemo(
      () =>
        roundMoney(
          items.reduce(
            (
              total,
              item
            ) =>
              total +
              getItemTotal(
                item
              ),
            0
          )
        ),
      [
        items,
      ]
    );

  const commissionAmount =
    useMemo(
      () =>
        roundMoney(
          subtotal *
            (
              commissionPercentage /
              100
            )
        ),
      [
        subtotal,
        commissionPercentage,
      ]
    );

  const installmentPreview =
    useMemo(
      () =>
        buildInstallments(
          subtotal,
          installments
        ),
      [
        subtotal,
        installments,
      ]
    );

  function updateItem(
    localId: string,
    field:
      keyof SaleItem,
    value:
      string | number
  ) {
    setItems(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.localId ===
            localId
              ? {
                  ...item,
                  [field]:
                    value,
                }
              : item
        )
    );
  }

  function addItem() {
    if (
      financialLocked
    ) {
      return;
    }

    setItems(
      (
        current
      ) => [
        ...current,
        createEmptyItem(),
      ]
    );
  }

  function removeItem(
    localId: string
  ) {
    if (
      financialLocked
    ) {
      return;
    }

    if (
      items.length ===
      1
    ) {
      setMessage({
        type:
          "error",

        text:
          "A venda precisa ter pelo menos um anúncio.",
      });

      return;
    }

    setItems(
      (
        current
      ) =>
        current.filter(
          (
            item
          ) =>
            item.localId !==
            localId
        )
    );
  }

  function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage(
      null
    );

    if (
      financialLocked
    ) {
      setMessage({
        type:
          "error",

        text:
          "Esta venda possui recebimentos e não pode ter seus dados financeiros alterados.",
      });

      return;
    }

    if (
      !clientId
    ) {
      setMessage({
        type:
          "error",

        text:
          "Selecione o cliente.",
      });

      return;
    }

    if (
      !sellerUserId
    ) {
      setMessage({
        type:
          "error",

        text:
          "Selecione o vendedor.",
      });

      return;
    }

    if (
      !paymentMethodId
    ) {
      setMessage({
        type:
          "error",

        text:
          "Selecione a forma de pagamento.",
      });

      return;
    }

    if (
      installments <
      1
    ) {
      setMessage({
        type:
          "error",

        text:
          "Informe uma quantidade válida de parcelas.",
      });

      return;
    }

    if (
      !firstDueDate
    ) {
      setMessage({
        type:
          "error",

        text:
          "Informe o primeiro vencimento.",
      });

      return;
    }

    for (
      let index = 0;
      index <
      items.length;
      index++
    ) {
      const item =
        items[index];

      if (
        !item.description
          .trim()
      ) {
        setMessage({
          type:
            "error",

          text:
            `Informe a descrição do anúncio ${index + 1}.`,
        });

        return;
      }

      if (
        parseMoney(
          item.unitPrice
        ) <= 0
      ) {
        setMessage({
          type:
            "error",

          text:
            `Informe um valor válido no anúncio ${index + 1}.`,
        });

        return;
      }
    }

    startTransition(
      async () => {
        const result =
          await updateEditionSale({
            saleId:
              sale.id,

            editionId:
              sale.editionId,

            clientId,

            sellerUserId,

            paymentMethodId,

            installments,

            firstDueDate,

            notes:
              notes.trim() ||
              null,

            items:
              items.map(
                (
                  item
                ) => ({
                  sectionId:
                    item.sectionId ||
                    null,

                  description:
                    item.description.trim(),

                  placement:
                    item.placement.trim() ||
                    null,

                  printType:
                    item.printType ||
                    null,

                  quantity:
                    item.quantity,

                  unitPrice:
                    parseMoney(
                      item.unitPrice
                    ),

                  notes:
                    item.notes.trim() ||
                    null,
                })
              ),
          });

        if (
          !result.success
        ) {
          setMessage({
            type:
              "error",

            text:
              result.message ??
              "Não foi possível editar a venda.",
          });

          return;
        }

        router.push(
          `/edicoes/${sale.editionId}/vendas/${sale.id}`
        );

        router.refresh();
      }
    );
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="mt-8"
    >
      {/* DADOS */}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">
          Dados da venda
        </h2>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Cliente
            </label>

            <select
              value={
                clientId
              }
              disabled={
                financialLocked
              }
              onChange={(
                event
              ) =>
                setClientId(
                  event.target
                    .value
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
            >
              {clients.map(
                (
                  client
                ) => (
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
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Vendedor
            </label>

            <select
              value={
                sellerUserId
              }
              disabled={
                sellerLocked ||
                financialLocked
              }
              onChange={(
                event
              ) =>
                setSellerUserId(
                  event.target
                    .value
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
            >
              {sellers.map(
                (
                  seller
                ) => (
                  <option
                    key={
                      seller.id
                    }
                    value={
                      seller.id
                    }
                  >
                    {seller.full_name ??
                      seller.email ??
                      "Vendedor"}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </section>

      {/* PAGAMENTO */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-[#15704f]" />

          <h2 className="font-semibold text-slate-900">
            Condições de pagamento
          </h2>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Forma de pagamento
            </label>

            <select
              value={
                paymentMethodId
              }
              disabled={
                financialLocked
              }
              onChange={(
                event
              ) =>
                setPaymentMethodId(
                  event.target
                    .value
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
            >
              {paymentMethods.map(
                (
                  method
                ) => (
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
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Parcelas
            </label>

            <input
              type="number"
              min={1}
              value={
                installments
              }
              disabled={
                financialLocked
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
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Primeiro vencimento
            </label>

            <input
              type="date"
              value={
                firstDueDate
              }
              disabled={
                financialLocked
              }
              onChange={(
                event
              ) =>
                setFirstDueDate(
                  event.target
                    .value
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
            />
          </div>
        </div>

        {!financialLocked &&
          subtotal >
            0 && (
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {installmentPreview.map(
                (
                  value,
                  index
                ) => (
                  <div
                    key={
                      index
                    }
                    className="rounded-xl bg-slate-50 p-3"
                  >
                    <p className="text-xs text-slate-400">
                      Parcela{" "}
                      {
                        index +
                        1
                      }
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {formatCurrency(
                        value
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          )}
      </section>

      {/* ANÚNCIOS */}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <FilePlus2 className="h-5 w-5 text-[#15704f]" />

              <h2 className="font-semibold text-slate-900">
                Anúncios
              </h2>
            </div>
          </div>

          {!financialLocked && (
            <button
              type="button"
              onClick={
                addItem
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:border-[#15704f] hover:text-[#15704f]"
            >
              <Plus className="h-4 w-4" />

              Adicionar anúncio
            </button>
          )}
        </div>

        <div className="space-y-5 p-6">
          {items.map(
            (
              item,
              index
            ) => (
              <div
                key={
                  item.localId
                }
                className="rounded-2xl border border-slate-200 p-5"
              >
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    Anúncio{" "}
                    {
                      index +
                      1
                    }
                  </p>

                  {!financialLocked && (
                    <button
                      type="button"
                      onClick={() =>
                        removeItem(
                          item.localId
                        )
                      }
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    <label className="text-sm font-medium text-slate-700">
                      Descrição
                    </label>

                    <input
                      value={
                        item.description
                      }
                      disabled={
                        financialLocked
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          item.localId,
                          "description",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Caderno
                    </label>

                    <select
                      value={
                        item.sectionId
                      }
                      disabled={
                        financialLocked
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          item.localId,
                          "sectionId",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
                    >
                      <option value="">
                        Sem caderno
                      </option>

                      {sections.map(
                        (
                          section
                        ) => (
                          <option
                            key={
                              section.id
                            }
                            value={
                              section.id
                            }
                          >
                            {
                              section.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Localização
                    </label>

                    <input
                      value={
                        item.placement
                      }
                      disabled={
                        financialLocked
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          item.localId,
                          "placement",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Impressão
                    </label>

                    <select
                      value={
                        item.printType
                      }
                      disabled={
                        financialLocked
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          item.localId,
                          "printType",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
                    >
                      <option value="">
                        Não informado
                      </option>

                      <option value="color">
                        Interno colorido
                      </option>

                      <option value="black_white">
                        Interno preto e branco
                      </option>

                      <option value="other">
                        Outro
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Quantidade
                    </label>

                    <input
                      type="number"
                      min={1}
                      value={
                        item.quantity
                      }
                      disabled={
                        financialLocked
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          item.localId,
                          "quantity",
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
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Valor unitário
                    </label>

                    <input
                      value={
                        item.unitPrice
                      }
                      disabled={
                        financialLocked
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          item.localId,
                          "unitPrice",
                          event.target
                            .value
                        )
                      }
                      inputMode="decimal"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
                    />
                  </div>

                  <div className="md:col-span-2 xl:col-span-3">
                    <label className="text-sm font-medium text-slate-700">
                      Observações
                    </label>

                    <textarea
                      rows={3}
                      value={
                        item.notes
                      }
                      disabled={
                        financialLocked
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          item.localId,
                          "notes",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
                    />
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* OBSERVAÇÕES */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <label className="text-sm font-medium text-slate-700">
          Observações da venda
        </label>

        <textarea
          rows={4}
          value={
            notes
          }
          disabled={
            financialLocked
          }
          onChange={(
            event
          ) =>
            setNotes(
              event.target
                .value
            )
          }
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#15704f] disabled:bg-slate-50"
        />
      </section>

      {/* RESUMO */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Summary
            label="Total da venda"
            value={formatCurrency(
              subtotal
            )}
          />

          <Summary
            label={`Comissão (${formatPercentage(
              commissionPercentage
            )})`}
            value={formatCurrency(
              commissionAmount
            )}
            icon
          />
        </div>

        {message && (
          <div
            className={`mt-5 rounded-xl px-4 py-3 text-sm ${
              message.type ===
              "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {
              message.text
            }
          </div>
        )}

        {!financialLocked && (
          <div className="mt-6 flex justify-end border-t border-slate-100 pt-6">
            <button
              type="submit"
              disabled={
                isPending
              }
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white hover:bg-[#105c41] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />

              {isPending
                ? "Salvando..."
                : "Salvar alterações"}
            </button>
          </div>
        )}
      </section>
    </form>
  );
}

function Summary({
  label,
  value,
  icon = false,
}: {
  label: string;
  value: string;
  icon?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        {icon && (
          <BadgePercent className="h-4 w-4 text-[#15704f]" />
        )}

        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
      </div>

      <p className="mt-2 text-xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function getItemTotal(
  item: SaleItem
) {
  return roundMoney(
    item.quantity *
      parseMoney(
        item.unitPrice
      )
  );
}

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

  if (!clean) {
    return 0;
  }

  if (
    clean.includes(
      ","
    )
  ) {
    return (
      Number(
        clean
          .replace(
            /\./g,
            ""
          )
          .replace(
            ",",
            "."
          )
      ) ||
      0
    );
  }

  return (
    Number(
      clean
    ) ||
    0
  );
}

function formatEditableMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  ).format(
    value
  );
}

function buildInstallments(
  total: number,
  quantity: number
) {
  if (
    quantity <=
    0
  ) {
    return [];
  }

  const totalCents =
    Math.round(
      total *
        100
    );

  const base =
    Math.floor(
      totalCents /
        quantity
    );

  const remainder =
    totalCents -
    base *
      quantity;

  return Array.from(
    {
      length:
        quantity,
    },
    (
      _,
      index
    ) =>
      (
        base +
        (
          index <
          remainder
            ? 1
            : 0
        )
      ) /
      100
  );
}

function roundMoney(
  value: number
) {
  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        100
    ) /
    100
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

function formatPercentage(
  value: number
) {
  return (
    new Intl.NumberFormat(
      "pt-BR",
      {
        maximumFractionDigits:
          2,
      }
    ).format(
      value
    ) + "%"
  );
}