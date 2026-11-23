import "server-only";
import { db } from "@/lib/db";
import { cached, getJson } from "./http";
import { searchSource, toRecord } from "./index";
import { fromOpenAlex, openAlexUrl, type OpenAlexWork } from "./openalex";
import type { CatalogRecord, SearchQuery, SourceId } from "./types";

const SOURCE_TIMEOUT_MS = 12_000;

export type ExploreQuery = SearchQuery & { sources?: SourceId[] };
export type SourceStatus = { source: SourceId; ok: boolean };

/** The sources worth asking for this language and type. */
export function sourcesFor(q: Pick<ExploreQuery, "language" | "type" | "sources">): SourceId[] {
  const all: SourceId[] =
    q.language === "ar"
      ? ["aco", "archive", "openalex", "gutenberg", "doab"]
      : q.language === "en"
        ? ["gutenberg", "openalex", "europepmc", "archive", "doab", "arxiv"]
        : ["aco", "gutenberg", "openalex", "archive", "europepmc", "doab", "arxiv"];
  const papers: SourceId[] = ["openalex", "arxiv", "europepmc"];
  const byType = all.filter((s) => (q.type === "paper" ? papers.includes(s) : q.type === "book" ? !papers.includes(s) || s === "openalex" : true));
  return q.sources?.length ? byType.filter((s) => q.sources!.includes(s)) : byType;
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

/** Searches the relevant sources at once and interleaves their results. A source that fails is reported, not fatal. */
export async function explore(q: ExploreQuery) {
  const sources = sourcesFor(q);
  const settled = await Promise.allSettled(sources.map((s) => withTimeout(searchSource(s, q), SOURCE_TIMEOUT_MS)));
  const lists: CatalogRecord[][] = [];
  const status: SourceStatus[] = [];
  let more = false;
  settled.forEach((r, i) => {
    status.push({ source: sources[i], ok: r.status === "fulfilled" });
    if (r.status === "fulfilled") {
      lists.push(r.value.items);
      more ||= r.value.more;
    } else {
      console.warn(`Explore: ${sources[i]} failed`, r.reason instanceof Error ? r.reason.message : r.reason);
    }
  });
  const items: CatalogRecord[] = [];
  for (let k = 0; lists.some((l) => k < l.length); k++) for (const l of lists) if (l[k]) items.push(l[k]);
  return { items, status, more };
}

export type Shelf = { id: string; items: CatalogRecord[] };

const SHELF_TTL = 24 * 3600;

/** Curated rows for the Explore home. Each is cached for a day; an empty or failing one is skipped. */
export async function shelves(): Promise<Shelf[]> {
  const live = (id: string, q: ExploreQuery & { source: SourceId }) =>
    cached(`shelf:${id}`, SHELF_TTL, async () => (await searchSource(q.source, q)).items.slice(0, 12));
  const recent = async (source: SourceId) =>
    (await db.catalogItem.findMany({ where: { source }, orderBy: { syncedAt: "desc" }, take: 12 })).map(toRecord);
  const monthPapers = () =>
    cached("shelf:papers-month", SHELF_TTL, async () => {
      const body = await getJson<{ results: OpenAlexWork[] }>(
        openAlexUrl({ query: "", page: 1, language: "en", type: "paper", sinceDays: 30, sort: "cited_by_count:desc" }, process.env.OPENALEX_API_KEY),
      );
      return body.results.map(fromOpenAlex).filter((r): r is CatalogRecord => r !== null).slice(0, 12);
    });

  const rows: [string, () => Promise<CatalogRecord[]>][] = [
    ["arabicClassics", () => live("arabic-classics", { source: "aco", query: "ديوان", page: 1 })],
    ["classicNovels", () => live("classic-novels", { source: "gutenberg", query: "", page: 1, language: "en" })],
    ["arabicOldPrints", () => live("arabic-old-prints", { source: "archive", query: "", page: 1, language: "ar" })],
    ["papersMonth", monthPapers],
    ["openScience", () => live("open-science", { source: "europepmc", query: "", page: 1 })],
    ["arabicResearch", () => live("arabic-research", { source: "openalex", query: "", page: 1, language: "ar", type: "paper" })],
    ["newBooks", () => recent("doab")],
    ["arxivNew", () => recent("arxiv")],
  ];
  const settled = await Promise.allSettled(rows.map(([, load]) => withTimeout(load(), SOURCE_TIMEOUT_MS)));
  return rows
    .map(([id], i) => ({ id, items: settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<CatalogRecord[]>).value : [] }))
    .filter((s) => s.items.length > 0);
}
