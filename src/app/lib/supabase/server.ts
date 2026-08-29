import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { cookieDomainForHost } from "./cookie-domain";

export async function createClient() {
  const cookieStore = await cookies();

  let cookieDomain: string | undefined;
  try {
    const headerStore = await headers();
    cookieDomain = cookieDomainForHost(
      headerStore.get("host")
    );
  } catch {
    cookieDomain = undefined;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                ...(cookieDomain
                  ? { domain: cookieDomain }
                  : {}),
              });
            });
          } catch {
            // Em Server Components os cookies podem ser somente leitura.
          }
        },
      },
    }
  );
}
