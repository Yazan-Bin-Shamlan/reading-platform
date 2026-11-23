import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { progressSchema } from "@/lib/library/schemas";

// PUT from the reader while reading; POST from navigator.sendBeacon on page hide.
async function save(req: NextRequest, ctx: RouteContext<"/api/documents/[id]/progress">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = progressSchema.safeParse(JSON.parse((await req.text()) || "null"));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const doc = await db.document.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const { pageIndex, offset, percent } = parsed.data;
  // charOffset holds the in-page scroll fraction in per-mille until Reading mode adds real offsets.
  const data = { pageIndex, charOffset: Math.round(offset * 1000), percent };
  await db.readingProgress.upsert({
    where: { documentId: id },
    create: { documentId: id, userId: user.id, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}

export { save as PUT, save as POST };
