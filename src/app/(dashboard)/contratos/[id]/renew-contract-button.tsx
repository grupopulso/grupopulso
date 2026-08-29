import Link from "next/link";

import {
  RefreshCw,
} from "lucide-react";

type Props = {
  contractId: string;
  contractTitle?: string;
  compact?: boolean;
};

/*
 * Antes este botão disparava a renovação direto (clone
 * instantâneo). Agora ele apenas leva para o formulário
 * de renovação, já pré-preenchido, onde é possível ajustar
 * valor, produto, datas e parcelas antes de confirmar.
 */

export default function RenewContractButton({
  contractId,
  compact = false,
}: Props) {
  if (compact) {
    return (
      <Link
        href={`/contratos/${contractId}/renovar`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Renovar
      </Link>
    );
  }

  return (
    <Link
      href={`/contratos/${contractId}/renovar`}
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      <RefreshCw className="h-4 w-4" />
      Renovar contrato
    </Link>
  );
}
