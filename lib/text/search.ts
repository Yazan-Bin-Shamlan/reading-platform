// Search that ignores what readers don't type: case, Latin accents, Arabic
// diacritics and tatweel, and the different shapes of alef, ya, ta marbuta
// and hamza seats.

const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/;
const FOLD: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ى": "ي", "ئ": "ي", "ة": "ه", "ؤ": "و",
};

/** Folded text plus, for each folded character, its index in the original. */
export function fold(text: string): { text: string; index: number[] } {
  let out = "";
  const index: number[] = [];
  let space = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ARABIC_MARKS.test(ch)) continue;
    if (/\s/.test(ch)) {
      if (!space) {
        out += " ";
        index.push(i);
      }
      space = true;
      continue;
    }
    space = false;
    const folded = FOLD[ch] ?? ch.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
    for (const c of folded) {
      out += c;
      index.push(i);
    }
  }
  return { text: out, index };
}

export type Hit = { page: number; start: number; end: number };

/** Every match of `query` in the given pages, in reading order. */
export function searchPages(pages: { i: number; text: string }[], query: string, limit = 1000): Hit[] {
  const q = fold(query.trim()).text;
  if (q.length < 2) return [];
  const hits: Hit[] = [];
  for (const page of pages) {
    const f = fold(page.text);
    for (let at = f.text.indexOf(q); at !== -1; at = f.text.indexOf(q, at + q.length)) {
      hits.push({ page: page.i, start: f.index[at], end: f.index[at + q.length - 1] + 1 });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}
