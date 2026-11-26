import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = { key: string; body: unknown; expiresAt: Date };
const rows = new Map<string, Row>();
const background: Promise<unknown>[] = [];

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => Promise<unknown>) => background.push(fn()) }));
vi.mock("@/lib/db", () => ({
  db: {
    sourceCache: {
      findUnique: async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null,
      upsert: async ({ where, create }: { where: { key: string }; create: Row }) => rows.set(where.key, { ...create, key: where.key }),
    },
  },
}));

const { cachedStale } = await import("@/lib/sources/http");
const settle = () => Promise.allSettled(background.splice(0));
const opts = { fallback: [] as string[], waitMs: 50 };

beforeEach(() => rows.clear());
afterEach(() => vi.useRealTimers());

describe("cachedStale", () => {
  it("loads and caches on the first visit, then serves the cache", async () => {
    const load = vi.fn(async () => ["a"]);
    expect(await cachedStale("k", 60, load, opts)).toEqual(["a"]);
    await settle();
    expect(await cachedStale("k", 60, load, opts)).toEqual(["a"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("doesn't wait for a slow load, which fills the cache for the next visit", async () => {
    let finish!: (v: string[]) => void;
    const load = () => new Promise<string[]>((r) => (finish = r));
    expect(await cachedStale("slow", 60, load, opts)).toEqual([]);
    finish(["late"]);
    await settle();
    expect(await cachedStale("slow", 60, load, opts)).toEqual(["late"]);
  });

  it("remembers a failure, so the next visits don't ask the source again", async () => {
    const load = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await cachedStale("down", 60, load, opts)).toEqual([]);
    await settle();
    expect(await cachedStale("down", 60, load, opts)).toEqual([]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves an expired copy at once and refreshes it in the background", async () => {
    await cachedStale("old", 60, async () => ["v1"], opts);
    await settle();
    rows.forEach((r) => (r.expiresAt = new Date(0)));
    expect(await cachedStale("old", 60, async () => ["v2"], opts)).toEqual(["v1"]);
    await settle();
    expect(await cachedStale("old", 60, async () => ["v3"], opts)).toEqual(["v2"]);
  });
});
