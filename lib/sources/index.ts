import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { acoItemUrl, acoUrl, fromAco, type AcoDoc } from "./aco";
import { fromIa, iaMetadataUrl, iaSearchUrl, type IaDoc, type IaMetadata } from "./archive";
import { epmcItemUrl, epmcSearchUrl, fromEpmc, type EpmcSearch } from "./europepmc";
import { fromGutendex, gutendexBookUrl, gutendexUrl, type GutendexBook } from "./gutenberg";
import { cached, getJson } from "./http";
import { fromOpenAlex, openAlexUrl, openAlexWorkUrl, type OpenAlexWork } from "./openalex";
import type { CatalogRecord, SearchQuery, SearchResult, SourceId } from "./types";

const SEARCH_TTL = 6 * 3600;
const ITEM_TTL = 24 * 3600;
const PER_PAGE = 20;
// Europe PMC can take half a minute on common words. Explore stops waiting
// sooner, but the answer still lands in the cache for the next try.
const EPMC_TIMEOUT_MS = 45_000;
const apiKey = () => process.env.OPENALEX_API_KEY || undefined;

type Paged<T> = { count?: number; numFound?: number; next?: string | null; results?: T[]; docs?: T[]; meta?: { count: number } };

const mapAll = <T,>(rows: T[] | undefined, map: (r: T) => CatalogRecord | null) =>
  (rows ?? []).map(map).filter((r): r is CatalogRecord => r !== null);

/** Europe PMC pages by cursor: page n needs page n-1's cursor, so earlier pages are read (and cached) first. */
async function epmcPage(q: SearchQuery): Promise<EpmcSearch> {
  let cursor = "*";
  for (let p = 1; ; p++) {
    const url = epmcSearchUrl(q, cursor);
    const body = await cached(`europepmc:${url}`, SEARCH_TTL, () => getJson<EpmcSearch>(url, EPMC_TIMEOUT_MS));
    if (p >= q.page || !body.nextCursorMark || body.nextCursorMark === cursor) return p >= q.page ? body : {};
    cursor = body.nextCursorMark;
  }
}

/** Synced sources (DOAB, arXiv) are searched in our own catalog. */
async function searchCatalog(source: SourceId, q: SearchQuery): Promise<SearchResult> {
  const term = q.query.trim();
  const where: Prisma.CatalogItemWhereInput = {
    source,
    ...(q.language ? { language: q.language } : {}),
    ...(term
      ? {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { abstract: { contains: term, mode: "insensitive" } },
            { subjects: { has: term } },
            { authors: { has: term } },
          ],
        }
      : {}),
  };
  const rows = await db.catalogItem.findMany({
    where,
    orderBy: { syncedAt: "desc" },
    skip: (q.page - 1) * PER_PAGE,
    take: PER_PAGE + 1,
  });
  return { items: rows.slice(0, PER_PAGE).map(toRecord), total: null, more: rows.length > PER_PAGE };
}

export function toRecord(row: Prisma.CatalogItemGetPayload<object>): CatalogRecord {
  return {
    source: row.source as SourceId,
    sourceId: row.sourceId,
    type: row.type,
    title: row.title,
    altTitle: row.altTitle,
    authors: row.authors,
    language: row.language,
    year: row.year,
    abstract: row.abstract,
    subjects: row.subjects,
    coverUrl: row.coverUrl,
    pdfUrl: row.pdfUrl,
    htmlUrl: row.htmlUrl,
    license: row.license,
    licenseUrl: row.licenseUrl,
    attribution: row.attribution ?? "",
    sourceUrl: row.sourceUrl,
  };
}

