import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentConfig } from "@google/genai";
import { lookupPrompt, morePrompt, pagePrompt, paragraphPrompt, type DocLang } from "./prompts";
import { AiBusyError, quotaErrorFrom } from "./limits";
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

// A dense page can take Flash-Lite 10–20 s (it writes a lot); more when it's busy.
const TIMEOUT_MS: Record<Tier, number> = { fast: 60_000, smart: 25_000 };

/** Busy or too slow: worth trying another model. */
const isOverloaded = (e: unknown) =>
  (e instanceof ApiError && (e.status === 503 || e.status === 504)) ||
  (e instanceof Error && /timed? ?out|abort|deadline/i.test(e.message));

/** Turns a Gemini error into a quota or busy error when it is one, so the queue can retry or pause. */
const asQuotaError = (e: unknown) =>
  (e instanceof ApiError && quotaErrorFrom(e.status, e.message ?? "")) || (isOverloaded(e) ? new AiBusyError() : e);

export function createGemini(apiKey: string): AiProvider {
  const ai = new GoogleGenAI({ apiKey });

  async function call(tier: Tier, prompt: { system: string; user: string }, schema: object): Promise<unknown> {
    const model = MODELS[tier];
    const config: GenerateContentConfig = {
      systemInstruction: prompt.system,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      // Our own queue handles retries, so a daily limit can pause Smart Assist instead.
      httpOptions: { timeout: TIMEOUT_MS[tier], retryOptions: { attempts: 1 } },
    };
    if (model.startsWith("gemini-3")) config.thinkingConfig = { thinkingLevel: THINKING[tier] };
    const res = await ai.models.generateContent({ model, contents: prompt.user, config });
    return JSON.parse(res.text ?? "null");
  }

  async function json(tier: Tier, prompt: { system: string; user: string }, schema: object): Promise<unknown> {
    try {
      return await call(tier, prompt, schema);
    } catch (e) {
      // The stronger model is often busy on the free tier (503) or slow (timeout):
      // answer with the fast one rather than not at all.
      if (tier === "smart" && isOverloaded(e)) {
        try {
          return await call("fast", prompt, schema);
        } catch (e2) {
          throw asQuotaError(e2);
        }
      }
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
