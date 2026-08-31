import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

/*
 * Cliente administrativo do Supabase (service role).
 *
 * IMPORTANTE: só pode ser usado em código de servidor
 * (Server Actions / Route Handlers). A chave nunca pode
 * chegar a um Client Component.
 *
 * Ignora RLS — sempre proteja a chamada antes com um
 * `require*` de permissão da aplicação.
 */
export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "As credenciais administrativas do Supabase não estão configuradas."
    );
  }

  return createSupabaseAdminClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
