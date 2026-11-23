import { isEntity, type Term } from "@/lib/ai/schemas";
import { fold } from "@/lib/text/search";

export const levels = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof levels)[number];
export type ExplainLang = "ar" | "en" | "both";

export type AssistSettings = {
  enabled: boolean;
  /** Null until the reader has told us. */
  level: Level | null;
  /** 0 (few marks) … 100 (many). */
  density: number;
  explainLang: ExplainLang;
};

/** English words at or above this difficulty get marked, by level (2 ≈ B1, 3 ≈ B2, 4 ≈ C1). */
export const MIN_DIFFICULTY: Record<Level, number> = { beginner: 2, intermediate: 3, advanced: 4 };
const ARABIC_MIN_DIFFICULTY = 3;

/** Marks per page at a given density: 3 at "few", 30 at "many". */
export const capFor = (density: number) => 3 + Math.round((Math.min(100, Math.max(0, density)) / 100) * 27);

/** The key "I know this word" is stored under: the lemma, ignoring case and diacritics. */
export const knownKey = (t: Pick<Term, "lemma" | "text">) => fold((t.lemma || t.text).trim()).text;

/**
 * The terms to mark on a page for this reader: above their level, not ones
 * they know, at most as many as the density allows. People and other named
 * entities come first, then the hardest words.
 */
export function visibleTerms(terms: Term[], s: AssistSettings, known: ReadonlySet<string>, docLang: "ar" | "en"): Term[] {
  if (!s.enabled) return [];
  const min = docLang === "ar" ? ARABIC_MIN_DIFFICULTY : MIN_DIFFICULTY[s.level ?? "intermediate"];
  const eligible = terms.filter((t) => (isEntity(t.kind) || t.difficulty >= min) && !known.has(knownKey(t)));
  const rank = (t: Term) => (isEntity(t.kind) ? 10 : 0) + t.difficulty;
  return [...eligible]
    .sort((a, b) => rank(b) - rank(a) || a.s - b.s)
    .slice(0, capFor(s.density))
    .sort((a, b) => a.s - b.s);
}
