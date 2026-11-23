import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { USER_AGENT } from "@/lib/sources/http";
import { remoteUrl } from "@/lib/sources/import";

/**
 * Serves a large source PDF to its readers range by range (the reader asks
 * for 256 KB at a time), for files too big to store. Only people who have
 * the book in their library can read it here.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/proxy/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await db.document.findFirst({
    where: { userId: user.id, contentId: id },
    select: { content: { select: { storageKey: true } } },
  });
  const url = doc?.content && remoteUrl(doc.content.storageKey);
  if (!url) return NextResponse.json({ error: "not-found" }, { status: 404 });

  // Straight through, not the catalog request queue: a reader waits on each range,
  // and a range nobody waits for any more (page scrolled away) is cancelled.
  const range = req.headers.get("range");
  const upstream = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/pdf", ...(range ? { range } : {}) },
    signal: AbortSignal.any([req.signal, AbortSignal.timeout(60_000)]),
  }).catch(() => null);
  if (!upstream?.ok) return NextResponse.json({ error: "unavailable" }, { status: 502 });

  const headers = new Headers({
    "content-type": "application/pdf",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=86400",
  });
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
