import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentConfig } from "@google/genai";
import { lookupPrompt, morePrompt, pagePrompt, paragraphPrompt, type DocLang } from "./prompts";
import { quotaErrorFrom } from "./limits";
import type { AiProvider, Tier } from "./provider";
import {
  lookupJsonSchema,
  moreJsonSchema,
  moreSchema,
  pageAnalysisJsonSchema,
  pageAnalysisSchema,
  paragraphJsonSchema,
  paragraphSchema,
  rawTermSchema,
  type RawTerm,
} from "./schemas";

// Stable models on the free tier (checked 2026-11-23); override with env.
const MODELS: Record<Tier, string> = {
  fast: process.env.GEMINI_MODEL_FAST || "gemini-3.5-flash-lite",
  smart: process.env.GEMINI_MODEL_SMART || "gemini-3.8-flash",
};

// Keep thinking short: it adds latency and tokens. Gemini 3.8 Flash's lowest level is LOW.
const THINKING: Record<Tier, ThinkingLevel> = { fast: ThinkingLevel.MINIMAL, smart: ThinkingLevel.LOW };

/** Turns a Gemini error into a quota error when it is one. */
const asQuotaError = (e: unknown) => (e instanceof ApiError && quotaErrorFrom(e.status, e.message ?? "")) || e;

export function createGemini(apiKey: string): AiProvider {
  const ai = new GoogleGenAI({ apiKey });

  async function json(tier: Tier, prompt: { system: string; user: string }, schema: object): Promise<unknown> {
    const model = MODELS[tier];
    const config: GenerateContentConfig = {
      systemInstruction: prompt.system,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      // Our own queue handles retries, so a daily limit can pause Smart Assist instead.
      httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } },
    };
    if (model.startsWith("gemini-3")) config.thinkingConfig = { thinkingLevel: THINKING[tier] };
    try {
      const res = await ai.models.generateContent({ model, contents: prompt.user, config });
      return JSON.parse(res.text ?? "null");
    } catch (e) {
      throw asQuotaError(e);
    }
  }

  const term = (x: unknown): RawTerm | null => {
    const parsed = rawTermSchema.safeParse(x);
    return parsed.success ? parsed.data : null;
  };

  return {
    name: "gemini",
    model: (tier) => MODELS[tier],
    async analyzePage(lang: DocLang, paragraphs: string[]) {
      const out = pageAnalysisSchema.parse(await json("fast", pagePrompt(lang, paragraphs), pageAnalysisJsonSchema));
      return out.terms.map(term).filter((t): t is RawTerm => t !== null);
    },
    async explainTerm(lang, text, context) {
      return term(await json("fast", lookupPrompt(lang, text, context), lookupJsonSchema));
    },
    async explainMore(lang, text, context) {
      return moreSchema.parse(await json("smart", morePrompt(lang, text, context), moreJsonSchema));
    },
    async explainParagraph(lang, text) {
      return paragraphSchema.parse(await json("smart", paragraphPrompt(lang, text), paragraphJsonSchema));
    },
  };
}
