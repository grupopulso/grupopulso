import { type NextRequest } from "next/server";

import { updateSession } from "@/app/lib/supabase/proxy-session";

/*
 * Renova a sessão do Supabase (@supabase/ssr) antes de cada
 * rota ser renderizada. Sem isto, quando o token de acesso
 * expira o Server Component não consegue persistir a sessão
 * renovada — o usuário fica preso no login ou o carregamento
 * trava tentando renovar a cada request.
 */
export async function proxy(
  request: NextRequest
) {
  return await updateSession(request);
}

export const config = {
  /*
   * Roda em tudo, menos assets estáticos e os ícones.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
