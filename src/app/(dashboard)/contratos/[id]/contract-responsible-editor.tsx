"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  Check,
  Pencil,
  X,
} from "lucide-react";

import { updateContractResponsible } from "./actions";

type Option = {
  id: string;
  name: string | null;
};

type Props = {
  contractId: string;
  currentUserId: string | null;
  currentUserName: string | null;
  canEdit: boolean;
  options: Option[];
};

export default function ContractResponsibleEditor({
  contractId,
  currentUserId,
  currentUserName,
  canEdit,
  options,
}: Props) {
  const [editing, setEditing] =
    useState(false);

  const [selected, setSelected] = useState(
    currentUserId ?? ""
  );

  const [error, setError] = useState("");

  const [isPending, startTransition] =
    useTransition();

  const displayName =
    currentUserName ?? "Não definido";

  if (!canEdit) {
    return (
      <p className="text-sm font-medium text-slate-800">
        {displayName}
      </p>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800 transition hover:text-[#15704f]"
      >
        {displayName}
        <Pencil className="h-3.5 w-3.5 text-[#15704f]" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        autoFocus
        value={selected}
        onChange={(event) =>
          setSelected(event.target.value)
        }
        className="h-9 w-48 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-[#15704f]"
      >
        <option value="">
          Selecione...
        </option>

        {options.map((option) => (
          <option
            key={option.id}
            value={option.id}
          >
            {option.name ?? "Usuário"}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={isPending || !selected}
        onClick={() => {
          setError("");

          startTransition(async () => {
            const result =
              await updateContractResponsible(
                contractId,
                selected
              );

            if (!result.success) {
              setError(
                result.error ??
                  "Não foi possível salvar."
              );
              return;
            }

            setEditing(false);
          });
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#15704f] text-white transition hover:bg-[#105c41] disabled:opacity-60"
      >
        <Check className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError("");
          setSelected(
            currentUserId ?? ""
          );
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
      >
        <X className="h-4 w-4" />
      </button>

      {error && (
        <span className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
