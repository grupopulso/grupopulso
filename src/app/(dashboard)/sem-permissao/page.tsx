import Link from "next/link";
import {
  ArrowLeft,
  ShieldX,
} from "lucide-react";

export default function SemPermissaoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f6] p-8">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <ShieldX className="h-7 w-7 text-red-600" />
        </div>

        <h1 className="mt-5 text-2xl font-semibold text-slate-900">
          Acesso não permitido
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Seu usuário não possui permissão para acessar esta área do sistema.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar à visão geral
        </Link>
      </div>
    </main>
  );
}