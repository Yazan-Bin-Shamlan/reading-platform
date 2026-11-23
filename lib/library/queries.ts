import "server-only";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { ItemType } from "./schemas";

export type LibraryDoc = {
  id: string;
  title: string;
  authors: string[];
  type: ItemType;
  language: "ar" | "en" | null;
  pageCount: number | null;
  coverUrl: string | null;
  percent: number;
  currentPage: number | null;
  createdAt: string;
  lastOpenedAt: string | null;
  /** Highlights, notes and bookmarks: removing the document deletes them. */
  annotations: number;
};

export async function listLibrary(userId: string, take?: number): Promise<LibraryDoc[]> {
  const docs = await db.document.findMany({
    where: { userId },
    orderBy: [{ lastOpenedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take,
    include: {
      progress: true,
      content: { select: { pageCount: true } },
      catalogItem: { select: { coverUrl: true } },
      _count: { select: { annotations: true } },
    },
  });

  const coverKeys = docs.map((d) => d.coverKey).filter((k): k is string => Boolean(k));
  const covers = coverKeys.length ? await storage().readUrls(coverKeys, 6 * 3600) : {};

  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    authors: d.authors,
    type: d.type,
    language: d.language,
    pageCount: d.content?.pageCount ?? null,
    // Books from Explore use their source's cover.
    coverUrl: d.coverKey ? (covers[d.coverKey] ?? null) : (d.catalogItem?.coverUrl ?? null),
    percent: d.progress?.percent ?? 0,
    currentPage: d.progress ? d.progress.pageIndex + 1 : null,
    createdAt: d.createdAt.toISOString(),
    lastOpenedAt: d.lastOpenedAt?.toISOString() ?? null,
    annotations: d._count.annotations,
  }));
}
