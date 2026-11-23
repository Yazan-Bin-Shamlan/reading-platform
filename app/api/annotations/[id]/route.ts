import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateAnnotationSchema } from "@/lib/reader/annotations";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/annotations/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = updateAnnotationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { note, color } = parsed.data;
  const data = {
    ...(color ? { color } : {}),
    // An empty note is no note; a highlight with a note is listed as a note.
    ...(note !== undefined ? { note: note?.trim() || null } : {}),
  };
  const { count } = await db.annotation.updateMany({ where: { id, userId: user.id, kind: { not: "bookmark" } }, data });
  if (!count) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (note !== undefined) {
    await db.annotation.update({ where: { id }, data: { kind: data.note ? "note" : "highlight" } });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/annotations/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { count } = await db.annotation.deleteMany({ where: { id, userId: user.id } });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not-found" }, { status: 404 });
}
