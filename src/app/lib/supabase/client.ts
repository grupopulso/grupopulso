import { createBrowserClient } from "@supabase/ssr";

import { cookieDomainForHost } from "./cookie-domain";

export function createClient() {
  const cookieDomain =
    typeof window !== "undefined"
      ? cookieDomainForHost(
          window.location.host
        )
      : undefined;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    cookieDomain
      ? { cookieOptions: { domain: cookieDomain } }
      : undefined
  );
}
