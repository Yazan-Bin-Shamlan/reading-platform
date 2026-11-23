// Page layout math for the virtualized reader. Pure, unit-tested.

export type Size = { w: number; h: number };

export type Layout = {
  tops: number[];
  widths: number[];
  heights: number[];
  total: number;
};

/**
 * Stacks pages vertically. Pages whose real size isn't known yet use the
 * first page's size, which is right for almost every PDF.
 */
export function computeLayout(
  count: number,
  base: Size,
  known: ReadonlyMap<number, Size>,
  scale: number,
  gap: number,
): Layout {
  const tops = new Array<number>(count);
  const widths = new Array<number>(count);
  const heights = new Array<number>(count);
  let y = 0;
  for (let i = 0; i < count; i++) {
    const s = known.get(i) ?? base;
    tops[i] = y;
    widths[i] = Math.round(s.w * scale);
    heights[i] = Math.round(s.h * scale);
    y += heights[i] + gap;
  }
  return { tops, widths, heights, total: Math.max(0, y - gap) };
}

/** Index of the page at vertical position y (clamped). */
export function pageAt(layout: Layout, y: number): number {
  const { tops } = layout;
  let lo = 0;
  let hi = tops.length - 1;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tops[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Pages to keep mounted: everything on screen plus a few either side. */
export function visibleRange(layout: Layout, top: number, bottom: number, overscan = 2): [number, number] {
  const n = layout.tops.length;
  if (!n) return [0, -1];
  return [Math.max(0, pageAt(layout, top) - overscan), Math.min(n - 1, pageAt(layout, bottom) + overscan)];
}

/** A scroll position as (page, fraction of that page), stable across zoom and resize. */
export function anchorAt(layout: Layout, y: number): { page: number; offset: number } {
  const page = pageAt(layout, y);
  const h = layout.heights[page] || 1;
  return { page, offset: Math.min(1, Math.max(0, (y - layout.tops[page]) / h)) };
}

export function positionOf(layout: Layout, anchor: { page: number; offset: number }): number {
  const page = Math.min(Math.max(0, anchor.page), layout.tops.length - 1);
  return (layout.tops[page] ?? 0) + (layout.heights[page] ?? 0) * anchor.offset;
}
