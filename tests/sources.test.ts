import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { acoAuthor, acoYear, fromAco, type AcoDoc } from "@/lib/sources/aco";
import { fromArxiv } from "@/lib/sources/arxiv";
import { doabHandle, fromDoab, isDirectPdf } from "@/lib/sources/doab";
import { fromGutendex, personName, type GutendexBook } from "@/lib/sources/gutenberg";
import { parseOai } from "@/lib/sources/oai";
import { fromOpenAlex, rebuildAbstract, type OpenAlexWork } from "@/lib/sources/openalex";

const fixture = (name: string) => readFileSync(`tests/fixtures/sources/${name}`, "utf8");

describe("DOAB (real xoai record)", () => {
  it("maps title, authors, license, PDF and cover; skips languages we don't show", () => {
    const [rec] = parseOai(fixture("doab-xoai.xml")).records;
    expect(doabHandle(rec.identifier)).toBe("20.500.12854/186729");
    // This record is in Polish, so it's left out...
    expect(fromDoab(rec.metadata, "20.500.12854/186729")).toBeNull();
    // ...but in English it maps fully.
    const english = JSON.parse(JSON.stringify(rec.metadata).replace('"pol"', '"eng"'));
    const r = fromDoab(english, "20.500.12854/186729")!;
    expect(r).toMatchObject({
      title: "Funkcjonowanie MŚP w gospodarce rynkowej",
      authors: ["Agnieszka Rzepka", "Paweł Bańkowski", "Julia Boiko"],
      language: "en",
      year: 2026,
      license: "cc-by-sa",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      sourceUrl: "https://directory.doabooks.org/handle/20.500.12854/186729",
    });
    expect(r.pdfUrl).toMatch(/^https:\/\/directory\.doabooks\.org\/bitstream\/.+\.pdf$/);
    expect(r.coverUrl).toMatch(/\.jpg$/);
    expect(r.attribution).toContain("Lublin University of Technology Publishing House");
  });
  it("treats only direct PDF links as readable", () => {
    expect(isDirectPdf("https://editorialmarcaribe.es/ark:10951/isbn.9789915715094/ebook.pdf")).toBe(true);
    // OAPEN refuses servers (anti-bot check): read there instead.
    expect(isDirectPdf("https://library.oapen.org/bitstream/20.500.12657/106183/1/9789518589672.pdf")).toBe(false);
    expect(isDirectPdf("https://doi.org/10.5771/9783748956785")).toBe(false);
    expect(isDirectPdf("https://elibrary.duncker-humblot.com/book/63478/rechtsfortbildungsgleichheit")).toBe(false);
  });
});

describe("arXiv (real OAI record)", () => {
  it("keeps CC0/CC papers with their license", () => {
    const [rec] = parseOai(fixture("arxiv-oai.xml")).records;
    const r = fromArxiv(rec.metadata)!;
    expect(r).toMatchObject({ sourceId: "2401.00001", license: "cc0", pdfUrl: "https://arxiv.org/pdf/2401.00001", type: "paper" });
    expect(r.title).toBe("Sector Rotation by Factor Model and Fundamental Analysis");
    expect(r.attribution).toContain("Thank you to arXiv");
  });
  it("leaves out papers under arXiv's default license", () => {
    const meta = { arXiv: { id: "2401.00002", title: "T", license: "http://arxiv.org/licenses/nonexclusive-distrib/1.0/" } };
    expect(fromArxiv(meta)).toBeNull();
  });
});

describe("OpenAlex (real API response)", () => {
  it("maps a CC-BY work and rebuilds its abstract", () => {
    const w = JSON.parse(fixture("openalex.json")).results[0] as OpenAlexWork;
    const r = fromOpenAlex(w)!;
    expect(r.license).toBe("cc-by");
    expect(r.sourceId).toMatch(/^W\d+$/);
    expect(r.language).toBe("en");
    expect(rebuildAbstract({ Hello: [0], world: [1, 3], big: [2] })).toBe("Hello world big world");
  });
  it("leaves out works without an open license", () => {
    const w = { ...(JSON.parse(fixture("openalex.json")).results[0] as OpenAlexWork) };
    expect(fromOpenAlex({ ...w, best_oa_location: { ...w.best_oa_location!, license: "publisher-specific-oa" } })).toBeNull();
  });
});

describe("ACO (real search response)", () => {
  it("maps an Arabic book with its Arabic title and PDF", () => {
    const body = JSON.parse(fixture("aco-search.json"));
    const doc = (body.response ?? body).docs[0] as AcoDoc;
    const r = fromAco(doc)!;
    expect(r.language).toBe("ar");
    expect(r.license).toBe("public-domain");
    expect(r.title).toMatch(/[؀-ۿ]/);
    expect(r.pdfUrl).toMatch(/_lo\.pdf$/);
    expect(r.coverUrl).toContain("/full/!400,400/");
  });
  it("sends scans over the size limit to ACO's own viewer", () => {
    const body = JSON.parse(fixture("aco-search.json"));
    const doc = (body.response ?? body).docs[0] as AcoDoc;
    const big = { ...doc, zm_pdf_lo: [{ uri: "http://mc.dlib.nyu.edu/x_lo.pdf", filesize: "60088028" }] };
    expect(fromAco(big)!.pdfUrl).toBeNull();
  });
  it("tidies catalogue names and dates", () => {
    expect(acoAuthor("نافع، محمد مبروك،, مؤلف.")).toBe("نافع، محمد مبروك");
    expect(acoAuthor("Khalaf al-Aḥmar, d. ca. 796")).toBe("Khalaf al-Aḥmar");
    expect(acoYear("1358 [H.] = 1939 [M.]")).toBe(1939);
    expect(acoYear("1323 [1905]")).toBe(1905);
    expect(acoYear("1358 [H.]")).toBeNull();
  });
});

describe("Gutenberg (documented Gutendex shape)", () => {
  const book: GutendexBook = {
    id: 98,
    title: "A Tale of Two Cities",
    authors: [{ name: "Dickens, Charles", birth_year: 1812, death_year: 1870 }],
    subjects: ["France -- History -- Revolution, 1789-1799 -- Fiction"],
    bookshelves: ["Category: Novels"],
    languages: ["en"],
    copyright: false,
    media_type: "Text",
    formats: {
      "text/html": "https://www.gutenberg.org/ebooks/98.html.images",
      "image/jpeg": "https://www.gutenberg.org/cache/epub/98/pg98.cover.medium.jpg",
    },
    download_count: 1,
  };
  it("maps a public-domain book with an HTML edition", () => {
    expect(fromGutendex(book)).toMatchObject({
      title: "A Tale of Two Cities",
      authors: ["Charles Dickens"],
      htmlUrl: "https://www.gutenberg.org/ebooks/98.html.images",
      license: "public-domain",
      subjects: ["France", "Novels"],
    });
    expect(personName("Plato")).toBe("Plato");
  });
  it("leaves out books still in copyright or with unknown status", () => {
    expect(fromGutendex({ ...book, copyright: true })).toBeNull();
    expect(fromGutendex({ ...book, copyright: null })).toBeNull();
  });
});
