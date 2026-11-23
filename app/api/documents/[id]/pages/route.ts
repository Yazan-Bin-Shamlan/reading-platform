import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractLater, TEXT_VERSION } from "@/lib/text/extract";

// Extraction may run after the response (see extractLater).
export const maxDuration = 300;

const MAX_PAGES = 60;

/**
 * Reflowed text of pages [from, to]. `map=1` adds the text-layer maps the
 * Original view needs; `all=1` returns every page's text only (for search).
 * Answers 202 while the text is still being extracted.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/documents/[id]/pages">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await db.document.findFirst({
    where: { id, userId: user.id },
    select: { content: { select: { id: true, textVersion: true, pageCount: true } } },
  });
  const content = doc?.content;
  if (!content) return NextResponse.json({ error: "not-found" }, { status: 404 });

  if (content.textVersion < TEXT_VERSION) {
    extractLater(content.id);
    return NextResponse.json({ status: "pending" }, { status: 202, headers: { "retry-after": "1" } });
  }

  const q = req.nextUrl.searchParams;
  const all = q.get("all") === "1";
  const from = Math.max(0, Number(q.get("from")) || 0);
  const to = all ? (content.pageCount ?? 1) - 1 : Math.min(from + MAX_PAGES - 1, Number(q.get("to") ?? from) || from);
  const withMap = !all && q.get("map") === "1";

  const pages = await db.contentPage.findMany({
    where: { contentId: content.id, pageIndex: { gte: from, lte: to } },
    orderBy: { pageIndex: "asc" },
    select: { pageIndex: true, text: true, blocks: !all, map: withMap },
  });
  return NextResponse.json(
    { status: "ready", version: TEXT_VERSION, pages: pages.map(({ pageIndex, ...p }) => ({ i: pageIndex, ...p })) },
    // The text of a given extractor version never changes.
    { headers: { "cache-control": "private, max-age=3600" } },
  );
}
