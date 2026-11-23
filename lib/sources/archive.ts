// Internet Archive (https://archive.org): scanned library books. Only texts the
// scanning library marked "not in copyright" and published by 1930 (public
// domain in the US). Licenses that uploaders set themselves are left out: too
// many are wrong.
import { personName } from "./gutenberg";
import type { CatalogRecord, SearchQuery } from "./types";

type Many = string | string[] | undefined;

export type IaDoc = {
  identifier: string;
  title?: Many;
  creator?: Many;
  language?: Many;
  year?: number | string;
  date?: string;
  subject?: Many;
  description?: Many;
  contributor?: Many;
  collection?: Many;
  licenseurl?: string;
  "possible-copyright-status"?: string;
  "access-restricted-item"?: string | boolean;
};

export type IaFile = { name: string; format?: string; size?: string };
export type IaMetadata = { metadata?: IaDoc; files?: IaFile[]; is_dark?: boolean };

/** The last year whose books are public domain in the US (published 95+ years ago). */
export const LAST_PD_YEAR = new Date().getUTCFullYear() - 96;
const BASE = "https://archive.org";
const RESTRICTED = ["inlibrary", "printdisabled", "lendinglibrary"];
const LANGS = { ar: "(ara OR arabic OR Arabic)", en: "(eng OR english OR English)" } as const;
const FIELDS = ["identifier", "title", "creator", "language", "year", "date", "subject", "description", "contributor", "collection", "possible-copyright-status"];
// Preferred first: the PDF with an OCR text layer.
const PDF_FORMATS = ["Text PDF", "Additional Text PDF", "Image Container PDF"];

const list = (v: Many) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map((s) => String(s).trim()).filter(Boolean);
const first = (v: Many) => list(v)[0] ?? null;
// Lucene's special characters, so a title with a colon doesn't break the query.
const escape = (s: string) => s.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, " ").replace(/\s+/g, " ").trim();

export function iaSearchUrl(q: SearchQuery) {
  const parts = [
    "mediatype:texts",
    'possible-copyright-status:"NOT_IN_COPYRIGHT"',
    `year:[1000 TO ${LAST_PD_YEAR}]`,
    `language:${q.language ? LANGS[q.language] : `(${LANGS.ar.slice(1, -1)} OR ${LANGS.en.slice(1, -1)})`}`,
    ...RESTRICTED.map((c) => `NOT collection:${c}`),
    "NOT access-restricted-item:true",
  ];
  const term = escape(q.query);
  if (term) parts.unshift(`(${term})`);
  const params = new URLSearchParams({ q: parts.join(" AND "), rows: "20", page: String(q.page), output: "json" });
  for (const f of FIELDS) params.append("fl[]", f);
  params.append("sort[]", "downloads desc");
  return `${BASE}/advancedsearch.php?${params}`;
}

export const iaMetadataUrl = (id: string) => `${BASE}/metadata/${encodeURIComponent(id)}`;

/** "Cameron, Donald Andreas, 1856-" → "Donald Andreas Cameron". */
export const iaAuthor = (name: string) => personName(name.replace(/,?\s*(b\.\s*)?\d{3,4}\??-?(\d{3,4})?\??\.?$/, "").trim());

/** The book's main language: the first one listed. */
const languageOf = (v: Many): "ar" | "en" | null => {
  const l = list(v)[0]?.toLowerCase();
  return l === "ara" || l === "arabic" ? "ar" : l === "eng" || l === "english" ? "en" : null;
};

/** The item's own PDF, from its file list (only the metadata API has one). */
export function iaPdfUrl(id: string, files: IaFile[] | undefined): string | null {
  for (const format of PDF_FORMATS) {
    const f = files?.find((x) => x.format === format && x.name.toLowerCase().endsWith(".pdf"));
    if (f) return `${BASE}/download/${encodeURIComponent(id)}/${f.name.split("/").map(encodeURIComponent).join("/")}`;
  }
  return null;
}

/** A search hit, or an item's metadata with its files. */
export function fromIa(d: IaDoc, files?: IaFile[]): CatalogRecord | null {
  const year = Number(d.year ?? d.date?.slice(0, 4)) || null;
  const language = languageOf(d.language);
  const title = first(d.title);
  if (d["possible-copyright-status"] !== "NOT_IN_COPYRIGHT") return null;
  if (String(d["access-restricted-item"]) === "true" || list(d.collection).some((c) => RESTRICTED.includes(c))) return null;
  if (!year || year > LAST_PD_YEAR || !language || !title) return null;
  // Descriptions are often just a volume number or scanner notes.
  const description = list(d.description)
    .filter((s) => !/^Book digitized by Google/i.test(s))
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  const contributor = first(d.contributor);
  return {
    source: "archive",
    sourceId: d.identifier,
    type: "book",
    title,
    altTitle: null,
    authors: list(d.creator).slice(0, 8).map(iaAuthor),
    language,
    year,
    abstract: description.length >= 60 ? description.slice(0, 4000) : null,
    subjects: [...new Set(list(d.subject).flatMap((s) => s.split(/\s*;\s*/)))].slice(0, 8),
    coverUrl: `${BASE}/services/img/${encodeURIComponent(d.identifier)}`,
    pdfUrl: files ? iaPdfUrl(d.identifier, files) : null,
    htmlUrl: null,
    license: "public-domain",
    licenseUrl: d.licenseurl?.includes("publicdomain/mark") ? "https://creativecommons.org/publicdomain/mark/1.0/" : null,
    attribution: contributor ? `Digitized by ${contributor}, via the Internet Archive.` : "Via the Internet Archive.",
    sourceUrl: `${BASE}/details/${encodeURIComponent(d.identifier)}`,
  };
}
