import "server-only";
import { db } from "@/lib/db";

export type WordItem = {
  id: string;
  lang: "ar" | "en";
  lemma: string;
  surface: string;
  translation: string | null;
  meaning: string | null;
  sentence: string;
  documentId: string | null;
  documentTitle: string | null;
  pageIndex: number | null;
  start: number | null;
  end: number | null;
  dueAt: string;
  intervalDays: number;
  ease: number;
  reps: number;
  createdAt: string;
};

const select = {
  id: true,
  lang: true,
  lemma: true,
  surface: true,
  translation: true,
  meaning: true,
  sentence: true,
  documentId: true,
  pageIndex: true,
  start: true,
  end: true,
  dueAt: true,
  intervalDays: true,
  ease: true,
  reps: true,
  createdAt: true,
  document: { select: { title: true } },
} as const;

type Row = Awaited<ReturnType<typeof db.savedWord.findFirstOrThrow<{ select: typeof select }>>>;

const toItem = ({ document, dueAt, createdAt, ...w }: Row): WordItem => ({
  ...w,
  documentTitle: document?.title ?? null,
  dueAt: dueAt.toISOString(),
  createdAt: createdAt.toISOString(),
});

/** All of a reader's saved words, newest first. */
export async function listWords(userId: string): Promise<WordItem[]> {
  const rows = await db.savedWord.findMany({ where: { userId }, select, orderBy: { createdAt: "desc" } });
  return rows.map(toItem);
}

/**
 * Cards to review now: those due, soonest first. With nothing due, the
 * reader can still practise: then the ones due next.
 */
export async function reviewQueue(userId: string, practise: boolean, limit = 20): Promise<WordItem[]> {
  const rows = await db.savedWord.findMany({
    where: { userId, ...(practise ? {} : { dueAt: { lte: new Date() } }) },
    select,
    orderBy: { dueAt: "asc" },
    take: limit,
  });
  return rows.map(toItem);
}

export const countDue = (userId: string) => db.savedWord.count({ where: { userId, dueAt: { lte: new Date() } } });