/** One source's results for a query. Live sources are cached for a few hours. */
export async function searchSource(source: SourceId, q: SearchQuery): Promise<SearchResult> {
  switch (source) {
    case "gutenberg": {
      if (q.type === "paper") return { items: [], total: 0, more: false };
      const url = gutendexUrl(q);
      const body = await cached(`gutendex:${url}`, SEARCH_TTL, () => getJson<Paged<GutendexBook>>(url));
      return { items: mapAll(body.results, fromGutendex), total: body.count ?? null, more: Boolean(body.next) };
    }
    case "openalex": {
      const url = openAlexUrl(q, apiKey());
      const body = await cached(`openalex:${openAlexUrl(q)}`, SEARCH_TTL, () => getJson<Paged<OpenAlexWork>>(url));
      const total = body.meta?.count ?? null;
      return { items: mapAll(body.results, fromOpenAlex), total, more: total !== null && q.page * PER_PAGE < total };
    }
    case "aco": {
      if (q.type === "paper" || q.language === "en") return { items: [], total: 0, more: false };
      const url = acoUrl(q);
      const body = await cached(`aco:${url}`, SEARCH_TTL, () => getJson<Paged<AcoDoc> & { response?: Paged<AcoDoc> }>(url));
      const r = body.response ?? body;
      const total = r.numFound ?? null;
      return { items: mapAll(r.docs, fromAco), total, more: total !== null && q.page * PER_PAGE < total };
    }
    case "archive": {
      if (q.type === "paper") return { items: [], total: 0, more: false };
      const url = iaSearchUrl(q);
      const body = await cached(`archive:${url}`, SEARCH_TTL, () => getJson<{ response?: Paged<IaDoc> }>(url));
      const total = body.response?.numFound ?? null;
      // Books list every language they use; keep those whose main one was asked for.
      const items = mapAll(body.response?.docs, (d) => fromIa(d)).filter((r) => !q.language || r.language === q.language);
      return { items, total, more: total !== null && q.page * PER_PAGE < total };
    }
    case "europepmc": {
      if (q.type === "book" || q.language === "ar") return { items: [], total: 0, more: false };
      const body = await epmcPage(q);
      const total = body.hitCount ?? null;
      return { items: mapAll(body.resultList?.result, fromEpmc), total, more: total !== null && q.page * PER_PAGE < total };
    }
    case "doab":
      return q.type === "paper" ? { items: [], total: 0, more: false } : searchCatalog("doab", q);
    case "arxiv":
      return q.type === "book" || q.language === "ar" ? { items: [], total: 0, more: false } : searchCatalog("arxiv", q);
  }
}

/** A single item: from our catalog if we've seen it, otherwise from the source. */
export async function getRecord(source: SourceId, sourceId: string): Promise<CatalogRecord | null> {
  const row = await db.catalogItem.findUnique({ where: { source_sourceId: { source, sourceId } } });
  if (row) return toRecord(row);
  switch (source) {
    case "gutenberg": {
      const url = gutendexBookUrl(sourceId);
      return fromGutendex(await cached(`gutendex:${url}`, ITEM_TTL, () => getJson<GutendexBook>(url)));
    }
    case "openalex": {
      const work = await cached(`openalex:${openAlexWorkUrl(sourceId)}`, ITEM_TTL, () =>
        getJson<OpenAlexWork>(openAlexWorkUrl(sourceId, apiKey())),
      );
      return fromOpenAlex(work);
    }
    case "aco": {
      const url = acoItemUrl(sourceId);
      const body = await cached(`aco:${url}`, ITEM_TTL, () => getJson<Paged<AcoDoc> & { response?: Paged<AcoDoc> }>(url));
      const doc = (body.response ?? body).docs?.find((d) => d.ss_identifier === sourceId);
      return doc ? fromAco(doc) : null;
    }
    case "archive": {
      // The metadata API is the only one that lists the item's files (and so its PDF).
      const url = iaMetadataUrl(sourceId);
      const body = await cached(`archive:${url}`, ITEM_TTL, () => getJson<IaMetadata>(url));
      return body.metadata && !body.is_dark ? fromIa(body.metadata, body.files ?? []) : null;
    }
    case "europepmc": {
      const url = epmcItemUrl(sourceId);
      const body = await cached(`europepmc:${url}`, ITEM_TTL, () => getJson<EpmcSearch>(url, EPMC_TIMEOUT_MS));
      const hit = body.resultList?.result?.find((r) => r.pmcid === sourceId);
      return hit ? fromEpmc(hit) : null;
    }
    default:
      return null; // synced sources are only what we've harvested
  }
}

/** Saves an item's metadata (when it's viewed or added), returning its row. */
export async function saveRecord(r: CatalogRecord) {
  const data = {
    type: r.type,
    title: r.title,
    altTitle: r.altTitle,
    authors: r.authors,
    language: r.language,
    year: r.year,
    abstract: r.abstract,
    subjects: r.subjects,
    coverUrl: r.coverUrl,
    pdfUrl: r.pdfUrl,
    htmlUrl: r.htmlUrl,
    license: r.license,
    licenseUrl: r.licenseUrl,
    attribution: r.attribution,
    sourceUrl: r.sourceUrl,
  };
  return db.catalogItem.upsert({
    where: { source_sourceId: { source: r.source, sourceId: r.sourceId } },
    create: { source: r.source, sourceId: r.sourceId, ...data },
    update: data,
  });
}
