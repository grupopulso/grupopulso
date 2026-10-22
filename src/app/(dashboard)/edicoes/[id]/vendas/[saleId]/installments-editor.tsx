"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { CalendarClock, X } from "lucide-react";

import { updateSaleInstallments } from "../actions";

type EditableInstallment = {
  id: string;
  number: number;
  dueDate: string;
  amount: number;
};

/*
 * Botão + janela para trocar vencimento/valor das parcelas
 * (boletos) ainda não pagas da venda. A soma tem que fechar com
 * a soma original — o total da venda não muda.
 */
export default function InstallmentsEditor({
  saleId,
  editionId,
  installments,
  totalCount,
}: {
  saleId: string;
  editionId: string;
  installments: EditableInstallment[];
  totalCount: number;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [rows, setRows] = useState(() =>
    toRows(installments)
  );

  const [note, setNote] = useState("");

  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);

  const originalTotal = roundMoney(
    installments.reduce(
      (sum, item) => sum + item.amount,
      0
    )
  );

  const currentTotal = roundMoney(
    rows.reduce(
      (sum, row) => sum + parseMoney(row.amount),
      0
    )
  );

  const difference = roundMoney(
    originalTotal - currentTotal
  );

  function handleOpen() {
    setRows(toRows(installments));
    setNote("");
    setError("");
    setOpen(true);
  }

  function updateRow(
    id: string,
    field: "dueDate" | "amount",
    value: string
  ) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? { ...row, [field]: value }
          : row
      )
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (difference !== 0) {
      setError(
        `A soma precisa fechar em ${formatCurrency(
          originalTotal
        )}.`
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await updateSaleInstallments(
        saleId,
        editionId,
        rows.map((row) => ({
          installmentId: row.id,
          dueDate: row.dueDate,
          amount: parseMoney(row.amount),
        })),
        note.trim() || undefined
      );

      if (!result.success) {
        setError(result.message);

        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Erro ao alterar parcelas:", err);

      setError(
        "Não foi possível salvar. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#15704f] hover:text-[#15704f]"
      >
        <CalendarClock className="h-4 w-4" />
        Alterar parcelas
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Alterar parcelas
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Só as parcelas ainda não pagas. O total
                  delas continua {formatCurrency(originalTotal)}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[70px_1fr_1fr] items-center gap-3"
                >
                  <span className="text-sm font-semibold text-slate-700">
                    {row.number}/{totalCount}
                  </span>

                  <input
                    type="date"
                    value={row.dueDate}
                    onChange={(event) =>
                      updateRow(
                        row.id,
                        "dueDate",
                        event.target.value
                      )
                    }
                    required
                    disabled={saving}
                    aria-label={`Vencimento da parcela ${row.number}`}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
                  />

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      R$
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(event) =>
                        updateRow(
                          row.id,
                          "amount",
                          event.target.value
                        )
                      }
                      required
                      disabled={saving}
                      aria-label={`Valor da parcela ${row.number}`}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                difference === 0
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              Soma: <strong>{formatCurrency(currentTotal)}</strong>
              {difference !== 0 &&
                ` — ${
                  difference > 0 ? "faltam" : "sobram"
                } ${formatCurrency(Math.abs(difference))}`}
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Observação (opcional)
              </span>

              <textarea
                rows={3}
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                disabled={saving}
                maxLength={1000}
                placeholder="Ex.: boleto único junto com a venda da edição 1801, total R$ 400,00"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
              />

              <span className="mt-1 block text-xs text-slate-400">
                Fica nas observações da venda e de cada parcela,
                com a data e quem alterou.
              </span>
            </label>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving || difference !== 0}
                className="h-11 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar parcelas"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function toRows(installments: EditableInstallment[]) {
  return installments.map((item) => ({
    id: item.id,
    number: item.number,
    dueDate: item.dueDate,
    amount: formatEditableMoney(item.amount),
  }));
}

function parseMoney(value: string) {
  const clean = value.trim().replace(/\s/g, "");

  if (!clean) {
    return 0;
  }

  if (clean.includes(",")) {
    return (
      Number(
        clean.replace(/\./g, "").replace(",", ".")
      ) || 0
    );
  }

  return Number(clean) || 0;
}

function formatEditableMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function roundMoney(value: number) {
  return (
    Math.round((value + Number.EPSILON) * 100) / 100
  );
}
