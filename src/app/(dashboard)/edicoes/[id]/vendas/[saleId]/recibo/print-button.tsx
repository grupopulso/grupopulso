"use client";

import {
  Printer,
} from "lucide-react";

export default function PrintButton() {
  return (
    <div className="mt-5 flex justify-end print:hidden">
      <button
        type="button"
        onClick={() =>
          window.print()
        }
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
      >
        <Printer className="h-4 w-4" />

        Gerar PDF / Imprimir
      </button>
    </div>
  );
}