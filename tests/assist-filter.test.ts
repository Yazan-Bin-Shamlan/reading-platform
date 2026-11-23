import { describe, expect, it } from "vitest";
import type { Term } from "@/lib/ai/schemas";
import { capFor, knownKey, visibleTerms, type AssistSettings } from "@/lib/assist/filter";

let at = 0;
const t = (text: string, kind: Term["kind"], difficulty: number, lemma = ""): Term => {
  const s = (at += 20);
  return {
    text, kind, difficulty, lemma, s, e: s + text.length,
    pos: "", ipa: "", translation: "", simple: "", simpleAr: "", context: "", contextAr: "", example: "",
    nameEn: "", nameAr: "", why: "", whyAr: "",
  };
};

const terms = [
  t("considered", "word", 2),
  t("equanimity", "word", 4),
  t("ephemeral", "word", 5),
  t("Ibn Khaldun", "person", 3),
  t("ledger", "word", 3, "ledger"),
];
const base: AssistSettings = { enabled: true, level: "intermediate", density: 100, explainLang: "both" };
const texts = (xs: Term[]) => xs.map((x) => x.text);

describe("visibleTerms", () => {
  it("marks words at or above the reader's level, and always people", () => {
    expect(texts(visibleTerms(terms, base, new Set(), "en"))).toEqual(["equanimity", "ephemeral", "Ibn Khaldun", "ledger"]);
    expect(texts(visibleTerms(terms, { ...base, level: "advanced" }, new Set(), "en"))).toEqual(["equanimity", "ephemeral", "Ibn Khaldun"]);
    expect(texts(visibleTerms(terms, { ...base, level: "beginner" }, new Set(), "en"))).toHaveLength(5);
  });

  it("skips words the reader knows", () => {
    const known = new Set([knownKey(terms[4]), knownKey({ lemma: "", text: "Equanimity" })]);
    expect(texts(visibleTerms(terms, base, known, "en"))).toEqual(["ephemeral", "Ibn Khaldun"]);
  });

  it("keeps people and the hardest words when density is low", () => {
    expect(capFor(0)).toBe(3);
    expect(capFor(100)).toBe(30);
    expect(texts(visibleTerms(terms, { ...base, density: 0 }, new Set(), "en"))).toEqual(["equanimity", "ephemeral", "Ibn Khaldun"]);
  });

  it("marks nothing when Smart Assist is off", () => {
    expect(visibleTerms(terms, { ...base, enabled: false }, new Set(), "en")).toEqual([]);
  });

  it("ignores diacritics in known Arabic words", () => {
    expect(knownKey({ lemma: "العالِم", text: "" })).toBe(knownKey({ lemma: "العالم", text: "" }));
  });
});
