"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import {
  deleteProspectingLead,
  updateProspectingLead,
} from "./actions";

import {
  STATUS_BADGE_CLASSES,
  STATUS_OPTIONS,
  STATUS_ROW_CLASSES,
  statusLabel,
} from "./status";

type Seller = {
  id: string;
  name: string | null;
};

type Lead = {
  id: string;
  client_name: string;
  seller_user_id: string | null;
  value: number | string | null;
  size: string | null;
  status: string;
  billing_note: string | null;
};

function formatCurrency(
  value: number | string | null
) {
  const numeric = Number(value ?? 0);

  if (!numeric) return "—";

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(numeric);
}

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

export default function LeadRow({
  companyId,
  listId,
  lead,
  sellers,
}: {
  companyId: string;
  listId: string;
  lead: Lead;
  sellers: Seller[];
}) {
  const router = useRouter();

  const [editing, setEditing] =
    useState(false);

  const [clientName, setClientName] =
    useState(lead.client_name);

  const [sellerUserId, setSellerUserId] =
    useState(
      lead.seller_user_id ?? ""
    );

  const [value, setValue] = useState(
    lead.value
      ? String(lead.value).replace(
          ".",
          ","
        )
      : ""
  );

  const [size, setSize] = useState(
    lead.size ?? ""
  );

  const [status, setStatus] = useState(
    lead.status
  );

  const [billingNote, setBillingNote] =
    useState(lead.billing_note ?? "");

  const [error, setError] = useState("");

  const [isPending, startTransition] =
    useTransition();

  const seller = sellers.find(
    (item) => item.id === lead.seller_user_id
  );

  function handleCancel() {
    setClientName(lead.client_name);
    setSellerUserId(
      lead.seller_user_id ?? ""
    );
    setValue(
      lead.value
        ? String(lead.value).replace(
            ".",
            ","
          )
        : ""
    );
    setSize(lead.size ?? "");
    setStatus(lead.status);
    setBillingNote(
      lead.billing_note ?? ""
    );
    setError("");
    setEditing(false);
  }

  function handleSave() {
    setError("");

    startTransition(async () => {
      const result =
        await updateProspectingLead(
          lead.id,
          {
            companyId,
            listId,
            clientName,
            sellerUserId:
              sellerUserId || null,
            value: parseMoney(value),
            size,
            status,
            billingNote,
          }
        );

      if (!result.success) {
        setError(result.error);
        return;
      }

      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteProspectingLead(
        companyId,
        listId,
        lead.id
      );

      router.refresh();
    });
  }

  if (!editing) {
    return (
      <tr
        className={
          STATUS_ROW_CLASSES[
            lead.status
          ] ?? "bg-white"
        }
      >
        <td className="px-4 py-3 text-sm font-medium text-slate-800">
          {lead.client_name}
        </td>

        <td className="px-4 py-3 text-sm text-slate-700">
          {seller?.name ?? "—"}
        </td>

        <td className="px-4 py-3 text-sm text-slate-700">
          {formatCurrency(lead.value)}
        </td>

        <td className="px-4 py-3 text-sm text-slate-700">
          {lead.size || "—"}
        </td>

        <td className="px-4 py-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              STATUS_BADGE_CLASSES[
                lead.status
              ] ??
              "bg-slate-100 text-slate-500"
            }`}
          >
            {statusLabel(lead.status)}
          </span>
        </td>

        <td className="px-4 py-3 text-sm text-slate-700">
          {lead.billing_note || "—"}
        </td>

        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() =>
                setEditing(true)
              }
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-slate-50">
      <td className="px-4 py-2">
        <input
          value={clientName}
          onChange={(event) =>
            setClientName(
              event.target.value
            )
          }
          className="input h-9"
        />
      </td>

      <td className="px-4 py-2">
        <select
          value={sellerUserId}
          onChange={(event) =>
            setSellerUserId(
              event.target.value
            )
          }
          className="input h-9"
        >
          <option value="">
            —
          </option>

          {sellers.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.name}
            </option>
          ))}
        </select>
      </td>

      <td className="px-4 py-2">
        <input
          value={value}
          onChange={(event) =>
            setValue(
              event.target.value
            )
          }
          placeholder="0,00"
          className="input h-9 w-24"
        />
      </td>

      <td className="px-4 py-2">
        <input
          value={size}
          onChange={(event) =>
            setSize(
              event.target.value
            )
          }
          placeholder="9x9"
          className="input h-9 w-20"
        />
      </td>

      <td className="px-4 py-2">
        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="input h-9"
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
      </td>

      <td className="px-4 py-2">
        <input
          value={billingNote}
          onChange={(event) =>
            setBillingNote(
              event.target.value
            )
          }
          placeholder="Ex.: 04/05"
          className="input h-9"
        />
      </td>

      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="rounded-lg bg-[#15704f] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {isPending
              ? "..."
              : "Salvar"}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
          >
            Cancelar
          </button>
        </div>

        {error && (
          <p className="mt-1 text-right text-xs text-red-600">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}
