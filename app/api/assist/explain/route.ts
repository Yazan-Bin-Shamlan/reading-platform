import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import { getProvider } from "@/lib/ai/provider";
import { AiBusyError } from "@/lib/ai/limits";
import { AiPausedError, AiUnavailableError, AiUserLimitError, runAi } from "@/lib/ai/quota";
import { pageLang } from "@/lib/assist/analyze";
import { locateTerms } from "@/lib/assist/locate";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

const schema = z.object({
  docId: z.string().min(1),
  /** lookup: a selected word or phrase; more: "Explain more"; paragraph: "Explain this paragraph". */
  kind: z.enum(["lookup", "more", "paragraph"]),
  text: z.string().trim().min(1).max(4000),
  context: z.string().max(3000).default(""),
});

/** Explanations on demand, cached by what was asked so repeats are instant and free. */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { docId, kind, text, context } = parsed.data;
  if (kind === "lookup" && text.length > 120) return NextResponse.json({ error: "too-long" }, { status: 400 });

  const doc = await db.document.findFirst({ where: { id: docId, userId: user.id }, select: { assistEnabled: true } });
  if (!doc) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (!doc.assistEnabled) return NextResponse.json({ status: "off" }, { status: 403 });
  const ai = await getProvider();
  if (!ai) return NextResponse.json({ status: "unavailable" }, { status: 503 });

  const lang = pageLang(`${text} ${context}`);
  const tier = kind === "lookup" ? "fast" : "smart";
  const model = ai.model(tier);
  const key = createHash("sha256")
    .update([kind, model, PROMPT_VERSION, lang, text, kind === "paragraph" ? "" : context].join("\u0000"))
    .digest("hex");
  const hit = await db.explainCache.findUnique({ where: { key } });
  if (hit) return NextResponse.json({ status: "ok", result: hit.response });

  try {
    let result: unknown;
    if (kind === "paragraph") {
      result = await runAi(tier, user.id, (p) => p.explainParagraph(lang, text));
    } else if (kind === "more") {
      result = await runAi(tier, user.id, (p) => p.explainMore(lang, text, context));
    } else {
      const raw = await runAi(tier, user.id, (p) => p.explainTerm(lang, text, context || text));
      // Keep the reader's own wording; fall back to the model's term if it differs.
      const [placed] = raw ? locateTerms(text, [{ s: 0, e: text.length, k: "p" }], [{ ...raw, p: 1, text }]) : [];
      result = placed ?? (raw ? { ...raw, s: 0, e: text.length } : null);
    }
    if (!result) return NextResponse.json({ status: "empty" });
    await db.explainCache.create({ data: { key, kind, model, response: result as Prisma.InputJsonValue } }).catch(() => {});
    return NextResponse.json({ status: "ok", result });
  } catch (e) {
    if (e instanceof AiPausedError) return NextResponse.json({ status: "paused", until: e.until.toISOString() }, { status: 503 });
    if (e instanceof AiUserLimitError) return NextResponse.json({ status: "limit" }, { status: 429 });
    if (e instanceof AiUnavailableError) return NextResponse.json({ status: "unavailable" }, { status: 503 });
    if (e instanceof AiBusyError) return NextResponse.json({ status: "aiBusy" }, { status: 503 });
    console.error("Smart Assist explain failed", e);
    return NextResponse.json({ status: "error" }, { status: 502 });
  }
}
