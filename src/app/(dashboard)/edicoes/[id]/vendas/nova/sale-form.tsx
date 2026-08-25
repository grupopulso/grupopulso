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
  createEditionSale,
} from "../actions";

type Client = {
  id: string;
  name: string;
};

type Seller = {
  id: string;

  full_name:
    | string
    | null;

  email:
    | string
    | null;

  commissionPercentage:
    number;
};

type Section = {
  id: string;
  name: string;

  description:
    | string
    | null;
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
  editionId: string;

  clients: Client[];

  sellers: Seller[];

  sections: Section[];

  paymentMethods:
    PaymentMethod[];

  initialSellerId?: string;

  sellerLocked?: boolean;
};

function createEmptyItem(): SaleItem {
  return {
    localId:
      crypto.randomUUID(),

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

export function SaleForm({
  editionId,
  clients,
  sellers,
  sections,
  paymentMethods,
  initialSellerId = "",
  sellerLocked = false,
}: Props) {
  const router =
    useRouter();

  const [
    clientId,
    setClientId,
  ] =
    useState("");

  const [
    sellerUserId,
    setSellerUserId,
  ] =
    useState(
      initialSellerId
    );

  const [
    paymentMethodId,
    setPaymentMethodId,
  ] =
    useState("");

  const [
    installments,
    setInstallments,
  ] =
    useState(1);

  const [
    firstDueDate,
    setFirstDueDate,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    items,
    setItems,
  ] =
    useState<
      SaleItem[]
    >([
      createEmptyItem(),
    ]);

  const [
    message,
    setMessage,
  ] =
    useState<{
      type:
        | "error"
        | "success";

      text: string;
    } | null>(
      null
    );

  const [
    isPending,
    startTransition,
  ] =
    useTransition();

  /*
   * =========================
   * VENDEDOR
   * =========================
   */

  const selectedSeller =
    sellers.find(
      (seller) =>
        seller.id ===
        sellerUserId
    );

  const commissionPercentage =
    selectedSeller
      ?.commissionPercentage ??
    0;

  /*
   * =========================
   * TOTAIS
   * =========================
   */

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

  /*
   * =========================
   * PARCELAS
   * =========================
   */

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

  /*
   * =========================
   * ITENS
   * =========================
   */

  function updateItem(
    localId: string,
    field:
      keyof SaleItem,
    value:
      string | number
  ) {
    setItems(
      (current) =>
        current.map(
          (item) =>
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
    setItems(
      (current) => [
        ...current,
        createEmptyItem(),
      ]
    );

    setMessage(
      null
    );
  }

  function removeItem(
    localId: string
  ) {
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
      (current) =>
        current.filter(
          (item) =>
            item.localId !==
            localId
        )
    );
  }

  /*
   * =========================
   * SALVAR
   * =========================
   */

  function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage(
      null
    );

    if (!clientId) {
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
      !Number.isInteger(
        installments
      ) ||
      installments < 1
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
        items[
          index
        ];

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
        item.quantity <
        1
      ) {
        setMessage({
          type:
            "error",

          text:
            `Informe uma quantidade válida no anúncio ${index + 1}.`,
        });

        return;
      }

      const unitPrice =
        parseMoney(
          item.unitPrice
        );

      if (
        !Number.isFinite(
          unitPrice
        ) ||
        unitPrice <=
          0
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

    if (
      subtotal <= 0
    ) {
      setMessage({
        type:
          "error",

        text:
          "O total da venda precisa ser maior que zero.",
      });

      return;
    }

    startTransition(
      async () => {
        const result =
          await createEditionSale({
            editionId,

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
              "Não foi possível registrar a venda.",
          });

          return;
        }

        router.push(
          `/edicoes/${editionId}`
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
      {/* DADOS DA VENDA */}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">
          Dados da venda
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Selecione o cliente e o responsável pela venda.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">

          {/* CLIENTE */}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Cliente
            </label>

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
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
            >
              <option value="">
                Selecione o cliente
              </option>

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

          {/* VENDEDOR */}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Vendedor
            </label>

            <select
              value={
                sellerUserId
              }
              disabled={
                sellerLocked
              }
              onChange={(
                event
              ) =>
                setSellerUserId(
                  event.target
                    .value
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f] disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                Selecione o vendedor
              </option>

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

            {selectedSeller && (
              <p className="mt-1 text-xs text-slate-400">
                Comissão configurada:{" "}
                {formatPercentage(
                  selectedSeller.commissionPercentage
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ANÚNCIOS */}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <FilePlus2 className="h-5 w-5 text-[#15704f]" />

              <h2 className="font-semibold text-slate-900">
                Anúncios da venda
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Um mesmo cliente pode adquirir vários anúncios nesta venda.
            </p>
          </div>

          <button
            type="button"
            onClick={
              addItem
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f]"
          >
            <Plus className="h-4 w-4" />

            Adicionar anúncio
          </button>
        </div>

        <div className="space-y-5 p-6">
          {items.map(
            (
              item,
              index
            ) => {
              const itemTotal =
                getItemTotal(
                  item
                );

              return (
                <div
                  key={
                    item.localId
                  }
                  className="rounded-2xl border border-slate-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Anúncio{" "}
                        {
                          index +
                          1
                        }
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        {itemTotal >
                        0
                          ? formatCurrency(
                              itemTotal
                            )
                          : "Informe os dados do anúncio"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeItem(
                          item.localId
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-5">
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

                      <div className="xl:col-span-2">
                        <label className="text-sm font-medium text-slate-700">
                          Descrição do anúncio
                        </label>

                        <input
                          type="text"
                          value={
                            item.description
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
                          placeholder="Ex.: Anúncio institucional"
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
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
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
                        >
                          <option value="">
                            Sem caderno específico
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
                          Localização / posição
                        </label>

                        <input
                          type="text"
                          value={
                            item.placement
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
                          placeholder="Ex.: Página 5, contracapa..."
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          Tipo de impressão
                        </label>

                        <select
                          value={
                            item.printType
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
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
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
                          min={
                            1
                          }
                          value={
                            item.quantity
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
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          Valor unitário
                        </label>

                        <div className="relative mt-2">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                            R$
                          </span>

                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              item.unitPrice
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
                            placeholder="0,00"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          Total do anúncio
                        </label>

                        <div className="mt-2 flex h-11 items-center rounded-xl bg-slate-50 px-3">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              itemTotal
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="md:col-span-2 xl:col-span-3">
                        <label className="text-sm font-medium text-slate-700">
                          Observações do anúncio
                        </label>

                        <textarea
                          rows={
                            3
                          }
                          value={
                            item.notes
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
                          placeholder="Detalhes adicionais..."
                          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          )}

          <button
            type="button"
            onClick={
              addItem
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm font-semibold text-slate-500 transition hover:border-[#15704f] hover:bg-emerald-50/30 hover:text-[#15704f]"
          >
            <Plus className="h-4 w-4" />

            Adicionar outro anúncio
          </button>
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

        <p className="mt-1 text-sm text-slate-500">
          Esses dados serão usados para gerar automaticamente a conta a receber no financeiro.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-3">

          <div>
            <label className="text-sm font-medium text-slate-700">
              Forma de pagamento
            </label>

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
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
            >
              <option value="">
                Selecione
              </option>

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
              Número de parcelas
            </label>

            <input
              type="number"
              min={
                1
              }
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
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
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
              onChange={(
                event
              ) =>
                setFirstDueDate(
                  event.target
                    .value
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
            />
          </div>
        </div>

        {subtotal >
          0 && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Previsão das parcelas
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {installmentPreview.map(
                (
                  value,
                  index
                ) => (
                  <div
                    key={
                      index
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
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
          </div>
        )}
      </section>

      {/* OBSERVAÇÕES */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">
          Observações da venda
        </h2>

        <textarea
          rows={
            4
          }
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
          placeholder="Condições comerciais, combinações com o cliente, informações para produção..."
          className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
        />
      </section>

      {/* RESUMO */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Summary
            label="Anúncios"
            value={String(
              items.length
            )}
          />

          <Summary
            label="Total da venda"
            value={formatCurrency(
              subtotal
            )}
          />

          <Summary
            label={`Comissão ${
              commissionPercentage >
              0
                ? `(${formatPercentage(
                    commissionPercentage
                  )})`
                : ""
            }`}
            value={formatCurrency(
              commissionAmount
            )}
            icon
          />
        </div>

        <div className="mt-6 border-t border-slate-100 pt-6">
          {message && (
            <div
              className={`mb-5 rounded-xl px-4 py-3 text-sm ${
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

          <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs leading-5 text-slate-400">
              A comissão será registrada como pendente e só será liberada conforme o recebimento real da venda.
            </p>

            <button
              type="submit"
              disabled={
                isPending ||
                subtotal <= 0
              }
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-6 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />

              {isPending
                ? "Registrando..."
                : "Confirmar venda"}
            </button>
          </div>
        </div>
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

function buildInstallments(
  total: number,
  quantity: number
) {
  if (
    quantity <= 0
  ) {
    return [];
  }

  const base =
    Math.floor(
      (
        total /
        quantity
      ) *
        100
    ) / 100;

  const values =
    Array.from(
      {
        length:
          quantity,
      },
      () =>
        base
    );

  const used =
    roundMoney(
      base *
        quantity
    );

  const difference =
    roundMoney(
      total -
        used
    );

  if (
    values.length
  ) {
    values[
      values.length -
        1
    ] =
      roundMoney(
        values[
          values.length -
            1
        ] +
          difference
      );
  }

  return values;
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
      ) || 0
    );
  }

  return (
    Number(
      clean
    ) || 0
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
    ) / 100
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