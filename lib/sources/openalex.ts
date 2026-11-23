// OpenAlex (https://openalex.org): open-access research. Only works whose
// best open copy carries a Creative Commons or public-domain license.
import { normalizeLicense, openLicenses } from "./license";
import type { CatalogRecord, SearchQuery } from "./types";

type Location = {
  landing_page_url: string | null;
  pdf_url: string | null;
  license: string | null;
  source: { display_name: string } | null;
} | null;

export type OpenAlexWork = {
  id: string;
  display_name: string | null;
  publication_year: number | null;
  language: string | null;
  type: string;
  authorships?: { author: { display_name: string } }[];
  abstract_inverted_index?: Record<string, number[]> | null;
  topics?: { display_name: string }[];
  keywords?: { display_name: string }[];
  best_oa_location: Location;
  doi?: string | null;
};

const BASE = "https://api.openalex.org/works";
// OpenAlex's own codes for the licenses we accept.
const LICENSES = openLicenses.filter((l) => l !== "cc0").join("|");
const TYPES = { paper: "article|preprint|review", book: "book|book-chapter" } as const;
export const SELECT = "id,display_name,publication_year,language,type,authorships,abstract_inverted_index,topics,keywords,best_oa_location,doi";

/** Rebuilds an abstract from OpenAlex's {word: [positions]} index. */
export function rebuildAbstract(inv: Record<string, number[]> | null | undefined): string | null {
  if (!inv) return null;
  const words: string[] = [];
  for (const [w, positions] of Object.entries(inv)) for (const p of positions) words[p] = w;
  const text = words.join(" ").replace(/\s+/g, " ").trim();
  return text || null;
}

export function openAlexUrl(q: SearchQuery & { sinceDays?: number; sort?: string }, apiKey?: string) {
  const filter = [
    "open_access.is_oa:true",
    `language:${q.language ?? "en|ar"}`,
    `best_oa_location.license:${LICENSES}`,
    `type:${TYPES[q.type ?? "paper"] ?? TYPES.paper}${q.type ? "" : `|${TYPES.book}`}`,
  ];
  if (q.sinceDays) filter.push(`from_publication_date:${new Date(Date.now() - q.sinceDays * 86_400_000).toISOString().slice(0, 10)}`);
  const params = new URLSearchParams({ filter: filter.join(","), select: SELECT, per_page: "20", page: String(q.page) });
  if (q.query) params.set("search", q.query);
  if (q.sort) params.set("sort", q.sort);
  if (apiKey) params.set("api_key", apiKey);
  return `${BASE}?${params}`;
}

export const openAlexWorkUrl = (id: string, apiKey?: string) =>
  `${BASE}/${encodeURIComponent(id)}?select=${SELECT}${apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : ""}`;

export function fromOpenAlex(w: OpenAlexWork): CatalogRecord | null {
  const loc = w.best_oa_location;
  const license = normalizeLicense(loc?.license);
  const language = w.language === "ar" || w.language === "en" ? w.language : null;
  if (!license || !language || !w.display_name || !loc) return null;
  const id = w.id.replace("https://openalex.org/", "");
  const subjects = [...new Set([...(w.topics ?? []), ...(w.keywords ?? [])].map((t) => t.display_name))];
  return {
    source: "openalex",
    sourceId: id,
    type: w.type === "book" || w.type === "book-chapter" ? "book" : "paper",
    title: w.display_name.replace(/<[^>]+>/g, ""),
    altTitle: null,
    authors: (w.authorships ?? []).slice(0, 12).map((a) => a.author.display_name),
    language,
    year: w.publication_year,
    abstract: rebuildAbstract(w.abstract_inverted_index)?.slice(0, 4000) ?? null,
    subjects: subjects.slice(0, 8),
    coverUrl: null,
    pdfUrl: loc.pdf_url,
    htmlUrl: null,
    license: license.code,
    licenseUrl: license.url,
    attribution: `${loc.source?.display_name ? `${loc.source.display_name}, ` : ""}found via OpenAlex.`,
    sourceUrl: loc.landing_page_url ?? w.doi ?? `https://openalex.org/${id}`,
  };
}
