import { z } from "zod";

/** A string trimmed to at most n characters (the model sometimes runs long; trim rather than reject). */
const clip = (n: number) => z.string().transform((v) => v.trim().slice(0, n));

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
  text: clip(120).pipe(z.string().min(1)),
  kind: z.enum(termKinds),
  /** 1 (common) … 5 (rare, specialist or classical). */
  difficulty: z.number().transform((n) => Math.min(5, Math.max(1, Math.round(n)))),
  lemma: clip(120).default(""),
  pos: clip(30).default(""),
  ipa: clip(80).default(""),
  /** Arabic for English documents; English for Arabic documents. */
  translation: clip(200).default(""),
  /** Plain meaning in the document's language (easy English, or simple modern Arabic). */
  simple: clip(300).default(""),
  /** Plain meaning in Arabic (English documents only). */
  simpleAr: clip(300).default(""),
  /** What it means in this exact sentence. */
  context: clip(400).default(""),
  contextAr: clip(400).default(""),
  example: clip(300).default(""),
  /** People, places, organisations, events: canonical names for the encyclopedia lookup. */
  nameEn: clip(160).default(""),
  nameAr: clip(160).default(""),
  /** Why this paragraph mentions it, from the text alone. */
  why: clip(400).default(""),
  whyAr: clip(400).default(""),
});
export type RawTerm = z.infer<typeof rawTermSchema>;

export const pageAnalysisSchema = z.object({ terms: z.array(z.unknown()).transform((t) => t.slice(0, 40)) });

/** A term placed in the page text: characters [s, e). */
export type Term = Omit<RawTerm, "p"> & { s: number; e: number };

export const paragraphSchema = z.object({
  summary: clip(1500),
  summaryAr: clip(2000),
  points: z.array(clip(300)).default([]).transform((p) => p.slice(0, 4)),
});
export type ParagraphExplanation = z.infer<typeof paragraphSchema>;

export const moreSchema = z.object({
  more: clip(1500),
  moreAr: clip(2000),
  examples: z.array(clip(300)).default([]).transform((e) => e.slice(0, 3)),
});
export type MoreExplanation = z.infer<typeof moreSchema>;

// ── JSON Schemas for structured output ─────────────────────────────────
// Kept minimal: Gemini rejects schemas with long descriptions, numeric
// bounds or array caps ("too many states for serving"). The prompts carry
// the guidance; zod (above) validates, and code clamps and trims.

const str = { type: "string" } as const;
const termProperties = {
  p: { type: "integer" },
  text: str,
  kind: { type: "string", enum: [...termKinds] },
  difficulty: { type: "integer" },
  lemma: str,
  pos: str,
  ipa: str,
  translation: str,
  simple: str,
  simpleAr: str,
  context: str,
  contextAr: str,
  example: str,
  nameEn: str,
  nameAr: str,
  why: str,
  whyAr: str,
} as const;

export const pageAnalysisJsonSchema = {
  type: "object",
  properties: { terms: { type: "array", items: { type: "object", properties: termProperties, required: ["p", "text", "kind", "difficulty"] } } },
  required: ["terms"],
};

export const lookupJsonSchema = {
  type: "object",
  properties: termProperties,
  required: ["text", "kind", "difficulty", "lemma", "translation", "simple", "context"],
};

export const paragraphJsonSchema = {
  type: "object",
  properties: { summary: str, summaryAr: str, points: { type: "array", items: str } },
  required: ["summary", "summaryAr"],
};

export const moreJsonSchema = {
  type: "object",
  properties: { more: str, moreAr: str, examples: { type: "array", items: str } },
  required: ["more", "moreAr"],
};
