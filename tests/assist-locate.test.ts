import { describe, expect, it } from "vitest";
import type { RawTerm } from "@/lib/ai/schemas";
import { findInRange, locateTerms, sentenceAround } from "@/lib/assist/locate";

const raw = (p: number, text: string, kind: RawTerm["kind"] = "word"): RawTerm => ({
  p,
  text,
  kind,
  difficulty: 3,
  lemma: "",
  pos: "",
  ipa: "",
  translation: "",
  simple: "",
  simpleAr: "",
  context: "",
  contextAr: "",
  example: "",
  nameEn: "",
  nameAr: "",
  why: "",
  whyAr: "",
});

const text = "The art of equanimity. She started to Start again.\nAs Ibn Khaldun once argued, equanimity matters.";
const blocks = [
  { s: 0, e: 50, k: "p" as const },
  { s: 51, e: text.length, k: "p" as const },
];

describe("locateTerms", () => {
  it("places terms in the named paragraph, at word boundaries", () => {
    const out = locateTerms(text, blocks, [raw(2, "equanimity"), raw(1, "art"), raw(2, "Ibn Khaldun", "person")]);
    expect(out.map((t) => [t.text, t.s])).toEqual([
      ["art", 4],
      ["Ibn Khaldun", 54],
      ["equanimity", 79],
    ]);
  });

  it("falls back to the whole page when the paragraph is wrong, and drops what isn't there", () => {
    const out = locateTerms(text, blocks, [raw(1, "Khaldun"), raw(1, "serendipity")]);
    expect(out.map((t) => t.text)).toEqual(["Khaldun"]);
  });

  it("ignores case and keeps the page's own wording", () => {
    const [t] = locateTerms(text, blocks, [raw(1, "start again")]);
    expect(t.text).toBe("Start again");
  });

  it("matches Arabic with or without diacritics", () => {
    const ar = "ظلّ العالِم يستذكر معاني الشعر";
    expect(findInRange(ar, "العالم", 0, ar.length)).toEqual([4, 11]);
    expect(findInRange(ar, "ظل", 0, ar.length)).toEqual([0, 3]);
  });

  it("skips overlapping terms", () => {
    const out = locateTerms(text, blocks, [raw(2, "Ibn Khaldun"), raw(2, "Khaldun once")]);
    expect(out).toHaveLength(1);
  });
});

describe("sentenceAround", () => {
  it("returns the sentence containing a span", () => {
    expect(sentenceAround(text, 54, 65)).toBe("As Ibn Khaldun once argued, equanimity matters.");
    expect(sentenceAround(text, 4, 7)).toBe("The art of equanimity.");
  });
});
