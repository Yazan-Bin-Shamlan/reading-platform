import { describe, expect, it } from "vitest";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

const keys = (o: object, prefix = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe("UI messages", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it("no message is empty", () => {
    const empty = (o: object): boolean =>
      Object.values(o).some((v) => (typeof v === "object" ? empty(v) : String(v).trim() === ""));
    expect(empty(ar)).toBe(false);
    expect(empty(en)).toBe(false);
  });
});
