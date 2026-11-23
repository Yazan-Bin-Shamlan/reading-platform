import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAnnotationSchema } from "@/lib/reader/annotations";
import { annotationSelect, listAnnotations, toAnnotation } from "@/lib/reader/queries";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/documents/[id]/annotations">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  return NextResponse.json({ annotations: await listAnnotations(id, user.id) });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/documents/[id]/annotations">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = createAnnotationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const doc = await db.document.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const row = await db.annotation.create({
    data: { ...parsed.data, userId: user.id, documentId: id },
    select: annotationSelect,
  });
  return NextResponse.json({ annotation: toAnnotation(row) }, { status: 201 });
}
