import "server-only";
import { isLocalMode } from "@/lib/mode";
import { supabaseConfig } from "@/lib/supabase/config";
import { localStorageDriver } from "./local";
import { supabaseStorage } from "./supabase";
import type { StorageDriver } from "./types";

export { keys } from "./types";
export type { StorageDriver, UploadTarget } from "./types";

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (supabaseConfig && secret) driver = supabaseStorage(supabaseConfig.url, secret);
  else if (isLocalMode) driver = localStorageDriver();
  else throw new Error("Storage is not configured: set SUPABASE_SECRET_KEY");
  return driver;
}
