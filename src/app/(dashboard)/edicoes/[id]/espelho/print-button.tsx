"use client";

import {
  Printer,
} from "lucide-react";

export function PrintButton() {
  function handlePrint() {
    window.print();
  }

  return (
    <button
      type="button"
      onClick={
        handlePrint
      }
      className="print:hidden inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
    >
      <Printer className="h-4 w-4" />

      Imprimir espelho
    </button>
  );
}