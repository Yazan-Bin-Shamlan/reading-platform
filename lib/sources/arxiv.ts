// arXiv (https://arxiv.org). Harvested through OAI-PMH because only that
// interface carries each paper's license; we keep the ones under Creative
// Commons or CC0. Papers under arXiv's default license may not be
// re-served by others, so they're left out.
import { normalizeLicense } from "./license";
import type { CatalogRecord } from "./types";

export const ARXIV_OAI = "https://oaipmh.arxiv.org/oai";
/** arXiv asks apps to say this. */
export const ARXIV_THANKS = "Thank you to arXiv for use of its open access interoperability.";

type ArxivMeta = {
  arXiv?: {
    id: string | number;
    created?: string;
    authors?: { author: { keyname?: string; forenames?: string }[] };
    title?: string;
    categories?: string;
    license?: string;
    abstract?: string;
  };
};

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

export function fromArxiv(meta: unknown): CatalogRecord | null {
  const a = (meta as ArxivMeta)?.arXiv;
  if (!a) return null;
  const license = normalizeLicense(clean(a.license));
  const id = clean(a.id);
  const title = clean(a.title);
  if (!license || !id || !title) return null;
  return {
    source: "arxiv",
    sourceId: id,
    type: "paper",
    title,
    altTitle: null,
    authors: (a.authors?.author ?? []).slice(0, 12).map((p) => clean([p.forenames, p.keyname].filter(Boolean).join(" "))),
    language: "en",
    year: a.created ? Number(String(a.created).slice(0, 4)) : null,
    abstract: clean(a.abstract).slice(0, 4000) || null,
    subjects: clean(a.categories).split(" ").filter(Boolean),
    coverUrl: null,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    htmlUrl: null,
    license: license.code,
    licenseUrl: license.url,
    attribution: `arXiv. ${ARXIV_THANKS}`,
    sourceUrl: `https://arxiv.org/abs/${id}`,
  };
}
