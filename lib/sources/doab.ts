// DOAB, the Directory of Open Access Books (https://directory.doabooks.org).
// Its search API only admits registered addresses, so we harvest the open
// OAI-PMH feed (metadata CC0) in its full "xoai" format, which carries each
// book's license and files.
import { normalizeLicense } from "./license";
import { personName } from "./gutenberg";
import type { CatalogRecord } from "./types";

export const DOAB_OAI = "https://directory.doabooks.org/oai/request";

type Field = { "@name": string; "#text"?: string | number };
type Element = { "@name": string; element?: Element[]; field?: Field[] };

/** xoai nests fields as element/element/…/field; flatten to "dc.title" → values. */
export function flattenXoai(root: { element?: Element[] }) {
  const values = new Map<string, string[]>();
  const files: Record<string, string>[] = [];
  const walk = (el: Element, path: string[]) => {
    const here = [...path, el["@name"]];
    if (here[0] === "bundles" && el["@name"] === "bitstream") {
      files.push(Object.fromEntries((el.field ?? []).map((f) => [f["@name"], String(f["#text"] ?? "")])));
      return;
    }
    for (const f of el.field ?? []) {
      if (f["@name"] !== "value") continue;
      // Drop the language-of-cataloguing level ("en_US", "none") from the key.
      const key = here.filter((p) => !/^(none|[a-z]{2,3}_[A-Z]{2})$/.test(p)).join(".");
      values.set(key, [...(values.get(key) ?? []), String(f["#text"] ?? "")]);
    }
    for (const child of el.element ?? []) walk(child, here);
  };
  for (const el of root.element ?? []) walk(el, []);
  return { values, files };
}

const LANGS: Record<string, "ar" | "en"> = { ara: "ar", ar: "ar", eng: "en", en: "en" };

export function fromDoab(metadata: unknown, handle: string): CatalogRecord | null {
  const root = (metadata as { metadata?: { element?: Element[] } })?.metadata;
  if (!root) return null;
  const { values, files } = flattenXoai(root);
  const one = (k: string) => values.get(k)?.[0]?.trim() || null;
  const language = (values.get("dc.language") ?? []).map((l) => LANGS[l.trim().toLowerCase()]).find(Boolean);
  const pdf = files.find((f) => f.format === "application/pdf");
  // A PDF hosted by DOAB, else the book's download link when it points straight at a PDF;
  // otherwise (or on the OAPEN Library) readers follow the link to read it there.
  const download = files.map((f) => f.oapenidentifierdownloadUrl).find((u) => u && isDirectPdf(u));
  const license = normalizeLicense(pdf?.rightsuri || files.find((f) => f.rightsuri)?.rightsuri || pdf?.rights);
  const title = one("dc.title");
  if (!language || !license || !title) return null;
  const authors = values.get("dc.contributor.author") ?? values.get("dc.contributor.editor") ?? [];
  const publisher = one("linkedItemsMetadata.oapen.relation.isPublishedBy.publisher.name") ?? one("oapen.imprint");
  return {
    source: "doab",
    sourceId: handle,
    type: "book",
    title,
    altTitle: null,
    authors: authors.slice(0, 10).map(personName),
    language,
    year: Number(one("dc.date.issued")?.slice(0, 4)) || null,
    abstract: one("dc.description.abstract")?.slice(0, 4000) ?? null,
    subjects: [...(values.get("dc.subject.other") ?? []), ...(values.get("dc.subject.classification") ?? []).map((s) => s.split("::").pop()!)]
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8),
    coverUrl: files.find((f) => f.format?.startsWith("image/"))?.url ?? null,
    pdfUrl: pdf?.url ?? download ?? null,
    htmlUrl: null,
    license: license.code,
    licenseUrl: license.url,
    attribution: `${publisher ? `${publisher}. ` : ""}Listed in the Directory of Open Access Books (DOAB).`,
    sourceUrl: one("dc.identifier.uri") ?? `https://directory.doabooks.org/handle/${handle}`,
  };
}

/**
 * A link that serves the PDF itself, which our server may fetch. The OAPEN
 * Library sits behind an anti-bot check that refuses servers, so its books
 * are read on its own site instead.
 */
export const isDirectPdf = (url: string) =>
  /^https?:\/\//.test(url) && /\.pdf(\?|$)/i.test(url) && !/(^|\.)oapen\.org\//.test(new URL(url).host + "/");

/** "oai:directory.doabooks.org:20.500.12854/186729" → "20.500.12854/186729". */
export const doabHandle = (identifier: string) => identifier.split(":").pop()!;
