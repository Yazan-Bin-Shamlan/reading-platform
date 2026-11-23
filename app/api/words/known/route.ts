import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ lang: z.enum(["ar", "en"]), lemma: z.string().trim().min(1).max(120) });

/** "I know this word": stop marking it everywhere. */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { lang, lemma } = parsed.data;
  await db.knownWord.upsert({
    where: { userId_lang_lemma: { userId: user.id, lang, lemma } },
    create: { userId: user.id, lang, lemma },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

/** Undo: mark it again. */
export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await db.knownWord.deleteMany({ where: { userId: user.id, ...parsed.data } });
  return NextResponse.json({ ok: true });
}
