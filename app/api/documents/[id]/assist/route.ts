import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "@/lib/ai/provider";
import { pausedUntil, userLimitReached } from "@/lib/ai/quota";
import { analyzeLater, cachedPages, hasFailed } from "@/lib/assist/analyze";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractLater, textReady } from "@/lib/text/extract";

// Analysis continues after the response (see analyzeLater).
export const maxDuration = 300;

const MAX_PAGES = 6;

/**
 * Smart Assist marks for pages [from, to]: cached ones now, the rest analysed
 * in the background (poll again). Reading never depends on this succeeding.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/documents/[id]/assist">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await db.document.findFirst({
    where: { id, userId: user.id },
    select: {
      assistEnabled: true,
      content: { select: { id: true, format: true, textVersion: true, textStatus: true, pageCount: true } },
    },
  });
  const content = doc?.content;
  if (!doc || !content) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const ai = await getProvider();
  if (!ai) return NextResponse.json({ status: "unavailable" });
  if (!doc.assistEnabled) return NextResponse.json({ status: "off" });
  if (content.textStatus === "scanned") return NextResponse.json({ status: "no-text" });
  if (!textReady(content)) {
    extractLater(content.id);
    return NextResponse.json({ status: "preparing" });
  }

  const q = req.nextUrl.searchParams;
  const last = (content.pageCount ?? 1) - 1;
  const from = Math.min(last, Math.max(0, Number(q.get("from")) || 0));
  const to = Math.min(last, from + MAX_PAGES - 1, Math.max(from, Number(q.get("to")) || from));
  const wanted = Array.from({ length: to - from + 1 }, (_, k) => from + k);

  const cached = await cachedPages(ai, content.id, wanted);
  const pages = [...cached].map(([i, terms]) => ({ i, terms }));
  const missing = wanted.filter((p) => !cached.has(p));
  const failed = missing.filter((p) => hasFailed(content.id, p));
  const todo = missing.filter((p) => !failed.includes(p));
  const base = { provider: ai.name, pages, failed };

  const paused = await pausedUntil(ai.model("fast"));
  if (paused) return NextResponse.json({ ...base, status: "paused", until: paused.toISOString() });
  if (todo.length && (await userLimitReached(user.id))) return NextResponse.json({ ...base, status: "limit" });

  analyzeLater(ai, content.id, todo, user.id);
  return NextResponse.json({ ...base, status: "ok", pending: todo });
}
