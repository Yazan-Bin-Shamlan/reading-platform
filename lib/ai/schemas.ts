import { z } from "zod";

export const termKinds = ["word", "phrase", "person", "place", "org", "event", "concept"] as const;
export type TermKind = (typeof termKinds)[number];
export const isEntity = (k: TermKind) => k === "person" || k === "place" || k === "org" || k === "event";

/**
 * One marked item as the model returns it. `p` is the paragraph number it
 * appears in and `text` its exact wording there; our code finds the
 * character position (models are unreliable at counting characters).
 */
export const rawTermSchema = z.object({
  p: z.number().int().min(1),
  text: z.string().min(1).max(120),
  kind: z.enum(termKinds),
  /** 1 (common) … 5 (rare, specialist or classical). */
  difficulty: z.number().int().min(1).max(5),
  lemma: z.string().max(120).default(""),
  pos: z.string().max(30).default(""),
  ipa: z.string().max(80).default(""),
  /** Arabic for English documents; English for Arabic documents. */
  translation: z.string().max(200).default(""),
  /** Plain meaning in the document's language (easy English, or simple modern Arabic). */
  simple: z.string().max(300).default(""),
  /** Plain meaning in Arabic (English documents only). */
  simpleAr: z.string().max(300).default(""),
  /** What it means in this exact sentence. */
  context: z.string().max(400).default(""),
  contextAr: z.string().max(400).default(""),
  example: z.string().max(300).default(""),
  /** People, places, organisations, events: canonical names for the encyclopedia lookup. */
  nameEn: z.string().max(160).default(""),
  nameAr: z.string().max(160).default(""),
  /** Why this paragraph mentions it, from the text alone. */
  why: z.string().max(400).default(""),
  whyAr: z.string().max(400).default(""),
});
export type RawTerm = z.infer<typeof rawTermSchema>;

export const pageAnalysisSchema = z.object({ terms: z.array(z.unknown()).max(60) });

/** A term placed in the page text: characters [s, e). */
export type Term = Omit<RawTerm, "p"> & { s: number; e: number };

export const paragraphSchema = z.object({
  summary: z.string().max(1500),
  summaryAr: z.string().max(2000),
  points: z.array(z.string().max(300)).max(4).default([]),
});
export type ParagraphExplanation = z.infer<typeof paragraphSchema>;

export const moreSchema = z.object({
  more: z.string().max(1500),
  moreAr: z.string().max(2000),
  examples: z.array(z.string().max(300)).max(3).default([]),
});
export type MoreExplanation = z.infer<typeof moreSchema>;

// ── JSON Schemas for structured output ─────────────────────────────────
// Written by hand to stay within the subset Gemini's `responseJsonSchema`
// supports (type, description, enum, items, maxItems, properties, required).

const str = (description: string) => ({ type: "string", description });

const termProperties = {
  p: { type: "integer", description: "Paragraph number [n] the text is in" },
  text: str("The exact words as they appear in that paragraph (same spelling, case and diacritics)"),
  kind: { type: "string", enum: [...termKinds] },
  difficulty: { type: "integer", minimum: 1, maximum: 5, description: "1 common … 5 rare/specialist/classical" },
  lemma: str("Dictionary form (singular, infinitive); for names, the name"),
  pos: str("Part of speech, e.g. noun, verb, adjective, idiom; empty for names"),
  ipa: str("IPA for English words, e.g. /ɪˈfɛm(ə)rəl/; empty otherwise"),
  translation: str("Short translation (Arabic for English text, English for Arabic text)"),
  simple: str("Plain meaning in at most 15 easy words, in the text's language"),
  simpleAr: str("Plain meaning in simple Modern Standard Arabic (English text only)"),
  context: str("What it means in this exact sentence, at most 20 words, in the text's language"),
  contextAr: str("The same in simple Arabic (English text only)"),
  example: str("One short new example sentence in the text's language"),
  nameEn: str("People/places/organisations/events: full canonical English name for an encyclopedia search"),
  nameAr: str("The same name in Arabic"),
  why: str("People/places/organisations/events: why this paragraph mentions it, one sentence, from the text only"),
  whyAr: str("The same in simple Arabic"),
} as const;

export const pageAnalysisJsonSchema = {
  type: "object",
  properties: {
    terms: {
      type: "array",
      maxItems: 30,
      items: { type: "object", properties: termProperties, required: ["p", "text", "kind", "difficulty"] },
    },
  },
  required: ["terms"],
};

export const lookupJsonSchema = {
  type: "object",
  properties: termProperties,
  required: ["text", "kind", "difficulty", "lemma", "translation", "simple", "context"],
};

export const paragraphJsonSchema = {
  type: "object",
  properties: {
    summary: str("What the passage says, in easy English (A2–B1), at most 80 words"),
    summaryAr: str("The same in simple Modern Standard Arabic, at most 100 words"),
    points: { type: "array", maxItems: 3, items: str("A key idea, one short sentence") },
  },
  required: ["summary", "summaryAr"],
};

export const moreJsonSchema = {
  type: "object",
  properties: {
    more: str("A fuller explanation in easy English, at most 100 words"),
    moreAr: str("The same in simple Arabic, at most 120 words"),
    examples: { type: "array", maxItems: 2, items: str("Another example sentence") },
  },
  required: ["more", "moreAr"],
};
