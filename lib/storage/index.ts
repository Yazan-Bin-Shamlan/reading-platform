import "server-only";
import { isLocalMode } from "@/lib/mode";
import { supabaseConfig, unquote } from "@/lib/supabase/config";
import { localStorageDriver } from "./local";
import { supabaseStorage } from "./supabase";
import type { StorageDriver } from "./types";

export { keys } from "./types";
export type { StorageDriver, UploadTarget } from "./types";

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  // The Supabase integration on Vercel sets SUPABASE_SERVICE_ROLE_KEY (kept in sync, so it wins).
  const secret = unquote(process.env.SUPABASE_SERVICE_ROLE_KEY) ?? unquote(process.env.SUPABASE_SECRET_KEY);
  if (supabaseConfig && secret) driver = supabaseStorage(supabaseConfig.url, secret);
  else if (isLocalMode) driver = localStorageDriver();
  else throw new Error("Storage is not configured: set SUPABASE_SECRET_KEY");
  return driver;
}
