import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toAnki, toCsv } from "@/lib/words/export";

/** Downloads My Words as CSV or as a file for Anki's File → Import. */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const format = req.nextUrl.searchParams.get("format") === "anki" ? "anki" : "csv";
  const rows = await db.savedWord.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { document: { select: { title: true } } },
  });
  const words = rows.map((w) => ({ ...w, source: w.document?.title ?? null }));
  const stamp = new Date().toISOString().slice(0, 10);
  const [body, type, name] =
    format === "anki"
      ? [toAnki(words, "Qiraa: My Words"), "text/plain", `my-words-anki-${stamp}.txt`]
      : [toCsv(words), "text/csv", `my-words-${stamp}.csv`];
  return new NextResponse(body, {
    headers: {
      "content-type": `${type}; charset=utf-8`,
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
