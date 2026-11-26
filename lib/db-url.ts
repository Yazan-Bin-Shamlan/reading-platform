// Which database address to use. Two setups are supported:
// - our own DATABASE_URL / DIRECT_URL (local mode, or copied from Supabase's Connect dialog);
// - the Supabase integration on Vercel, which sets POSTGRES_PRISMA_URL and friends
//   (https://supabase.com/docs/guides/integrations/vercel-marketplace) and keeps them
//   in sync with the project, so they win when present.
// Shared by prisma.config.ts (migrations) and lib/db.ts (the app). No imports.

type Env = Record<string, string | undefined>;

const isPostgres = (u: string | undefined): u is string => Boolean(u && /^postgres(ql)?:\/\//.test(u.trim()));
const first = (...urls: (string | undefined)[]) => urls.find(isPostgres)?.trim();

/** Supabase's shared pooler, which Vercel reaches over IPv4 on every plan (unlike the direct connection). */
const isSupabasePooler = (u: URL) => u.hostname.endsWith(".pooler.supabase.com");

/**
 * The app's connection: the pooler in transaction mode (port 6543), for
 * serverless functions that open many short connections.
 */
export function appDatabaseUrl(env: Env = process.env): string | undefined {
  const raw = first(env.POSTGRES_PRISMA_URL, env.POSTGRES_URL, env.DATABASE_URL);
  if (!raw) return undefined;
  const url = new URL(raw);
  if (!isSupabasePooler(url)) return raw;
  // node-postgres reads sslmode=require as verify-full, which Supabase's own
  // certificate authority fails; libpq's meaning (encrypted, as Supabase's own
  // strings intend) needs uselibpqcompat. Prisma-only options are dropped.
  for (const k of ["pgbouncer", "supa", "connect_timeout"]) url.searchParams.delete(k);
  if (url.searchParams.has("sslmode")) url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
}

/**
 * The migrations' connection, which needs a session (not transaction mode).
 * With the Supabase integration: the pooler's session mode, same host, port 5432.
 */
export function migrationDatabaseUrl(env: Env = process.env): string | undefined {
  const pooled = first(env.POSTGRES_PRISMA_URL, env.POSTGRES_URL);
  if (pooled) {
    const url = new URL(pooled);
    if (isSupabasePooler(url)) {
      url.port = "5432";
      for (const k of ["pgbouncer", "supa"]) url.searchParams.delete(k);
      return url.toString();
    }
  }
  return first(env.DIRECT_URL, env.POSTGRES_URL_NON_POOLING, env.DATABASE_URL);
}
