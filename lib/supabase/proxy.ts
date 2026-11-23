import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseConfig } from "./config";

type PendingCookie = { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * Refreshes the Supabase session for this request. Refreshed cookies are
 * written onto the request (so Server Components see them) and returned so
 * the caller can copy them, plus no-cache headers, onto whatever response it
 * builds.
 */
export async function refreshSession(request: NextRequest) {
  const pending: PendingCookie[] = [];
  let headers: Record<string, string> = {};

  if (!supabaseConfig) return { userId: null, configured: false, apply: (r: NextResponse) => r };

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        pending.push(...cookiesToSet);
        headers = cacheHeaders ?? {};
      },
    },
  });

  // Nothing may run between creating the client and this call.
  const { data } = await supabase.auth.getClaims();

  return {
    userId: (data?.claims?.sub as string | undefined) ?? null,
    configured: true,
    apply(response: NextResponse) {
      pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    },
  };
}
