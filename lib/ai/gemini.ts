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

// Models on the free tier (checked 2026-11-23; speech 2026-11-25); override with env.
const MODELS: Record<Tier, string> = {
  fast: process.env.GEMINI_MODEL_FAST || "gemini-3.5-flash-lite",
  smart: process.env.GEMINI_MODEL_SMART || "gemini-3.8-flash",
  speech: process.env.GEMINI_MODEL_SPEECH || "gemini-3.8-flash-lite-tts",
};
type TextTier = Exclude<Tier, "speech">;

// Keep thinking short: it adds latency and tokens. Gemini 3.8 Flash's lowest level is LOW.
const THINKING: Record<TextTier, ThinkingLevel> = { fast: ThinkingLevel.MINIMAL, smart: ThinkingLevel.LOW };

// A dense page can take Flash-Lite 10–20 s (it writes a lot); more when it's busy.
// The stronger model answers a passage in a few seconds when it isn't busy;
// waiting longer only delays the fast model's answer.
const TIMEOUT_MS: Record<TextTier, number> = { fast: 60_000, smart: 12_000 };
/** After the stronger model is busy, go straight to the fast one for a while. */
const SMART_COOLDOWN_MS = 5 * 60_000;
// A 500-character passage takes about 4 s.
const SPEECH_TIMEOUT_MS = 30_000;

/** Busy or too slow: worth trying another model. */
const isOverloaded = (e: unknown) =>
  (e instanceof ApiError && (e.status === 503 || e.status === 504)) ||
  (e instanceof Error && /timed? ?out|abort|deadline/i.test(e.message));

/** Turns a Gemini error into a quota or busy error when it is one, so the queue can retry or pause. */
const asQuotaError = (e: unknown) =>
  (e instanceof ApiError && quotaErrorFrom(e.status, e.message ?? "")) || (isOverloaded(e) ? new AiBusyError() : e);

/** The same for the Interactions API (speech), whose errors are another class with a numeric `status`. */
function asSpeechError(e: unknown) {
  const status = typeof e === "object" && e && "status" in e && typeof e.status === "number" ? e.status : 0;
  const message = e instanceof Error ? e.message : String(e);
  if (status === 503 || status === 504 || /timed? ?out|abort|deadline/i.test(message)) return new AiBusyError();
  return quotaErrorFrom(status, message) ?? e;
}

export function createGemini(apiKey: string): AiProvider {
  const ai = new GoogleGenAI({ apiKey });
  // Speech uses the Interactions API, which is on v1beta.
  const speechAi = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1beta" } });

  async function call(tier: TextTier, prompt: { system: string; user: string }, schema: object): Promise<unknown> {
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

  let smartBusyUntil = 0;

  async function json(tier: TextTier, prompt: { system: string; user: string }, schema: object): Promise<unknown> {
    // It was busy a moment ago: don't make the reader wait for it to fail again.
    if (tier === "smart" && Date.now() < smartBusyUntil) tier = "fast";
    try {
      return await call(tier, prompt, schema);
    } catch (e) {
      // The stronger model is often busy on the free tier (503) or slow (timeout):
      // answer with the fast one rather than not at all.
      if (tier === "smart" && isOverloaded(e)) {
        smartBusyUntil = Date.now() + SMART_COOLDOWN_MS;
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
    async speak(text, voice) {
      try {
        const res = await speechAi.interactions.create(
          {
            model: MODELS.speech,
            // The text is read as a verbatim transcript; the language is detected from it.
            input: [{ type: "user_input", content: [{ type: "text", text }] }],
            response_format: { type: "audio" },
            generation_config: { speech_config: [{ voice }] },
          },
          // Our own queue handles retries, so a daily limit can pause it instead.
          { timeout_ms: SPEECH_TIMEOUT_MS, retries: { strategy: "none" } },
        );
        const data = res.output_audio?.data;
        if (!data) throw new Error("No audio in the speech response");
        return new Uint8Array(Buffer.from(data, "base64"));
      } catch (e) {
        throw asSpeechError(e);
      }
    },
  };
}
