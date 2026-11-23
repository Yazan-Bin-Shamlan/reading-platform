import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { isLocalMode, LOCAL_USER } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/** The signed-in user for this request (JWT verified), or null. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  if (isLocalMode) return LOCAL_USER;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
});

/** For route handlers: the user (with a Profile row guaranteed), or null. */
export async function requireUser(): Promise<SessionUser | null> {
  const user = await getUser();
  if (!user) return null;
  await ensureProfile(user.id);
  return user;
}

const knownProfiles = new Set<string>();
export async function ensureProfile(id: string, displayName?: string | null) {
  if (knownProfiles.has(id)) return;
  await db.profile.upsert({ where: { id }, create: { id, displayName }, update: {} });
  knownProfiles.add(id);
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: string | null | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
