import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { importItem, ImportError } from "@/lib/sources/import";
import { sourceIds } from "@/lib/sources/types";

// Fetching a large book can take a while; text extraction then runs after the response.
export const maxDuration = 300;

const schema = z.object({ source: z.enum(sourceIds), sourceId: z.string().min(1).max(200) });

/** "Read now" / "Add to library": fetches and caches the item's file on first use, then adds it. */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const docId = await importItem(user.id, parsed.data.source, parsed.data.sourceId);
    return NextResponse.json({ docId });
  } catch (e) {
    if (e instanceof ImportError) return NextResponse.json({ error: e.code }, { status: e.code === "not-found" ? 404 : 422 });
    console.error("Import failed", e);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
