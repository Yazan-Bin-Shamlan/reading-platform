// Arabic Collections Online (NYU, https://aco.dlib.nyu.edu): about 17,700
// Arabic books that NYU has researched and believes to be in the public
// domain. Searched live through the DLTS Viewer API. The books are scans.
import { MAX_UPLOAD_BYTES } from "@/lib/limits";
import type { CatalogRecord, SearchQuery } from "./types";

export type AcoDoc = {
  ss_identifier: string;
  label?: string;
  ss_ar_title?: string;
  sm_ar_author?: string[];
  sm_field_author?: string[];
  ss_publication_date_text?: string;
  sm_subject_label?: string[];
  sm_provider_label?: string[];
  ss_representative_image?: string;
  ss_uri?: string;
  zm_pdf_lo?: { uri: string; filesize?: string }[];
  zm_pdf_hi?: { uri: string; filesize?: string }[];
};

const BASE = "https://sites.dlib.nyu.edu/viewer/api/v1/search";
export const ACO_ROWS = 20;

export function acoUrl(q: SearchQuery) {
  const params = new URLSearchParams({
    query: q.query || "*",
    rows: String(ACO_ROWS),
    start: String((q.page - 1) * ACO_ROWS),
    fq: "sm_collection_code:aco",
  });
  return `${BASE}?${params}`;
}

/** One book by its identifier (an exact filter; a plain query matches many). */
export const acoItemUrl = (id: string) =>
  `${BASE}?${new URLSearchParams({ query: "*", rows: "1", fq: `ss_identifier:${id.replace(/[^\w.-]/g, "")}` })}`;

/** Trims catalogue punctuation: "شرح مقصورة ابن دريد /" → "شرح مقصورة ابن دريد". */
const tidy = (s: string) => s.replace(/[\s/:;,.؛،]+$/u, "").replace(/\s+/g, " ").trim();

/** "نافع، محمد مبروك،, مؤلف." → "نافع، محمد مبروك"; drops life dates and roles. */
export function acoAuthor(raw: string) {
  return tidy(
    raw
      .replace(/[,،]?\s*(?:مؤلف|محقق|مترجم|author|editor|translator)\.?$/iu, "")
      .replace(/[,،]\s*(?:d\.\s*)?(?:ca\.\s*)?\d{3,4}(?:\s*or\s*\d{3,4})?(?:-\d{3,4})?\.?$/u, ""),
  ).replace(/[,،]+$/u, "");
}

/** "1358 [H.] = 1939 [M.]" → 1939; "1961" → 1961. Hijri-only dates give null. */
export function acoYear(text: string | undefined): number | null {
  const years = [...(text ?? "").matchAll(/\d{4}/g)].map((m) => Number(m[0])).filter((y) => y >= 1450 && y <= 2030);
  return years.length ? years[years.length - 1] : null;
}

export function fromAco(d: AcoDoc): CatalogRecord | null {
  // The low-resolution scan (the high one is several times larger), over HTTPS. Scans
  // over the size limit are read in ACO's own viewer (see lib/sources/import.ts).
  const file = d.zm_pdf_lo?.[0] ?? d.zm_pdf_hi?.[0];
  const pdf = file && !(Number(file.filesize) > MAX_UPLOAD_BYTES) ? file.uri.replace(/^http:\/\//, "https://") : undefined;
  const title = d.ss_ar_title ? tidy(d.ss_ar_title) : d.label ? tidy(d.label) : null;
  if (!title || !d.ss_identifier) return null;
  const provider = d.sm_provider_label?.[0];
  return {
    source: "aco",
    sourceId: d.ss_identifier,
    type: "book",
    title,
    altTitle: d.ss_ar_title && d.label ? tidy(d.label) : null,
    authors: (d.sm_ar_author ?? d.sm_field_author ?? []).map(acoAuthor).filter(Boolean).slice(0, 6),
    language: "ar",
    year: acoYear(d.ss_publication_date_text),
    abstract: null,
    subjects: [...new Set(d.sm_subject_label ?? [])].slice(0, 8),
    coverUrl: d.ss_representative_image?.replace("/full/full/", "/full/!400,400/") ?? null,
    pdfUrl: pdf ?? null,
    htmlUrl: null,
    license: "public-domain",
    licenseUrl: null,
    attribution: `Arabic Collections Online, New York University${provider ? `. Provided by ${provider}` : ""}. NYU believes these materials are in the public domain.`,
    sourceUrl: d.ss_uri ?? `https://sites.dlib.nyu.edu/viewer/books/${d.ss_identifier}/1`,
  };
}
