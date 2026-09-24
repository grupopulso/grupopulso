"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { createProspectingLead } from "./actions";
import { STATUS_OPTIONS } from "./status";

type Seller = {
  id: string;
  name: string | null;
};

function parseMoney(value: string) {
  if (!value.trim()) return null;

  const parsed = Number(
    value
      .replace(/\./g, "")
      .replace(",", ".")
  );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export default function AddLeadForm({
  companyId,
  listId,
  sellers,
}: {
  companyId: string;
  listId: string;
  sellers: Seller[];
}) {
  const router = useRouter();

  const [clientName, setClientName] =
    useState("");

  const [sellerUserId, setSellerUserId] =
    useState("");

  const [value, setValue] = useState("");
  const [size, setSize] = useState("");

  const [status, setStatus] = useState(
    "none"
  );

  const [billingNote, setBillingNote] =
    useState("");

  const [error, setError] = useState("");

  const [isPending, startTransition] =
    useTransition();

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result =
        await createProspectingLead({
          companyId,
          listId,
          clientName,
          sellerUserId:
            sellerUserId || null,
          value: parseMoney(value),
          size,
          status,
          billingNote,
        });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setClientName("");
      setSellerUserId("");
      setValue("");
      setSize("");
      setStatus("none");
      setBillingNote("");

      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <input
          required
          value={clientName}
          onChange={(event) =>
            setClientName(
              event.target.value
            )
          }
          placeholder="Nome do cliente"
          className="input h-10 lg:col-span-2"
        />

        <select
          value={sellerUserId}
          onChange={(event) =>
            setSellerUserId(
              event.target.value
            )
          }
          className="input h-10"
        >
          <option value="">
            Vendedor...
          </option>

          {sellers.map((seller) => (
            <option
              key={seller.id}
              value={seller.id}
            >
              {seller.name}
            </option>
          ))}
        </select>

        <input
          value={value}
          onChange={(event) =>
            setValue(
              event.target.value
            )
          }
          placeholder="Valor"
          className="input h-10"
        />

        <input
          value={size}
          onChange={(event) =>
            setSize(
              event.target.value
            )
          }
          placeholder="Tamanho"
          className="input h-10"
        />

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="input h-10"
        >
          {STATUS_OPTIONS.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          value={billingNote}
          onChange={(event) =>
            setBillingNote(
              event.target.value
            )
          }
          placeholder="Observação de cobrança (opcional)"
          className="input h-10 flex-1"
        />

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {isPending
            ? "Adicionando..."
            : "Adicionar cliente"}
        </button>

        {error && (
          <span className="text-xs text-red-600">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
