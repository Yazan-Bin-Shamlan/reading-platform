// Project Gutenberg via Gutendex (https://gutendex.com). Only books marked
// public domain in the USA (copyright: false), with an HTML edition.
import type { CatalogRecord, SearchQuery } from "./types";

export type GutendexBook = {
  id: number;
  title: string;
  authors: { name: string; birth_year: number | null; death_year: number | null }[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  copyright: boolean | null;
  media_type: string;
  formats: Record<string, string>;
  download_count: number;
  summaries?: string[];
};

const BASE = "https://gutendex.com/books";

/** "Dickens, Charles" → "Charles Dickens". */
export const personName = (name: string) => {
  const [last, first] = name.split(/,\s*/);
  return first && !/\d/.test(first) ? `${first} ${last}` : name;
};

export function gutendexUrl(q: SearchQuery) {
  const params = new URLSearchParams({
    languages: q.language ?? "en,ar",
    copyright: "false",
    mime_type: "text/html",
  });
  if (q.query) params.set("search", q.query);
  if (q.page > 1) params.set("page", String(q.page));
  return `${BASE}?${params}`;
}

export const gutendexBookUrl = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export function fromGutendex(b: GutendexBook): CatalogRecord | null {
  if (b.copyright !== false || b.media_type !== "Text") return null;
  const language = b.languages.includes("ar") ? "ar" : b.languages.includes("en") ? "en" : null;
  const html = Object.entries(b.formats).find(([type, url]) => type.startsWith("text/html") && !url.endsWith(".zip"))?.[1];
  if (!language || !html) return null;
  const subjects = [...new Set([...b.subjects.map((s) => s.split(" -- ")[0]), ...b.bookshelves.map((s) => s.replace(/^Category: /, ""))])];
  return {
    source: "gutenberg",
    sourceId: String(b.id),
    type: "book",
    title: b.title,
    altTitle: null,
    authors: b.authors.map((a) => personName(a.name)),
    language,
    year: null,
    abstract: b.summaries?.[0] ?? null,
    subjects: subjects.slice(0, 8),
    coverUrl: b.formats["image/jpeg"] ?? null,
    pdfUrl: null,
    htmlUrl: html,
    license: "public-domain",
    licenseUrl: null,
    attribution: "Project Gutenberg. Public domain in the USA.",
    sourceUrl: `https://www.gutenberg.org/ebooks/${b.id}`,
  };
}
