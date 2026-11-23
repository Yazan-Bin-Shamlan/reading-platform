import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLocalMode } from "@/lib/mode";
import { syncSource, type SyncedSource } from "@/lib/sources/sync";

export const maxDuration = 300;

/**
 * Daily catalog sync (Vercel Cron sends `Authorization: Bearer CRON_SECRET`).
 * `?source=doab` runs one source; repeated calls continue a long first harvest.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret ? req.headers.get("authorization") === `Bearer ${secret}` : isLocalMode;
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const only = req.nextUrl.searchParams.get("source");
  const sources: SyncedSource[] = only === "doab" || only === "arxiv" ? [only] : ["doab", "arxiv"];
  const results = [];
  for (const s of sources) results.push(await syncSource(s, 120_000 / sources.length));
  await db.sourceCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return NextResponse.json({ results });
}
