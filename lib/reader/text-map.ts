// Converts between positions in a page's reflowed text and pdf.js text items
// (the spans of the Original view's text layer). See MapRun in lib/text/reflow.ts.
import type { MapRun } from "@/lib/text/reflow";

/** Text offset of character `ci` of item `item`, or the nearest mapped offset in that item. */
export function itemToText(map: MapRun[], item: number, ci: number): number | null {
  let best: { d: number; at: number } | null = null;
  for (const [ts, it, is, len] of map) {
    if (it !== item) continue;
    if (ci >= is && ci <= is + len) return ts + (ci - is);
    const d = ci < is ? is - ci : ci - (is + len);
    const at = ci < is ? ts : ts + len;
    if (!best || d < best.d) best = { d, at };
  }
  return best?.at ?? null;
}

/** The item character ranges covering text [start, end). */
export function textToItems(map: MapRun[], start: number, end: number) {
  const out: { item: number; start: number; end: number }[] = [];
  for (const [ts, item, is, len] of map) {
    const s = Math.max(start, ts);
    const e = Math.min(end, ts + len);
    if (s < e) out.push({ item, start: is + (s - ts), end: is + (e - ts) });
  }
  return out;
}
