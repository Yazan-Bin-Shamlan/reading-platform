import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { StorageDriver } from "./types";

/** Local mode only: files under .local/storage, served by /api/storage/local. */
export const LOCAL_ROOT = resolve(process.cwd(), ".local", "storage");

// One secret per process, shared by every bundle that loads this module (Next
// keeps separate module copies for pages and route handlers). Links stop working
// when the dev server restarts, which is fine locally.
const g = globalThis as unknown as { __localStorageSecret?: Buffer };
const secret = (g.__localStorageSecret ??= randomBytes(32));

export function sign(action: "get" | "put", key: string, exp: number) {
  return createHmac("sha256", secret).update(`${action}:${key}:${exp}`).digest("base64url");
}

export function verify(action: "get" | "put", key: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const a = Buffer.from(sign(action, key, exp));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function localPath(key: string) {
  const path = resolve(LOCAL_ROOT, key);
  if (!path.startsWith(LOCAL_ROOT + "/")) throw new Error("Invalid key");
  return path;
}

const link = (action: "get" | "put", key: string, expiresIn: number) => {
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const q = new URLSearchParams({ key, exp: String(exp), sig: sign(action, key, exp) });
  return `/api/storage/local?${q}`;
};

export function localStorageDriver(): StorageDriver {
  return {
    name: "local",
    async createUpload(key, contentType) {
      return { url: link("put", key, 7200), headers: { "content-type": contentType } };
    },
    async readUrl(key, expiresIn = 3600) {
      return link("get", key, expiresIn);
    },
    async readUrls(keyList, expiresIn = 3600) {
      return Object.fromEntries(keyList.map((k) => [k, link("get", k, expiresIn)]));
    },
    read: (key) => readFile(localPath(key)).then((b) => new Uint8Array(b)),
    async write(key, bytes) {
      const path = localPath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    },
    async move(from, to) {
      const dest = localPath(to);
      await mkdir(dirname(dest), { recursive: true });
      await rename(localPath(from), dest);
    },
    exists: (key) => access(localPath(key)).then(() => true, () => false),
    async remove(keyList) {
      await Promise.all(keyList.map((k) => rm(localPath(k), { force: true })));
    },
  };
}

