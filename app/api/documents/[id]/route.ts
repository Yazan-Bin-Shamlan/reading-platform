import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateDocumentSchema } from "@/lib/library/schemas";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = updateDocumentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { count } = await db.document.updateMany({ where: { id, userId: user.id }, data: parsed.data });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not-found" }, { status: 404 });
}

/** Removes it from this person's library. Shared content stays for others. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { count } = await db.document.deleteMany({ where: { id, userId: user.id } });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not-found" }, { status: 404 });
}
