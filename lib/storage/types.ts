/** Where the browser should PUT a file (raw body) to upload it. */
export type UploadTarget = { url: string; headers: Record<string, string> };

export interface StorageDriver {
  readonly name: "supabase" | "local";
  createUpload(key: string, contentType: string): Promise<UploadTarget>;
  readUrl(key: string, expiresInSec?: number): Promise<string>;
  readUrls(keys: string[], expiresInSec?: number): Promise<Record<string, string>>;
  read(key: string): Promise<Uint8Array>;
  write(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  remove(keys: string[]): Promise<void>;
}

/** Object key layout. Content is stored once per sha256. */
export const keys = {
  incoming: (userId: string, id: string) => `incoming/${userId}/${id}.pdf`,
  content: (sha256: string) => `content/${sha256}.pdf`,
  cover: (sha256: string) => `covers/${sha256}.jpg`,
};
