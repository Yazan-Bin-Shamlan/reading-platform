import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

// Every request to a source goes through here: one queue per host with the
// spacing that source asks for, an identifying User-Agent, timeouts, and
// backing off on 429/503.

export const USER_AGENT = `QiraaReader/0.1 (${process.env.APP_CONTACT || "contact not set"})`;

/** Minimum gap between requests to a host, in ms. arXiv: one request every 3 seconds, one at a time. */
const SPACING: Record<string, number> = {
  "export.arxiv.org": 3100,
  "oaipmh.arxiv.org": 3100,
  "arxiv.org": 3100,
  "gutendex.com": 500,
  "www.gutenberg.org": 1000,
  "directory.doabooks.org": 1000,
  "api.openalex.org": 150,
  "sites.dlib.nyu.edu": 300,
  "mc.dlib.nyu.edu": 300,
  "archive.org": 500,
  "www.ebi.ac.uk": 200,
  // Open Library: 1 request a second, or 3 when the User-Agent carries a contact.
  "openlibrary.org": process.env.APP_CONTACT ? 350 : 1000,
};
const DEFAULT_SPACING = 250;
/** Longest wait before a retry; a source asking for more is treated as down. */
const MAX_RETRY_WAIT_MS = 10_000;
/** How long a source that timed out or couldn't be reached is skipped. */
const DOWN_AFTER_FAILURE_MS = 60_000;
/** The most a source's own Retry-After can keep it skipped. */
const MAX_DOWN_MS = 15 * 60_000;

export class SourceError extends Error {
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`Source request failed (${status}): ${url}`);
  }
}

const queues = new Map<string, { chain: Promise<unknown>; last: number }>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sources that are down (maintenance, timeouts), and until when. Requests to
 * them fail at once instead of each waiting out a timeout, so pages that ask
 * them stay fast and show what they have.
 */
const downUntil = new Map<string, number>();
export const isDown = (host: string) => (downUntil.get(host) ?? 0) > Date.now();
const markDown = (host: string, ms: number) => downUntil.set(host, Date.now() + Math.min(ms, MAX_DOWN_MS));

/** Runs `fn` in the host's queue, after the host's spacing since the previous request. */
function inQueue<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const q = queues.get(host) ?? { chain: Promise.resolve(), last: 0 };
  queues.set(host, q);
  const run = q.chain.then(async () => {
    const wait = q.last + (SPACING[host] ?? DEFAULT_SPACING) - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      q.last = Date.now();
    }
  });
  q.chain = run.catch(() => {});
  return run;
}

export async function sourceFetch(
  url: string,
  {
    timeoutMs = 20_000,
    accept = "application/json",
    retries = 2,
    headers = {},
  }: { timeoutMs?: number; accept?: string; retries?: number; headers?: Record<string, string> } = {},
): Promise<Response> {
  const host = new URL(url).host;
  for (let attempt = 0; ; attempt++) {
    const res = await inQueue(host, () => {
      // Checked in the queue, so requests already waiting behind a failed one don't try again.
      if (isDown(host)) throw new SourceError(503, url);
      return fetch(url, {
        headers: { "user-agent": USER_AGENT, accept, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      }).catch((e) => {
        markDown(host, DOWN_AFTER_FAILURE_MS);
        throw e;
      });
    });
    if (res.status === 429 || res.status === 503) {
      const after = Number(res.headers.get("retry-after")) * 1000;
      const wait = after > 0 ? after : 2000 * 2 ** attempt;
      // "Back in six hours" (maintenance): don't wait, and don't ask again until then.
      if (wait > MAX_RETRY_WAIT_MS) markDown(host, wait);
      else if (attempt < retries) {
        await sleep(wait);
        continue;
      }
    }
    if (!res.ok) throw new SourceError(res.status, url);
    return res;
  }
}

export const getJson = async <T>(url: string, timeoutMs?: number) => (await sourceFetch(url, { timeoutMs })).json() as Promise<T>;
export const getText = async (url: string, accept = "application/xml") => (await sourceFetch(url, { accept })).text();

/** A source response cached in the database for `ttlSeconds`, so repeated queries don't hit the source. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const id = cacheId(key);
  const hit = await db.sourceCache.findUnique({ where: { key: id } });
  if (hit && hit.expiresAt > new Date()) return hit.body as T;
  const body = await load();
  await store(id, body, ttlSeconds);
  return body;
}

const cacheId = (key: string) => createHash("sha256").update(key).digest("hex");
const store = (id: string, body: unknown, ttlSeconds: number) => {
  const data = { body: body as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  return db.sourceCache.upsert({ where: { key: id }, create: { key: id, ...data }, update: data }).catch(() => {});
};

/**
 * Like `cached`, for things a page shows but shouldn't wait for (Explore's shelves):
 * an expired copy is served at once and refreshed after the response; a load
 * that fails is remembered as `fallback` for `failSeconds`, so the next visits
 * don't wait on a source that's down; and the caller waits at most `waitMs`,
 * the load finishing in the background for the next visitor.
 */
export async function cachedStale<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
  { fallback, failSeconds = 600, waitMs }: { fallback: T; failSeconds?: number; waitMs: number },
): Promise<T> {
  const id = cacheId(key);
  const hit = await db.sourceCache.findUnique({ where: { key: id } });
  const refresh = () =>
    load().then(
      (body) => store(id, body, ttlSeconds).then(() => body),
      (e) => {
        // Keep what we had (or the fallback), and don't ask again for a while.
        void store(id, hit ? hit.body : fallback, failSeconds);
        throw e;
      },
    );
  if (hit && hit.expiresAt > new Date()) return hit.body as T;
  if (hit) {
    after(() => refresh().catch(() => {}));
    return hit.body as T;
  }
  const running = refresh();
  after(() => running.catch(() => {}));
  return Promise.race([running, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), waitMs))]).catch(() => fallback);
}
