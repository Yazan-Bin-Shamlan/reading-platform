import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/words/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { count } = await db.savedWord.deleteMany({ where: { id, userId: user.id } });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not-found" }, { status: 404 });
}
