import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { explore } from "@/lib/sources/explore";
import { sourceIds, type SourceId } from "@/lib/sources/types";

/** Searches the open-library sources at once. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const language = q.get("lang") === "ar" || q.get("lang") === "en" ? (q.get("lang") as "ar" | "en") : undefined;
  const type = q.get("type") === "book" || q.get("type") === "paper" ? (q.get("type") as "book" | "paper") : undefined;
  const sources = (q.get("source") ?? "").split(",").filter((s): s is SourceId => (sourceIds as readonly string[]).includes(s));
  const page = Math.min(50, Math.max(1, Number(q.get("page")) || 1));
  const query = (q.get("q") ?? "").trim().slice(0, 200);

  const result = await explore({ query, language, type, sources, page });

  // Mark what's already in this reader's library.
  const user = await requireUser();
  const inLibrary = user
    ? await db.document.findMany({
        where: {
          userId: user.id,
          catalogItem: { OR: result.items.map((r) => ({ source: r.source, sourceId: r.sourceId })) },
        },
        select: { id: true, catalogItem: { select: { source: true, sourceId: true } } },
      })
    : [];
  const docs = new Map(inLibrary.map((d) => [`${d.catalogItem!.source}:${d.catalogItem!.sourceId}`, d.id]));
  return NextResponse.json({
    ...result,
    items: result.items.map((r) => ({ ...r, docId: docs.get(`${r.source}:${r.sourceId}`) ?? null })),
  });
}
