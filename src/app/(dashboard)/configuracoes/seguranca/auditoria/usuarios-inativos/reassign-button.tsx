"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";

import { reassignInactiveUserAssets } from "./actions";

export default function ReassignButton({
  userId,
}: {
  userId: string;
}) {
  const router = useRouter();

  const [isPending, startTransition] =
    useTransition();

  const [error, setError] =
    useState("");

  function handleClick() {
    setError("");

    startTransition(async () => {
      const result =
        await reassignInactiveUserAssets(
          userId
        );

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#15704f] px-3 text-xs font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-60"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
        {isPending
          ? "Reatribuindo..."
          : "Reatribuir agora"}
      </button>

      {error && (
        <p className="mt-2 max-w-xs text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
