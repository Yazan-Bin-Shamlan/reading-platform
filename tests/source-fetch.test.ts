import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const { isDown, sourceFetch, SourceError } = await import("@/lib/sources/http");

afterEach(() => vi.unstubAllGlobals());

describe("sources that are down", () => {
  it("doesn't wait out a long Retry-After, and skips the source until then", async () => {
    const fetch = vi.fn(async () => new Response("Down for maintenance", { status: 503, headers: { "retry-after": "21600" } }));
    vi.stubGlobal("fetch", fetch);
    const started = Date.now();
    await expect(sourceFetch("https://maintenance.test/books/1/")).rejects.toBeInstanceOf(SourceError);
    await expect(sourceFetch("https://maintenance.test/books/2/")).rejects.toBeInstanceOf(SourceError);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(isDown("maintenance.test")).toBe(true);
  });

  it("skips a source for a while after it times out", async () => {
    const fetch = vi.fn(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    vi.stubGlobal("fetch", fetch);
    await expect(sourceFetch("https://hanging.test/a")).rejects.toThrow();
    await expect(sourceFetch("https://hanging.test/b")).rejects.toBeInstanceOf(SourceError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("still retries a short Retry-After", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0.05" } }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const res = await sourceFetch("https://busy.test/x");
    expect(await res.json()).toEqual({ ok: true });
    expect(isDown("busy.test")).toBe(false);
  });
});
