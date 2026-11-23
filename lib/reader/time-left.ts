import type { TocEntry } from "@/lib/library/schemas";

/** Typical silent reading speeds in words per minute. */
export const WPM = { en: 230, ar: 160 } as const;
const WORDS_PER_PAGE_GUESS = 250;

/** First page of the next top-level contents entry after `page`, or the end. */
export function chapterEnd(toc: TocEntry[], page: number, pageCount: number) {
  const starts = toc.map((e) => e.page).filter((p) => p > page);
  return starts.length ? Math.min(...starts) : pageCount;
}

/** Minutes to read from (page, offset) up to page `until` (exclusive). */
export function minutesLeft(
  words: number[] | null,
  page: number,
  offset: number,
  until: number,
  wpm: number,
): number {
  const w = (p: number) => words?.[p] ?? WORDS_PER_PAGE_GUESS;
  let total = w(page) * (1 - offset);
  for (let p = page + 1; p < until; p++) total += w(p);
  return total / wpm;
}
