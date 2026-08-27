"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  togglePartnerActive,
} from "@/app/(dashboard)/financeiro/socios/actions";

export default function TogglePartnerButton({
  partnerId,
  active,
}: {
  partnerId: string;
  active: boolean;
}) {
  const router = useRouter();

  const [pending, startTransition] =
    useTransition();

  function handleClick() {
    startTransition(async () => {
      await togglePartnerActive(
        partnerId,
        !active
      );

      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
        active
          ? "bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600"
          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      }`}
    >
      {pending
        ? "..."
        : active
          ? "Desativar"
          : "Ativar"}
    </button>
  );
}
