import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/app/lib/supabase/admin";
import { reassignInactiveUser } from "@/app/lib/reassign-inactive-user";

/*
 * Roda todo dia 1º (ver vercel.json) e reatribui automaticamente
 * os contratos/vendas de quem já passou o mês de saída — reforço
 * do botão manual em Configurações → Auditoria → Usuários
 * inativos, pra ninguém esquecer de clicar.
 */
export async function GET(
  request: NextRequest
) {
  const authHeader =
    request.headers.get(
      "authorization"
    );

  if (
    !process.env.CRON_SECRET ||
    authHeader !==
      `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 }
    );
  }

  const adminDb = createAdminClient();

  const { data: candidates } =
    await adminDb
      .from("user_profiles")
      .select("id")
      .eq("active", false)
      .not(
        "deactivated_at",
        "is",
        null
      )
      .is("reassigned_at", null);

  const results: Record<
    string,
    unknown
  > = {};

  for (const candidate of candidates ??
    []) {
    results[candidate.id] =
      await reassignInactiveUser(
        adminDb,
        candidate.id
      );
  }

  return NextResponse.json({
    processed: Object.keys(results)
      .length,
    results,
  });
}
