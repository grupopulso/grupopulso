import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { cookieDomainForHost } from "./cookie-domain";

/*
 * @supabase/ssr precisa de um proxy (antigo "middleware") que
 * rode auth.getUser() em toda requisição para renovar o token de
 * acesso e reescrever os cookies. Sem isso, quando o token expira
 * o Server Component não consegue persistir a sessão renovada e o
 * usuário fica preso na tela de login (ou o carregamento trava
 * tentando renovar a cada request).
 *
 * Este proxy NÃO redireciona — quem decide acesso é cada página
 * (requireAuthenticatedUser / requireModulePermission).
 */
export async function updateSession(
  request: NextRequest
) {
  let response = NextResponse.next({
    request,
  });

  const cookieDomain = cookieDomainForHost(
    request.headers.get("host")
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(name, value, {
                ...options,
                ...(cookieDomain
                  ? { domain: cookieDomain }
                  : {}),
              });
            }
          );
        },
      },
    }
  );

  // Renova o token (efeito colateral necessário).
  await supabase.auth.getUser();

  return response;
}
