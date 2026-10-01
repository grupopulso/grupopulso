"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/*
 * Volta pra tela anterior de fato (ex: /financeiro/receber com os
 * filtros aplicados), em vez de sempre ir pro /financeiro fixo -
 * depois de registrar um pagamento, o usuário perdia o filtro de
 * "vencidos" que tinha aplicado (bug reportado em 01/10).
 */
export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() =>
        router.back()
      }
      className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar
    </button>
  );
}
