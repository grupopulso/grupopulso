import Link from "next/link";

import {
  ArrowLeft,
  UserX,
} from "lucide-react";

import { createAdminClient } from "@/app/lib/supabase/admin";
import { requireAdmin } from "@/app/lib/permissions";

import ReassignButton from "./reassign-button";

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(new Date(value));
}

export default async function UsuariosInativosPage() {
  await requireAdmin();

  /*
   * Via service role: página já restrita a admin acima.
   */
  const adminDb = createAdminClient();

  const { data: inactiveUsers } =
    await adminDb
      .from("user_profiles")
      .select(`
        id,
        name,
        role,
        deactivated_at,
        reassigned_at
      `)
      .eq("active", false)
      .order("deactivated_at", {
        ascending: false,
      });

  const users = inactiveUsers ?? [];

  const userIds = users.map(
    (user) => user.id
  );

  const { data: reassignLogs } =
    userIds.length > 0
      ? await adminDb
          .from("audit_logs")
          .select(
            "entity_id, description, new_data, created_at"
          )
          .eq("entity_type", "user")
          .in("entity_id", userIds)
          .ilike(
            "description",
            "%foram reatribuídos%"
          )
          .order("created_at", {
            ascending: false,
          })
      : { data: [] };

  const reassignLogByUserId = new Map<
    string,
    {
      contractsMoved: number;
      salesMoved: number;
      createdAt: string;
    }
  >();

  for (const log of reassignLogs ??
    []) {
    if (
      !log.entity_id ||
      reassignLogByUserId.has(
        log.entity_id
      )
    ) {
      continue;
    }

    const data =
      (log.new_data as {
        contractsMoved?: number;
        salesMoved?: number;
      }) ?? {};

    reassignLogByUserId.set(
      log.entity_id,
      {
        contractsMoved:
          data.contractsMoved ?? 0,
        salesMoved:
          data.salesMoved ?? 0,
        createdAt:
          log.created_at,
      }
    );
  }

  const now = new Date();

  const startOfCurrentMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/configuracoes/seguranca/auditoria"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Auditoria
        </Link>

        <div className="mt-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
            <UserX className="h-5 w-5 text-red-600" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Usuários inativos
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Quando um usuário é desativado, ele continua
              arquivado aqui (nada é excluído). A partir do mês
              seguinte à saída, os contratos e vendas dele podem
              ser reatribuídos para o vendedor da empresa
              correspondente.
            </p>
          </div>
        </div>

        <div className="mt-7 space-y-3">
          {users.map((user) => {
            const deactivatedAt =
              user.deactivated_at
                ? new Date(
                    user.deactivated_at
                  )
                : null;

            const eligible =
              Boolean(
                deactivatedAt &&
                  deactivatedAt <
                    startOfCurrentMonth
              );

            const reassignInfo =
              reassignLogByUserId.get(
                user.id
              );

            return (
              <div
                key={user.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {user.name ??
                        "Usuário"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Saiu em{" "}
                      {formatDate(
                        user.deactivated_at
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {user.reassigned_at ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        Reatribuído em{" "}
                        {formatDate(
                          user.reassigned_at
                        )}
                      </span>
                    ) : eligible ? (
                      <ReassignButton
                        userId={
                          user.id
                        }
                      />
                    ) : (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Reatribuição disponível a partir do mês
                        seguinte
                      </span>
                    )}
                  </div>
                </div>

                {reassignInfo && (
                  <p className="mt-3 text-xs text-slate-500">
                    {
                      reassignInfo.contractsMoved
                    }{" "}
                    contrato(s) e{" "}
                    {
                      reassignInfo.salesMoved
                    }{" "}
                    venda(s) de edição foram
                    reatribuídos para o vendedor
                    da empresa correspondente.
                  </p>
                )}
              </div>
            );
          })}

          {users.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
              Nenhum usuário inativo.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
