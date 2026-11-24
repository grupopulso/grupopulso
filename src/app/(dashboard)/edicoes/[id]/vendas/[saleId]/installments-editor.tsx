"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  CalendarClock,
  Plus,
  Split,
  Trash2,
  X,
} from "lucide-react";

import { updateSaleInstallments } from "../actions";

type EditableInstallment = {
  id: string;
  number: number;
  dueDate: string;
  amount: number;
};

type Row = {
  key: string;
  id: string | null;
  dueDate: string;
  amount: string;
};

/*
 * Botão + janela para refazer as parcelas (boletos) ainda não
 * pagas da venda: trocar vencimento/valor, incluir ou tirar
 * parcelas, ou dividir de novo em N vezes. A soma tem que fechar
 * com a soma original — o total da venda não muda.
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

  const [splitCount, setSplitCount] = useState("");

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

  // Parcelas já pagas ficam fora da janela, mas contam no número.
  const paidCount = Math.max(
    totalCount - installments.length,
    0
  );

  const finalCount = paidCount + rows.length;

  function handleOpen() {
    setRows(toRows(installments));
    setNote("");
    setSplitCount(String(installments.length));
    setError("");
    setOpen(true);
  }

  function updateRow(
    key: string,
    field: "dueDate" | "amount",
    value: string
  ) {
    setRows((current) =>
      current.map((row) =>
        row.key === key
          ? { ...row, [field]: value }
          : row
      )
    );
  }

  function addRow() {
    setError("");

    setRows((current) => {
      const last = current[current.length - 1];

      const missing = roundMoney(
        originalTotal -
          current.reduce(
            (sum, row) => sum + parseMoney(row.amount),
            0
          )
      );

      return [
        ...current,
        {
          key: newKey(),
          id: null,
          dueDate: last
            ? addMonths(last.dueDate, 1)
            : todayDate(),
          amount:
            missing > 0
              ? formatEditableMoney(missing)
              : "",
        },
      ];
    });
  }

  function removeRow(key: string) {
    setError("");

    setRows((current) =>
      current.length > 1
        ? current.filter((row) => row.key !== key)
        : current
    );
  }

  /*
   * Divide o total em aberto em N parcelas iguais, mês a mês, a
   * partir do 1º vencimento atual. Reaproveita as parcelas que já
   * existem; as que sobrarem saem, as que faltarem são criadas.
   */
  function splitEvenly() {
    const count = Number(splitCount);

    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 60
    ) {
      setError("Informe de 1 a 60 parcelas.");

      return;
    }

    setError("");

    const firstDate =
      rows[0]?.dueDate || todayDate();

    const values = distribute(originalTotal, count);

    setRows((current) =>
      values.map((value, index) => ({
        key: current[index]?.key ?? newKey(),
        id: current[index]?.id ?? null,
        dueDate: addMonths(firstDate, index),
        amount: formatEditableMoney(value),
      }))
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
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Alterar parcelas
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Só as parcelas ainda não pagas
                  {paidCount > 0 &&
                    ` (${paidCount} já ${
                      paidCount === 1 ? "paga fica" : "pagas ficam"
                    } como está)`}
                  . Pode mudar data e valor, incluir ou tirar
                  parcelas. O total delas continua{" "}
                  {formatCurrency(originalTotal)}.
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

            <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Dividir {formatCurrency(originalTotal)} em
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={splitCount}
                    onChange={(event) =>
                      setSplitCount(event.target.value)
                    }
                    disabled={saving}
                    aria-label="Quantidade de parcelas"
                    className="h-10 w-20 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
                  />

                  <span className="text-sm text-slate-600">
                    parcelas
                  </span>
                </div>
              </label>

              <button
                type="button"
                onClick={splitEvenly}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#15704f] hover:text-[#15704f] disabled:opacity-50"
              >
                <Split className="h-4 w-4" />
                Dividir
              </button>

              <span className="basis-full text-xs text-slate-500">
                Valores iguais, um por mês, a partir do 1º
                vencimento. Depois dá pra ajustar cada linha.
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[56px_1fr_1fr_36px] items-center gap-2 sm:gap-3"
                >
                  <span className="text-sm font-semibold text-slate-700">
                    {paidCount + index + 1}/{finalCount}
                    {!row.id && (
                      <span className="block text-[10px] font-medium uppercase text-[#15704f]">
                        nova
                      </span>
                    )}
                  </span>

                  <input
                    type="date"
                    value={row.dueDate}
                    onChange={(event) =>
                      updateRow(
                        row.key,
                        "dueDate",
                        event.target.value
                      )
                    }
                    required
                    disabled={saving}
                    aria-label={`Vencimento da parcela ${index + 1}`}
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
                          row.key,
                          "amount",
                          event.target.value
                        )
                      }
                      required
                      disabled={saving}
                      aria-label={`Valor da parcela ${index + 1}`}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={saving || rows.length <= 1}
                    title="Tirar esta parcela"
                    aria-label={`Tirar a parcela ${index + 1}`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              disabled={saving || rows.length >= 60}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#15704f] transition hover:text-[#105c41] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Adicionar parcela
            </button>

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

function toRows(
  installments: EditableInstallment[]
): Row[] {
  return [...installments]
    .sort((a, b) => a.number - b.number)
    .map((item) => ({
      key: item.id,
      id: item.id,
      dueDate: item.dueDate,
      amount: formatEditableMoney(item.amount),
    }));
}

let keySeq = 0;

function newKey() {
  keySeq += 1;

  return `new-${keySeq}`;
}

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

/*
 * Soma meses mantendo o dia; se o mês não tem o dia (31/01 →
 * fevereiro), cai no último dia do mês.
 */
function addMonths(date: string, months: number) {
  const [year, month, day] = date
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return todayDate();
  }

  const target = new Date(
    Date.UTC(year, month - 1 + months, 1)
  );

  const lastDay = new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  target.setUTCDate(Math.min(day, lastDay));

  return target.toISOString().slice(0, 10);
}

/*
 * Divide em centavos; a sobra vai nas primeiras parcelas
 * (R$ 100 em 3x = 33,34 + 33,33 + 33,33).
 */
function distribute(total: number, count: number) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const rest = cents - base * count;

  return Array.from(
    { length: count },
    (_, index) =>
      (base + (index < rest ? 1 : 0)) / 100
  );
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
