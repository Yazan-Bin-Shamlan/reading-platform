import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AiBusyError } from "@/lib/ai/limits";
import { getProvider } from "@/lib/ai/provider";
import { AiPausedError, AiUnavailableError, AiUserLimitError, runAi } from "@/lib/ai/quota";
import { aiVoiceNames, MAX_SPEECH_CHARS } from "@/lib/ai/voices";
import { requireUser } from "@/lib/auth";
import { keys, storage } from "@/lib/storage";

const schema = z.object({
  text: z.string().trim().min(1).max(MAX_SPEECH_CHARS),
  voice: z.enum(aiVoiceNames as [string, ...string[]]),
});

const wav = (bytes: Uint8Array) =>
  new NextResponse(Buffer.from(bytes), {
    headers: { "content-type": "audio/wav", "cache-control": "private, max-age=86400" },
  });

/**
 * Reads text aloud with the AI voice. Each clip is stored once per model,
 * voice and text, so a sentence anyone has heard before costs no quota.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { text, voice } = parsed.data;

  const ai = await getProvider();
  if (!ai?.speak) return NextResponse.json({ status: "unavailable" }, { status: 503 });
  const store = storage();
  const key = keys.speech(createHash("sha256").update([ai.model("speech"), voice, text].join("\u0000")).digest("hex"));
  if (await store.exists(key).catch(() => false)) {
    const bytes = await store.read(key).catch(() => null);
    if (bytes) return wav(bytes);
  }

  try {
    const bytes = await runAi("speech", user.id, (p) => p.speak!(text, voice));
    await store.write(key, bytes, "audio/wav").catch((e) => console.warn("Couldn't cache speech", e));
    return wav(bytes);
  } catch (e) {
    if (e instanceof AiPausedError) return NextResponse.json({ status: "paused", until: e.until.toISOString() }, { status: 503 });
    if (e instanceof AiUserLimitError) return NextResponse.json({ status: "limit" }, { status: 429 });
    if (e instanceof AiUnavailableError) return NextResponse.json({ status: "unavailable" }, { status: 503 });
    if (e instanceof AiBusyError) return NextResponse.json({ status: "aiBusy" }, { status: 503 });
    console.error("AI speech failed", e);
    return NextResponse.json({ status: "error" }, { status: 502 });
  }
}
