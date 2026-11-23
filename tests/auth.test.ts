import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => null }));
const { safeNext } = await import("@/lib/auth");

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/ar/library", "/")).toBe("/ar/library");
  });
  it("rejects other sites", () => {
    expect(safeNext("https://evil.example", "/")).toBe("/");
    expect(safeNext("//evil.example", "/")).toBe("/");
    expect(safeNext(null, "/en")).toBe("/en");
  });
});
