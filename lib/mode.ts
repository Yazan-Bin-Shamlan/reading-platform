import { supabaseConfig } from "@/lib/supabase/config";

/**
 * Local mode: no Supabase keys, running `next dev`. A fixed local user, a
 * local Postgres and files on disk stand in, so everything can be tried
 * before a Supabase project exists. Never active in production builds.
 */
export const isLocalMode = !supabaseConfig && process.env.NODE_ENV === "development";

export const LOCAL_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "local@qiraa.dev",
} as const;
