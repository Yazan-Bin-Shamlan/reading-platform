import "server-only";
import { isLocalMode } from "@/lib/mode";
import type { DocLang } from "./prompts";
import type { MoreExplanation, ParagraphExplanation, RawTerm } from "./schemas";

/** Which model a call uses: fast for page analysis and lookups, smart for longer explanations. */
export type Tier = "fast" | "smart";

/**
 * Every AI call goes through this interface, so another provider can be
 * dropped in by setting AI_PROVIDER. Implementations return raw model output
 * already validated against the schemas; quota and caching live outside.
 */
export interface AiProvider {
  name: string;
  model(tier: Tier): string;
  analyzePage(lang: DocLang, paragraphs: string[]): Promise<RawTerm[]>;
  explainTerm(lang: DocLang, text: string, context: string): Promise<RawTerm | null>;
  explainMore(lang: DocLang, text: string, context: string): Promise<MoreExplanation>;
  explainParagraph(lang: DocLang, text: string): Promise<ParagraphExplanation>;
}

export { AiQuotaError } from "./limits";

let cached: AiProvider | null | undefined;

/**
 * The configured provider, or null when Smart Assist isn't set up. Local
 * development without a key uses a labelled demo provider so the feature can
 * be tried and tested end to end.
 */
export async function getProvider(): Promise<AiProvider | null> {
  if (cached !== undefined) return cached;
  let provider: AiProvider | null = null;
  const name = process.env.AI_PROVIDER || "gemini";
  const key = process.env.GEMINI_API_KEY;
  if (name === "gemini" && key) {
    const { createGemini } = await import("./gemini");
    provider = createGemini(key);
  } else if (isLocalMode && (name === "demo" || !key)) {
    const { createDemo } = await import("./demo");
    provider = createDemo();
  }
  cached = provider;
  return provider;
}
