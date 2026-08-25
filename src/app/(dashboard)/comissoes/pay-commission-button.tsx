"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  HandCoins,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  payCommission,
} from "./actions";

type Props = {
  commissionId: string;

  originType:
    | "sale"
    | "contract";

  availableAmount: number;
};

export default function PayCommissionButton({
  commissionId,
  originType,
  availableAmount,
}: Props) {

  const router =
    useRouter();

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    amount,
    setAmount,
  ] =
    useState(
      formatEditableMoney(
        availableAmount
      )
    );

  const [
    dueDate,
    setDueDate,
  ] =
    useState(
      getToday()
    );

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    isPending,
    startTransition,
  ] =
    useTransition();

  function handleOpen() {
    setAmount(
      formatEditableMoney(
        availableAmount
      )
    );

    setDueDate(
      getToday()
    );

    setNotes("");

    setMessage(
      null
    );

    setOpen(
      true
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

    const numericAmount =
      parseMoney(
        amount
      );

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      setMessage(
        "Informe um valor válido."
      );

      return;
    }

    if (
      numericAmount >
      availableAmount
    ) {
      setMessage(
        "O valor é maior que a comissão disponível."
      );

      return;
    }

    if (
      !dueDate
    ) {
      setMessage(
        "Informe a data."
      );

      return;
    }

    startTransition(
      async () => {
        const result =
  await payCommission({
    commissionId,

    originType,

    amount:
      numericAmount,

    dueDate,

    notes:
      notes.trim() ||
      undefined,
  });

        if (
          !result.success
        ) {
          setMessage(
            result.message ??
              "Não foi possível gerar o pagamento."
          );

          return;
        }

        setOpen(
          false
        );

        if (
          result.financialEntryId
        ) {
          router.push(
            `/financeiro/${result.financialEntryId}`
          );

          router.refresh();

          return;
        }

        router.refresh();
      }
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={
          handleOpen
        }
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#15704f] px-3 text-xs font-semibold text-white transition hover:bg-[#105c41]"
      >
        <HandCoins className="h-3.5 w-3.5" />

        Gerar pagamento
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Gerar pagamento de comissão
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Será criada uma conta a pagar no Financeiro.
              </p>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="p-6"
            >
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Disponível para pagamento
                </label>

                <div className="mt-2 rounded-xl bg-emerald-50 px-4 py-3">
                  <p className="text-lg font-semibold text-[#15704f]">
                    {formatCurrency(
                      availableAmount
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label className="text-sm font-medium text-slate-700">
                  Valor a gerar
                </label>

                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    R$
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      amount
                    }
                    onChange={(
                      event
                    ) =>
                      setAmount(
                        event.target
                          .value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="text-sm font-medium text-slate-700">
                  Vencimento
                </label>

                <input
                  type="date"
                  value={
                    dueDate
                  }
                  onChange={(
                    event
                  ) =>
                    setDueDate(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
                />
              </div>

              <div className="mt-5">
                <label className="text-sm font-medium text-slate-700">
                  Observações
                </label>

                <textarea
                  rows={3}
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
                  placeholder="Opcional"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
                />
              </div>

              {message && (
                <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {
                    message
                  }
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() =>
                    setOpen(
                      false
                    )
                  }
                  disabled={
                    isPending
                  }
                  className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    isPending
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HandCoins className="h-4 w-4" />

                  {isPending
                    ? "Gerando..."
                    : "Gerar pagamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
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

function getToday() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}