"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { Save } from "lucide-react";

import {
  updateExpenseEntry,
} from "../edit-actions";

type Option = {
  id: string;
  name: string;
};

type Props = {
  entryId: string;

  entry: {
    description: string;
    supplier_id: string | null;
    category_id: string | null;
    cost_center_id: string | null;
    financial_account_id: string | null;
    payment_method_id: string | null;
    document_number: string | null;
    issue_date: string;
    competence_date: string | null;
    due_date: string;
    amount: number | string;
    interest: number | string;
    fine: number | string;
    discount: number | string;
    notes: string | null;
    amount_paid: number | string;
  };

  suppliers: Option[];
  categories: Option[];
  costCenters: Option[];
  financialAccounts: Option[];
  paymentMethods: Option[];
};

function formatMoney(value: number | string) {
  return Number(value).toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function parseMoney(value: string) {
  return Number(
    value
      .replace(/\./g, "")
      .replace(",", ".")
  );
}

export default function EditExpenseForm({
  entryId,
  entry,
  suppliers,
  categories,
  costCenters,
  financialAccounts,
  paymentMethods,
}: Props) {
  const router = useRouter();

  const [description, setDescription] =
    useState(entry.description);

  const [supplierId, setSupplierId] =
    useState(entry.supplier_id ?? "");

  const [categoryId, setCategoryId] =
    useState(entry.category_id ?? "");

  const [costCenterId, setCostCenterId] =
    useState(entry.cost_center_id ?? "");

  const [
    financialAccountId,
    setFinancialAccountId,
  ] = useState(
    entry.financial_account_id ?? ""
  );

  const [
    paymentMethodId,
    setPaymentMethodId,
  ] = useState(
    entry.payment_method_id ?? ""
  );

  const [documentNumber, setDocumentNumber] =
    useState(entry.document_number ?? "");

  const [issueDate, setIssueDate] =
    useState(entry.issue_date);

  const [competenceDate, setCompetenceDate] =
    useState(entry.competence_date ?? "");

  const [dueDate, setDueDate] = useState(
    entry.due_date
  );

  const [amount, setAmount] = useState(
    formatMoney(entry.amount)
  );

  const [interest, setInterest] = useState(
    formatMoney(entry.interest)
  );

  const [fine, setFine] = useState(
    formatMoney(entry.fine)
  );

  const [discount, setDiscount] = useState(
    formatMoney(entry.discount)
  );

  const [notes, setNotes] = useState(
    entry.notes ?? ""
  );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  const alreadyPaid =
    Number(entry.amount_paid) > 0;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const result = await updateExpenseEntry(
      entryId,
      {
        description,
        supplierId: supplierId || null,
        categoryId: categoryId || null,
        costCenterId: costCenterId || null,
        financialAccountId:
          financialAccountId || null,
        paymentMethodId:
          paymentMethodId || null,
        documentNumber:
          documentNumber || null,
        issueDate,
        competenceDate:
          competenceDate || null,
        dueDate,
        amount: parseMoney(amount),
        interest: parseMoney(interest),
        fine: parseMoney(fine),
        discount: parseMoney(discount),
        notes: notes || null,
      }
    );

    if (!result.success) {
      setError(result.message);
      setLoading(false);

      return;
    }

    /*
     * Volta pra tela de onde veio (o lançamento ou a lista) em vez
     * de empilhar uma nova entrada no histórico - senão o
     * "Voltar" do lançamento cairia de novo nesta tela de edição.
     */
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/financeiro/${entryId}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6"
    >
      {alreadyPaid && (
        <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Esta despesa já tem pagamento registrado
          (R$ {formatMoney(entry.amount_paid)}). Você
          pode alterar os dados, mas o valor total não
          pode ficar abaixo do que já foi pago.
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Descrição" wide>
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

        <Field label="Fornecedor">
          <select
            value={supplierId}
            onChange={(event) =>
              setSupplierId(
                event.target.value
              )
            }
            className="input"
          >
            <option value="">
              Sem fornecedor identificado
            </option>

            {suppliers.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </Field>

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

            {categories.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
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

            {costCenters.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Conta / Caixa">
          <select
            value={financialAccountId}
            onChange={(event) =>
              setFinancialAccountId(
                event.target.value
              )
            }
            className="input"
          >
            <option value="">
              Sem conta definida
            </option>

            {financialAccounts.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Forma de pagamento prevista">
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
              Sem forma definida
            </option>

            {paymentMethods.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nº documento">
          <input
            value={documentNumber}
            onChange={(event) =>
              setDocumentNumber(
                event.target.value
              )
            }
            className="input"
          />
        </Field>

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

        <Field label="Valor principal (R$)">
          <input
            value={amount}
            onChange={(event) =>
              setAmount(
                event.target.value
              )
            }
            inputMode="decimal"
            required
            className="input"
          />
        </Field>

        <Field label="Juros (R$)">
          <input
            value={interest}
            onChange={(event) =>
              setInterest(
                event.target.value
              )
            }
            inputMode="decimal"
            className="input"
          />
        </Field>

        <Field label="Multa (R$)">
          <input
            value={fine}
            onChange={(event) =>
              setFine(event.target.value)
            }
            inputMode="decimal"
            className="input"
          />
        </Field>

        <Field label="Desconto (R$)">
          <input
            value={discount}
            onChange={(event) =>
              setDiscount(
                event.target.value
              )
            }
            inputMode="decimal"
            className="input"
          />
        </Field>

        <Field label="Observações" wide>
          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            rows={3}
            className="input"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push(
                `/financeiro/${entryId}`
              );
            }
          }}
          disabled={loading}
          className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />

          {loading
            ? "Salvando..."
            : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={
        wide ? "md:col-span-2" : undefined
      }
    >
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}
