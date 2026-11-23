import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

export function createClient() {
  if (!supabaseConfig) throw new Error("Supabase is not configured");
  return createBrowserClient(supabaseConfig.url, supabaseConfig.key);
}
