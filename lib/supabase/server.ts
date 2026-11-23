import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

/** Per-request server client. Never share one across requests. */
export async function createClient() {
  if (!supabaseConfig) return null;
  const store = await cookies();
  return createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}
