// Open Library as a backup for book covers, for when a source's own image
// doesn't load (Project Gutenberg down for maintenance, DOAB behind an
// anti-bot check). See https://openlibrary.org/dev/docs/api/covers and
// https://openlibrary.org/dev/docs/api/search (checked 2026-11-25).
// Shared by the server and the browser: no fetching here.

import type { ItemType } from "@/lib/library/schemas";

const ISBN = /\b97[89]\d{10}\b/;

/** An ISBN-13 in a source's file links (DOAB names its files after the book's ISBN). */
export const isbnIn = (...urls: (string | null | undefined)[]) => urls.map((u) => u?.match(ISBN)?.[0]).find(Boolean) ?? null;

/** Our cover lookup for a book, or null for papers (Open Library only knows books). */
export function backupCoverUrl(r: {
  type: ItemType;
  title: string;
  authors: string[];
  coverUrl?: string | null;
  pdfUrl?: string | null;
}): string | null {
  if (r.type !== "book" || !r.title.trim()) return null;
  const p = new URLSearchParams({ title: r.title.slice(0, 200) });
  if (r.authors[0]) p.set("author", r.authors[0].slice(0, 200));
  const isbn = isbnIn(r.coverUrl, r.pdfUrl);
  if (isbn) p.set("isbn", isbn);
  return `/api/cover?${p}`;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟ̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** "Frankenstein; Or, The Modern Prometheus" and "Frankenstein" are the same book; "Emma" and "Persuasion" aren't. */
export function sameTitle(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y) && (x.startsWith(y) || y.startsWith(x));
}

/** The title without its subtitle, which Open Library often leaves out. */
export const mainTitle = (title: string) => title.split(/[;:]|\s[-–—]\s/)[0].trim() || title;

export type OlDoc = { title?: string; cover_i?: number };

/**
 * The cover to use from Open Library's search results: a match on ISBN is the
 * book itself; a match on title and author must also have the same title.
 */
export function pickCover(docs: OlDoc[], title: string, byIsbn: boolean): number | null {
  const hit = docs.find((d) => d.cover_i && (byIsbn || (d.title && sameTitle(d.title, title))));
  return hit?.cover_i ?? null;
}
