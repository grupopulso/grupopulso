"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { createClient } from "@/app/lib/supabase/client";

type Stage =
  | "checking"
  | "form"
  | "invalid"
  | "done";

export default function RedefinirSenhaPage() {
  const [stage, setStage] =
    useState<Stage>("checking");

  const [password, setPassword] =
    useState("");
  const [confirm, setConfirm] =
    useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      try {
        const url = new URL(
          window.location.href
        );
        const code =
          url.searchParams.get("code");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(
              code
            );

          if (exchangeError) {
            setStage("invalid");
            return;
          }
        }

        const { data } =
          await supabase.auth.getSession();

        setStage(
          data.session ? "form" : "invalid"
        );
      } catch {
        setStage("invalid");
      }
    }

    init();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(
        "A senha precisa ter pelo menos 6 caracteres."
      );
      return;
    }

    if (password !== confirm) {
      setError(
        "As senhas não coincidem."
      );
      return;
    }

    setSaving(true);

    const supabase = createClient();

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setStage("done");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f6] px-4">
      <div className="w-full max-w-[430px]">
        <div className="mb-9 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#15704f]">
            Grupo
          </p>

          <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#17211e]">
            PULSO
          </h1>
        </div>

        <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-10">
          {stage === "checking" && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando o link...
            </div>
          )}

          {stage === "invalid" && (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                Link inválido ou expirado
              </h2>

              <p className="text-sm leading-6 text-slate-500">
                Peça um novo link de recuperação na tela de login.
              </p>

              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
              >
                Voltar para o login
              </Link>
            </div>
          )}

          {stage === "done" && (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                Senha alterada
              </h2>

              <p className="text-sm leading-6 text-slate-500">
                Sua nova senha já está valendo.
              </p>

              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41]"
              >
                Entrar
              </Link>
            </div>
          )}

          {stage === "form" && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Nova senha
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Defina a senha que você vai usar para entrar.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Nova senha
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#15704f] focus:ring-4 focus:ring-[#15704f]/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Confirmar senha
                  </label>

                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(event) =>
                      setConfirm(
                        event.target.value
                      )
                    }
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#15704f] focus:ring-4 focus:ring-[#15704f]/10"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#15704f] text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar nova senha"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
