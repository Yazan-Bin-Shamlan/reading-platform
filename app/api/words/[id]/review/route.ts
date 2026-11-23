import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { grades, review } from "@/lib/words/srs";

const schema = z.object({ grade: z.enum(grades) });

/** Records a flashcard answer and schedules the card's next review. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/words/[id]/review">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const word = await db.savedWord.findFirst({
    where: { id, userId: user.id },
    select: { intervalDays: true, ease: true, reps: true },
  });
  if (!word) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const next = review(word, parsed.data.grade);
  await db.savedWord.update({ where: { id }, data: next });
  return NextResponse.json({ dueAt: next.dueAt.toISOString() });
}
