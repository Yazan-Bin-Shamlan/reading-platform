import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { findCover, olCoverUrl } from "@/lib/sources/openlibrary";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().max(200).optional(),
  isbn: z.string().regex(/^97[89]\d{10}$/).optional(),
  size: z.enum(["M", "L"]).default("M"),
});

/**
 * A backup cover from Open Library, asked for only when a source's own image
 * fails to load. Sends the browser on to the image on covers.openlibrary.org.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { size, ...book } = parsed.data;

  let id: number | null;
  try {
    id = await findCover(book);
  } catch (e) {
    console.warn("Open Library cover lookup failed", e);
    return NextResponse.json({ status: "unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
  }
  if (!id) return NextResponse.json({ status: "none" }, { status: 404, headers: { "cache-control": "private, max-age=86400" } });
  const res = NextResponse.redirect(olCoverUrl(id, size), 302);
  res.headers.set("cache-control", "private, max-age=604800");
  return res;
}
