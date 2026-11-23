import type { RawTerm, Term } from "@/lib/ai/schemas";
import { fold } from "@/lib/text/search";
import type { Block } from "@/lib/text/reflow";

const LETTER = /[\p{L}\p{N}\p{M}]/u;
const MARK = /[\p{M}\u0640]/u;

/** Moves an end offset past diacritics and tatweel that belong to the last letter. */
const withMarks = (text: string, e: number) => {
  while (e < text.length && MARK.test(text[e])) e++;
  return e;
};

/** Index of `needle` in text[from, to) at word boundaries, or -1. */
function findWord(text: string, needle: string, from: number, to: number): number {
  for (let at = text.indexOf(needle, from); at !== -1 && at + needle.length <= to; at = text.indexOf(needle, at + 1)) {
    const before = text[at - 1] ?? " ";
    const after = text[withMarks(text, at + needle.length)] ?? " ";
    if (!LETTER.test(before) && !LETTER.test(after)) return at;
  }
  return -1;
}

/**
 * Finds `needle` in text[from, to): exactly, then ignoring case, then
 * ignoring diacritics and letter shapes (models sometimes drop or add tashkeel).
 */
export function findInRange(text: string, needle: string, from: number, to: number): [number, number] | null {
  const exact = findWord(text, needle, from, to);
  if (exact >= 0) return [exact, withMarks(text, exact + needle.length)];
  const lower = findWord(text.toLowerCase(), needle.toLowerCase(), from, to);
  if (lower >= 0) return [lower, withMarks(text, lower + needle.length)];
  const hay = fold(text.slice(from, to));
  const n = fold(needle).text.trim();
  if (n.length < 2) return null;
  for (let at = hay.text.indexOf(n); at !== -1; at = hay.text.indexOf(n, at + 1)) {
    const s = from + hay.index[at];
    const e = withMarks(text, from + hay.index[at + n.length - 1] + 1);
    if (!LETTER.test(text[s - 1] ?? " ") && !LETTER.test(text[e] ?? " ")) return [s, e];
  }
  return null;
}

/**
 * Places the model's terms in the page text: in the paragraph it named, or
 * anywhere on the page if it got the paragraph wrong. Terms that can't be
 * found, or that overlap one already placed, are dropped.
 */
export function locateTerms(text: string, blocks: Block[], raw: RawTerm[]): Term[] {
  const placed: Term[] = [];
  for (const { p, ...t } of raw) {
    const needle = t.text.trim();
    if (!needle) continue;
    const block = blocks[p - 1];
    const at = (block && findInRange(text, needle, block.s, block.e)) ?? findInRange(text, needle, 0, text.length);
    if (!at) continue;
    const [s, e] = at;
    if (placed.some((x) => s < x.e && e > x.s)) continue;
    placed.push({ ...t, text: text.slice(s, e), s, e });
  }
  return placed.sort((a, b) => a.s - b.s);
}

/** The sentence containing [s, e), for "meaning in context" and saved words. */
export function sentenceAround(text: string, s: number, e: number): string {
  const end = /[.!?؟…\n]/g;
  let start = 0;
  for (const m of text.slice(0, s).matchAll(end)) start = m.index + 1;
  end.lastIndex = e;
  const after = end.exec(text);
  return text.slice(start, after ? after.index + 1 : text.length).trim();
}
