import { createAdminClient } from "@/app/lib/supabase/admin";

/*
 * Avaliação do sistema pelos usuários: fica na tabela audit_logs
 * (module "feedback", new_data { rating, comment }) em vez de uma
 * tabela própria - não exige migração e aparece também na
 * Auditoria. Uma resposta por usuário.
 */

export async function hasAnsweredFeedback(
  userId: string
) {
  const adminDb = createAdminClient();

  const { count } = await adminDb
    .from("audit_logs")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId)
    .eq("module", "feedback");

  return (count ?? 0) > 0;
}
