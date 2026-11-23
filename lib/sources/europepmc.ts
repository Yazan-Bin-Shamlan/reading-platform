// Europe PMC (https://europepmc.org): open-access life-science papers. Only
// articles in its open-access full-text set whose license is Creative Commons
// or public domain. They open in Reading mode from the full text XML, which
// its REST API serves (the site's PDF links sit behind a browser check).
import { normalizeLicense } from "./license";
import type { CatalogRecord, SearchQuery } from "./types";

export type EpmcResult = {
  id: string;
  source: string;
  pmcid?: string;
  doi?: string;
  title?: string;
  authorString?: string;
  authorList?: { author?: { fullName?: string; collectiveName?: string }[] };
  pubYear?: string;
  language?: string;
  license?: string;
  isOpenAccess?: string;
  inEPMC?: string;
  abstractText?: string;
  keywordList?: { keyword?: string[] };
  journalInfo?: { journal?: { title?: string } };
};

export type EpmcSearch = { hitCount?: number; nextCursorMark?: string; resultList?: { result?: EpmcResult[] } };

const REST = "https://www.ebi.ac.uk/europepmc/webservices/rest";
// Europe PMC's license values ("cc by", "cc by-nc-nd", "cc0") for those we accept.
const LICENSES = ["cc by", "cc by-sa", "cc by-nd", "cc by-nc", "cc by-nc-sa", "cc by-nc-nd", "cc0"]
  .map((l) => `LICENSE:"${l}"`)
  .join(" OR ");
const FILTER = `OPEN_ACCESS:Y AND IN_PMC:Y AND (${LICENSES})`;

export function epmcSearchUrl(q: SearchQuery, cursor = "*") {
  const term = q.query.replace(/["()]/g, " ").replace(/\s+/g, " ").trim();
  const params = new URLSearchParams({
    query: term ? `(${term}) AND ${FILTER}` : FILTER,
    format: "json",
    resultType: "core",
    pageSize: "20",
    cursorMark: cursor,
  });
  if (!term) params.set("sort", "P_PDATE_D desc");
  return `${REST}/search?${params}`;
}

export const epmcItemUrl = (pmcid: string) =>
  `${REST}/search?${new URLSearchParams({ query: `PMCID:${pmcid}`, format: "json", resultType: "core", pageSize: "1" })}`;

export const epmcTextUrl = (pmcid: string) => `${REST}/${encodeURIComponent(pmcid)}/fullTextXML`;

export function fromEpmc(r: EpmcResult): CatalogRecord | null {
  const license = normalizeLicense(r.license);
  if (!license || !r.pmcid || r.isOpenAccess !== "Y" || r.inEPMC !== "Y" || !r.title) return null;
  if (r.language && r.language !== "eng") return null;
  const authors =
    r.authorList?.author?.map((a) => a.fullName ?? a.collectiveName ?? "").filter(Boolean) ??
    (r.authorString ?? "").replace(/\.$/, "").split(/,\s*/).filter(Boolean);
  const journal = r.journalInfo?.journal?.title;
  const abstract = r.abstractText?.replace(/<\/?h4>/g, "\n").replace(/<[^>]+>/g, "").replace(/[ \t]+/g, " ").trim();
  return {
    source: "europepmc",
    sourceId: r.pmcid,
    type: "paper",
    title: r.title.replace(/<[^>]+>/g, "").replace(/\.$/, ""),
    altTitle: null,
    authors: authors.slice(0, 12),
    language: "en",
    year: Number(r.pubYear) || null,
    abstract: abstract ? abstract.slice(0, 4000) : null,
    subjects: (r.keywordList?.keyword ?? []).slice(0, 8),
    coverUrl: null,
    pdfUrl: null,
    htmlUrl: epmcTextUrl(r.pmcid),
    license: license.code,
    licenseUrl: license.url,
    attribution: `${journal ? `${journal}, ` : ""}via Europe PMC.`,
    sourceUrl: `https://europepmc.org/article/PMC/${r.pmcid}`,
  };
}
