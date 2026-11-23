import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  lang: z.enum(["ar", "en"]),
  lemma: z.string().trim().min(1).max(120),
  surface: z.string().trim().min(1).max(120),
  translation: z.string().max(300).nullable().default(null),
  meaning: z.string().max(600).nullable().default(null),
  sentence: z.string().trim().min(1).max(1500),
  documentId: z.string().min(1),
  pageIndex: z.number().int().min(0),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});

/** "Save to my words": the word, its meaning and the sentence it was found in. */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { lang, lemma, documentId, ...rest } = parsed.data;
  const doc = await db.document.findFirst({ where: { id: documentId, userId: user.id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const word = await db.savedWord.upsert({
    where: { userId_lang_lemma: { userId: user.id, lang, lemma } },
    create: { userId: user.id, lang, lemma, documentId, ...rest },
    // Saving again keeps the review schedule and updates where it was last found.
    update: { documentId, ...rest },
    select: { id: true },
  });
  return NextResponse.json({ id: word.id });
}
