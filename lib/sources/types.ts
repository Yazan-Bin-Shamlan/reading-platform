import type { ItemType } from "@/lib/library/schemas";

export const sourceIds = ["gutenberg", "doab", "openalex", "arxiv", "aco", "archive", "europepmc"] as const;
export type SourceId = (typeof sourceIds)[number];

/**
 * One item from any source, in the shared shape every adapter returns.
 * Only items that are public domain or openly licensed ever get this far.
 */
export type CatalogRecord = {
  source: SourceId;
  sourceId: string;
  type: ItemType;
  title: string;
  /** The title in the other script, e.g. the transliteration of an Arabic title. */
  altTitle: string | null;
  authors: string[];
  language: "ar" | "en";
  year: number | null;
  abstract: string | null;
  subjects: string[];
  coverUrl: string | null;
  /** A PDF we may fetch, cache and show. */
  pdfUrl: string | null;
  /** A text edition shown in Reading mode: Project Gutenberg's HTML, Europe PMC's full text XML. */
  htmlUrl: string | null;
  /** A license code from lib/sources/license.ts. */
  license: string;
  licenseUrl: string | null;
  /** Who to credit, shown on the item page. */
  attribution: string;
  /** The item's page on the source's own site. */
  sourceUrl: string;
};

export type SearchQuery = {
  query: string;
  language?: "ar" | "en";
  type?: "book" | "paper";
  page: number;
};

export type SearchResult = { items: CatalogRecord[]; total: number | null; more: boolean };
