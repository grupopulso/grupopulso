"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/*
 * Volta pra tela anterior de fato (ex: /financeiro/pagar com os
 * filtros aplicados), em vez de ir sempre pra um lugar fixo. Só
 * usa o `fallbackHref` quando não há histórico pra voltar (ex.:
 * a página foi aberta direto por um link).
 */
export default function BackButton({
  fallbackHref = "/financeiro",
  label = "Voltar",
}: {
  fallbackHref?: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
