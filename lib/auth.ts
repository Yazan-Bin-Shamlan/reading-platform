import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/** The signed-in user for this request (JWT verified), or null. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
});

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: string | null | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
