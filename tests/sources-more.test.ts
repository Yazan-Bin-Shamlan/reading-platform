import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromIa, iaAuthor, iaPdfUrl, iaSearchUrl, LAST_PD_YEAR, type IaDoc, type IaMetadata } from "@/lib/sources/archive";
import { epmcSearchUrl, fromEpmc, type EpmcSearch } from "@/lib/sources/europepmc";
import { htmlBlocks } from "@/lib/text/html";
import { jatsToHtml } from "@/lib/text/jats";

const fixture = (name: string) => readFileSync(`tests/fixtures/sources/${name}`, "utf8");

describe("Internet Archive (real search and metadata responses)", () => {
  const docs = (JSON.parse(fixture("archive-search.json")) as { response: { docs: IaDoc[] } }).response.docs;
  const meta = JSON.parse(fixture("archive-metadata.json")) as IaMetadata;

  it("maps a library scan marked not in copyright, by its main language", () => {
    const r = fromIa(docs.find((d) => d.identifier === "wafayatalayanwaa00ibnkuoft") ?? docs[1])!;
    expect(r).toMatchObject({ source: "archive", type: "book", license: "public-domain", pdfUrl: null });
    expect(r.language).toBe("ar");
    expect(r.year).toBeLessThanOrEqual(LAST_PD_YEAR);
    expect(r.attribution).toBe("Digitized by Robarts - University of Toronto, via the Internet Archive.");
    expect(r.sourceUrl).toBe(`https://archive.org/details/${r.sourceId}`);
  });
  it("finds the text PDF from the item's files", () => {
    const r = fromIa(meta.metadata!, meta.files)!;
    expect(r.pdfUrl).toBe("https://archive.org/download/arabicenglishvoc00cameuoft/arabicenglishvoc00cameuoft.pdf");
    expect(r.authors).toEqual(["Donald Andreas Cameron"]);
    expect(r.language).toBe("en"); // English first, Arabic second
    expect(r.abstract).toBeNull(); // the description is just "26"
    expect(iaPdfUrl("x", [{ name: "x.djvu", format: "DjVu" }])).toBeNull();
  });
  it("leaves out anything not marked not-in-copyright, too recent, or lending-only", () => {
    const base = meta.metadata!;
    expect(fromIa({ ...base, "possible-copyright-status": undefined })).toBeNull();
    expect(fromIa({ ...base, "possible-copyright-status": "UNKNOWN" })).toBeNull();
    expect(fromIa({ ...base, date: String(LAST_PD_YEAR + 1) })).toBeNull();
    expect(fromIa({ ...base, collection: ["inlibrary"] })).toBeNull();
    expect(fromIa({ ...base, "access-restricted-item": "true" })).toBeNull();
    expect(fromIa({ ...base, language: "fre" })).toBeNull();
  });
  it("tidies catalogue names and builds a safe query", () => {
    expect(iaAuthor("Habeiche, Joseph J., b. 1855")).toBe("Joseph J. Habeiche");
    expect(iaAuthor("Ibn Khallikan, 1211-1282")).toBe("Ibn Khallikan");
    const q = new URL(iaSearchUrl({ query: 'title: "x" (y)', language: "ar", page: 2 })).searchParams;
    expect(q.get("q")).toMatch(/^\(title x y\) AND mediatype:texts AND possible-copyright-status:"NOT_IN_COPYRIGHT"/);
    expect(q.get("q")).toContain(`year:[1000 TO ${LAST_PD_YEAR}]`);
    expect(q.get("page")).toBe("2");
  });
});

describe("Europe PMC (real search response)", () => {
  const results = (JSON.parse(fixture("europepmc-search.json")) as EpmcSearch).resultList!.result!;

  it("maps an open-access article with its license and full text", () => {
    const r = fromEpmc(results[1])!;
    expect(r).toMatchObject({
      source: "europepmc",
      sourceId: "PMC11674428",
      type: "paper",
      language: "en",
      license: "cc-by-nc-nd",
      pdfUrl: null,
      htmlUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11674428/fullTextXML",
      sourceUrl: "https://europepmc.org/article/PMC/PMC11674428",
    });
    expect(r.attribution).toBe("Aging brain, via Europe PMC.");
    expect(fromEpmc(results[0])!.license).toBe("cc-by");
  });
  it("leaves out articles without an open license or a PMC copy", () => {
    expect(fromEpmc({ ...results[0], license: undefined })).toBeNull();
    expect(fromEpmc({ ...results[0], license: "other" })).toBeNull();
    expect(fromEpmc({ ...results[0], pmcid: undefined })).toBeNull();
  });
  it("asks only for open-access, openly licensed articles", () => {
    const q = new URL(epmcSearchUrl({ query: 'sleep "memory"', page: 1 }, "abc")).searchParams;
    expect(q.get("query")).toMatch(/^\(sleep memory\) AND OPEN_ACCESS:Y AND IN_PMC:Y AND \(LICENSE:"cc by" OR/);
    expect(q.get("cursorMark")).toBe("abc");
  });
});

describe("JATS full text", () => {
  it("keeps title, abstract, headings, paragraphs and lists, and drops figures, tables and references", () => {
    const blocks = htmlBlocks(jatsToHtml(fixture("jats-article.xml")));
    expect(blocks).toEqual([
      { k: "h", text: "Reading in two scripts", level: 1 },
      { k: "h", text: "Abstract", level: 2 },
      { k: "p", text: "We study how readers move between Arabic and Latin text.", level: 0 },
      { k: "h", text: "Introduction", level: 2 },
      { k: "p", text: "Bilingual readers1 switch often.", level: 0 },
      { k: "h", text: "Background", level: 3 },
      { k: "p", text: "Earlier work:", level: 0 },
      { k: "p", text: "first point", level: 0 },
      { k: "p", text: "second point", level: 0 },
      { k: "h", text: "Methods", level: 2 },
      { k: "p", text: "We asked people to read.", level: 0 },
      { k: "p", text: "A quoted line.", level: 0 },
    ]);
  });
});
