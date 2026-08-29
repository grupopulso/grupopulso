"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import {
  deleteCompanyPartner,
} from "@/app/(dashboard)/financeiro/socios/actions";

export default function DeletePartnerButton({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const router = useRouter();

  const [pending, startTransition] =
    useTransition();

  const [error, setError] = useState("");

  function handleClick() {
    if (
      !window.confirm(
        `Excluir ${partnerName} da divisão de sócios desta empresa?`
      )
    ) {
      return;
    }

    setError("");

    startTransition(async () => {
      const result =
        await deleteCompanyPartner(
          partnerId
        );

      if (!result.success) {
        setError(
          result.message ??
            "Não foi possível excluir."
        );
        return;
      }

      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {pending ? "..." : "Excluir"}
      </button>

      {error && (
        <span className="text-[11px] text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
