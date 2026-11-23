import "server-only";
import { db } from "@/lib/db";
import type { Annotation } from "./annotations";

export const annotationSelect = {
  id: true,
  kind: true,
  color: true,
  pageIndex: true,
  start: true,
  endPage: true,
  end: true,
  quote: true,
  prefix: true,
  suffix: true,
  note: true,
  createdAt: true,
} as const;

type Row = Awaited<ReturnType<typeof db.annotation.findFirstOrThrow<{ select: typeof annotationSelect }>>>;

export const toAnnotation = (row: Row): Annotation =>
  ({ ...row, createdAt: row.createdAt.toISOString() }) as Annotation;

export async function listAnnotations(documentId: string, userId: string): Promise<Annotation[]> {
  const rows = await db.annotation.findMany({
    where: { documentId, userId },
    select: annotationSelect,
    orderBy: [{ pageIndex: "asc" }, { start: "asc" }],
  });
  return rows.map(toAnnotation);
}
