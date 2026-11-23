import { describe, expect, it } from "vitest";
import { anchorAt, computeLayout, pageAt, positionOf, visibleRange } from "@/lib/reader/layout";

const base = { w: 600, h: 800 };

describe("reader layout", () => {
  it("stacks pages with gaps", () => {
    const l = computeLayout(3, base, new Map(), 1, 20);
    expect(l.tops).toEqual([0, 820, 1640]);
    expect(l.total).toBe(2440);
  });

  it("uses known sizes for odd pages", () => {
    const l = computeLayout(3, base, new Map([[1, { w: 800, h: 600 }]]), 0.5, 10);
    expect(l.heights).toEqual([400, 300, 400]);
    expect(l.widths[1]).toBe(400);
    expect(l.tops[2]).toBe(400 + 10 + 300 + 10);
  });

  it("finds the page at a position", () => {
    const l = computeLayout(500, base, new Map(), 1, 20);
    expect(pageAt(l, 0)).toBe(0);
    expect(pageAt(l, 819)).toBe(0);
    expect(pageAt(l, 820)).toBe(1);
    expect(pageAt(l, 1e9)).toBe(499);
  });

  it("only mounts nearby pages", () => {
    const l = computeLayout(500, base, new Map(), 1, 20);
    expect(visibleRange(l, 82000, 83000)).toEqual([98, 103]);
  });

  it("round-trips an anchor across zoom levels", () => {
    const a = computeLayout(100, base, new Map(), 1, 20);
    const anchor = anchorAt(a, a.tops[42] + 200);
    expect(anchor).toEqual({ page: 42, offset: 0.25 });
    const b = computeLayout(100, base, new Map(), 1.5, 20);
    expect(positionOf(b, anchor)).toBe(b.tops[42] + 300);
  });
});
