import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MAX_UPLOAD_BYTES } from "@/lib/limits";
import type { StorageDriver } from "./types";

const BUCKET = "library";

export function supabaseStorage(url: string, secretKey: string): StorageDriver {
  const client: SupabaseClient = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = () => client.storage.from(BUCKET);

  // Create the private bucket on first use, so setup needs no dashboard clicks;
  // a bucket made before a file type was added gets that type too.
  let ready: Promise<void> | null = null;
  const options = { public: false, fileSizeLimit: MAX_UPLOAD_BYTES, allowedMimeTypes: ["application/pdf", "image/jpeg", "audio/wav"] };
  const ensureBucket = () =>
    (ready ??= (async () => {
      const { data } = await client.storage.getBucket(BUCKET);
      if (data) {
        if (!options.allowedMimeTypes.every((t) => data.allowed_mime_types?.includes(t))) {
          await client.storage.updateBucket(BUCKET, options);
        }
        return;
      }
      const { error } = await client.storage.createBucket(BUCKET, options);
      if (error && !/already exists/i.test(error.message)) {
        ready = null;
        throw error;
      }
    })());

  const check = <T>(res: { data: T | null; error: Error | null }): T => {
    if (res.error) throw res.error;
    return res.data as T;
  };

  return {
    name: "supabase",
    async createUpload(key, contentType) {
      await ensureBucket();
      const { signedUrl } = check(await bucket().createSignedUploadUrl(key));
      return { url: signedUrl, headers: { "content-type": contentType, "x-upsert": "false" } };
    },
    async readUrl(key, expiresIn = 3600) {
      return check(await bucket().createSignedUrl(key, expiresIn)).signedUrl;
    },
    async readUrls(keyList, expiresIn = 3600) {
      if (!keyList.length) return {};
      const rows = check(await bucket().createSignedUrls(keyList, expiresIn));
      const out: Record<string, string> = {};
      for (const r of rows) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
      return out;
    },
    async read(key) {
      const blob = check(await bucket().download(key));
      return new Uint8Array(await blob.arrayBuffer());
    },
    async write(key, bytes, contentType) {
      await ensureBucket();
      check(await bucket().upload(key, bytes, { contentType, upsert: true }));
    },
    async move(from, to) {
      check(await bucket().move(from, to));
    },
    async exists(key) {
      const { data } = await bucket().exists(key);
      return Boolean(data);
    },
    async remove(keyList) {
      if (keyList.length) check(await bucket().remove(keyList));
    },
  };
}
