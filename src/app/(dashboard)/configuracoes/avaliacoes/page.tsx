import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { createAdminClient } from "@/app/lib/supabase/admin";
import { requireAdmin } from "@/app/lib/permissions";
import { FEEDBACK_MODULES } from "@/app/lib/feedback-modules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FeedbackLog = {
  id: string;
  user_id: string | null;
  created_at: string;
  new_data: {
    ratings?: Record<string, number>;
    comment?: string | null;
  } | null;
};

function formatAverage(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function barColor(average: number) {
  if (average >= 4) return "bg-emerald-500";
  if (average >= 3) return "bg-amber-400";
  return "bg-red-400";
}

export default async function AvaliacoesPage() {
  await requireAdmin();

  const adminDb = createAdminClient();

  const { data } = await adminDb
    .from("audit_logs")
    .select("id, user_id, created_at, new_data")
    .eq("module", "feedback")
    .order("created_at", {
      ascending: false,
    });

  const logs = (data ?? []) as FeedbackLog[];

  const userIds = Array.from(
    new Set(
      logs
        .map((log) => log.user_id)
        .filter((id): id is string =>
          Boolean(id)
        )
    )
  );

  const { data: profiles } =
    userIds.length > 0
      ? await adminDb
          .from("user_profiles")
          .select("id, name")
          .in("id", userIds)
      : { data: [] };

  const nameById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.name ?? "Usuário",
    ])
  );

  /*
   * Média por módulo: só conta quem deu nota de 1 a 5 (0 = não usa
   * o módulo, fica de fora).
   */
  const moduleStats = FEEDBACK_MODULES.map(
    (item) => {
      const values = logs
        .map((log) =>
          Number(
            log.new_data?.ratings?.[
              item.key
            ] ?? 0
          )
        )
        .filter((value) => value >= 1);

      return {
        key: item.key,
        label: item.label,
        count: values.length,
        average: values.length
          ? values.reduce(
              (sum, value) => sum + value,
              0
            ) / values.length
          : null,
      };
    }
  );

  const comments = logs.filter((log) =>
    log.new_data?.comment?.trim()
  );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/configuracoes/seguranca/auditoria"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <h1 className="mt-5 text-2xl font-semibold text-slate-900">
          Avaliações do sistema
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {logs.length} resposta(s) da janela de
          avaliação que aparece ao entrar. Nota de
          0 a 5 por módulo (quem dá 0 não usa o
          módulo e fica fora da média).
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">
            Média por módulo
          </h2>

          <div className="mt-4 space-y-3">
            {moduleStats.map((stat) => (
              <div
                key={stat.key}
                className="flex items-center gap-3 text-sm"
              >
                <span className="w-44 shrink-0 text-slate-700">
                  {stat.label}
                </span>

                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  {stat.average !== null && (
                    <div
                      className={`h-full rounded-full ${barColor(
                        stat.average
                      )}`}
                      style={{
                        width: `${
                          (stat.average / 5) *
                          100
                        }%`,
                      }}
                    />
                  )}
                </div>

                <span className="w-24 shrink-0 text-right font-semibold text-slate-900">
                  {stat.average !== null
                    ? formatAverage(
                        stat.average
                      )
                    : "—"}

                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({stat.count})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              O que podemos melhorar
            </h2>
          </div>

          {comments.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">
              {logs.length === 0
                ? "Ninguém respondeu ainda. A janela aparece na próxima vez que cada usuário entrar."
                : "Nenhum comentário escrito ainda."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {comments.map((log) => (
                <li
                  key={log.id}
                  className="px-6 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {log.user_id
                        ? nameById.get(
                            log.user_id
                          ) ?? "Usuário"
                        : "—"}
                    </p>

                    <span className="text-xs text-slate-400">
                      {new Date(
                        log.created_at
                      ).toLocaleDateString(
                        "pt-BR"
                      )}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {log.new_data?.comment}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {logs.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Notas de cada pessoa
              </h2>
            </div>

            <ul className="divide-y divide-slate-100">
              {logs.map((log) => {
                const given = FEEDBACK_MODULES.filter(
                  (item) =>
                    log.new_data?.ratings?.[
                      item.key
                    ] !== undefined
                );

                return (
                  <li
                    key={log.id}
                    className="px-6 py-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {log.user_id
                        ? nameById.get(
                            log.user_id
                          ) ?? "Usuário"
                        : "—"}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {given.map((item) => {
                        const value = Number(
                          log.new_data
                            ?.ratings?.[
                            item.key
                          ] ?? 0
                        );

                        return (
                          <span
                            key={item.key}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              value === 0
                                ? "bg-slate-100 text-slate-400"
                                : value >= 4
                                  ? "bg-emerald-50 text-emerald-700"
                                  : value >= 3
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                            }`}
                          >
                            {item.label}:{" "}
                            {value === 0
                              ? "não usa"
                              : value}
                          </span>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
