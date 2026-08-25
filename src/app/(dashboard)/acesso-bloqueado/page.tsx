import {
  ShieldX,
} from "lucide-react";

export default function AcessoBloqueadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f6] p-8">
      <div className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <ShieldX className="h-7 w-7 text-red-600" />
        </div>

        <h1 className="mt-5 text-2xl font-semibold text-slate-900">
          Usuário bloqueado
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Seu acesso à plataforma está inativo. Entre em contato com um administrador.
        </p>
      </div>
    </main>
  );
}