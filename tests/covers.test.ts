import { describe, expect, it } from "vitest";
import { backupCoverUrl, isbnIn, mainTitle, pickCover, sameTitle } from "@/lib/sources/covers";

describe("backup covers", () => {
  it("finds the ISBN in DOAB's file links", () => {
    expect(isbnIn("https://directory.doabooks.org/bitstream/20.500.12854/184274/1/9783110557657.pdf.jpg")).toBe("9783110557657");
    expect(isbnIn(null, "https://example.org/book/9781009653381.pdf")).toBe("9781009653381");
    expect(isbnIn("https://directory.doabooks.org/bitstream/20.500.12854/1/cover.jpg")).toBeNull();
  });

  it("asks only for books", () => {
    const book = { type: "book" as const, title: "Pride and Prejudice", authors: ["Jane Austen"], coverUrl: null };
    const url = new URL(backupCoverUrl(book)!, "http://x");
    expect(url.pathname).toBe("/api/cover");
    expect(url.searchParams.get("title")).toBe("Pride and Prejudice");
    expect(url.searchParams.get("author")).toBe("Jane Austen");
    expect(url.searchParams.has("isbn")).toBe(false);
    expect(backupCoverUrl({ ...book, type: "paper" })).toBeNull();
    const doab = backupCoverUrl({ ...book, coverUrl: "https://directory.doabooks.org/bitstream/x/1/9783110557657.pdf.jpg" });
    expect(new URL(doab!, "http://x").searchParams.get("isbn")).toBe("9783110557657");
  });

  it("matches titles, ignoring subtitles, case and marks", () => {
    expect(sameTitle("Frankenstein; Or, The Modern Prometheus", "Frankenstein")).toBe(true);
    expect(sameTitle("PRIDE AND PREJUDICE", "Pride and prejudice")).toBe(true);
    expect(sameTitle("Emma", "Persuasion")).toBe(false);
    expect(sameTitle("", "Emma")).toBe(false);
    expect(mainTitle("Frankenstein; Or, The Modern Prometheus")).toBe("Frankenstein");
    expect(mainTitle("Rewriting Maimonides: Early Modern to Contemporary")).toBe("Rewriting Maimonides");
  });

  it("trusts an ISBN match, but checks the title otherwise", () => {
    const docs = [{ title: "Pride and Prejudice and Zombies", cover_i: 1 }, { title: "Persuasion", cover_i: 2 }];
    expect(pickCover([{ title: "Anything", cover_i: 7 }], "Rewriting Maimonides", true)).toBe(7);
    expect(pickCover(docs, "Persuasion", false)).toBe(2);
    expect(pickCover([{ title: "Persuasion" }], "Persuasion", false)).toBeNull();
    expect(pickCover(docs, "Emma", false)).toBeNull();
  });
});
