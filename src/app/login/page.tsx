"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";

import { createClient } from "@/app/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<
    "login" | "recover"
  >("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recoverySent, setRecoverySent] =
    useState(false);

  async function handleRecover(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: recoverError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/redefinir-senha`,
          }
        );

      if (recoverError) {
        setError(recoverError.message);
        setLoading(false);
        return;
      }

      setRecoverySent(true);
      setLoading(false);
    } catch {
      setError(
        "Não foi possível enviar o link. Tente novamente."
      );
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

     if (signInError) {
  console.error("Erro Supabase:", signInError);

  setError(signInError.message);
  setLoading(false);

  return;
}

      /*
       * Navegação "hard" (não client-side): garante que o
       * browser faça uma requisição nova para "/" já com o
       * cookie de sessão, e que o middleware renove o token.
       */
      window.location.assign("/");
    } catch {
      setError(
        "Não foi possível acessar o sistema. Tente novamente."
      );
      setLoading(false);
    }
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

          <p className="mt-3 text-sm text-slate-500">
            Plataforma de Gestão
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-10">
          {mode === "recover" ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Recuperar senha
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Informe seu e-mail e enviaremos um link para você criar uma nova senha.
                </p>
              </div>

              {recoverySent ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes. Verifique também a caixa de spam.
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setRecoverySent(false);
                      setError("");
                    }}
                    className="flex h-12 w-full items-center justify-center rounded-xl bg-[#15704f] text-sm font-semibold text-white transition hover:bg-[#105c41]"
                  >
                    Voltar para o login
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleRecover}
                  className="space-y-5"
                >
                  <div>
                    <label
                      htmlFor="recover-email"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      E-mail
                    </label>

                    <input
                      id="recover-email"
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(
                          event.target.value
                        )
                      }
                      autoComplete="email"
                      placeholder="seuemail@empresa.com.br"
                      required
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#15704f] focus:ring-4 focus:ring-[#15704f]/10"
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
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#15704f] text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar link de recuperação"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                    className="block w-full text-center text-sm font-medium text-slate-500 hover:text-slate-900"
                  >
                    Voltar para o login
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Bem-vindo
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Entre com suas credenciais para acessar a plataforma.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    E-mail
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    autoComplete="email"
                    placeholder="seuemail@empresa.com.br"
                    required
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#15704f] focus:ring-4 focus:ring-[#15704f]/10"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Senha
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setMode("recover");
                        setError("");
                      }}
                      className="text-xs font-semibold text-[#15704f] hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    required
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#15704f] focus:ring-4 focus:ring-[#15704f]/10"
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
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#15704f] text-sm font-semibold text-white transition hover:bg-[#105c41] focus:outline-none focus:ring-4 focus:ring-[#15704f]/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Grupo Pulso • Plataforma de Gestão
        </p>
      </div>
    </main>
  );
}