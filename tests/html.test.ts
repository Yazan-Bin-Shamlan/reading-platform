import { describe, expect, it } from "vitest";
import { htmlBlocks, htmlToPages } from "@/lib/text/html";

const html = `<html><head><title>x</title><style>p{}</style></head><body>
<section class="pg-boilerplate"><p>The Project Gutenberg eBook of <i>A Tale</i></p></section>
<h1>A TALE OF TWO CITIES</h1>
<h2>CHAPTER I.<br/>The Period</h2>
<p>It was the best of times,
   it was the worst of times.</p>
<div class="poem"><span>A line of verse</span><br/><span>and another</span></div>
<ul><li>One</li><li>Two</li></ul>
<img src="x.jpg"/>
<h2>CHAPTER II.</h2>
<p>${"Long sentence here. ".repeat(40)}</p>
</body></html>`;

describe("HTML books", () => {
  it("keeps paragraphs and headings in order, skipping images and styles", () => {
    expect(htmlBlocks(html).map((b) => `${b.k}:${b.text.slice(0, 30)}`)).toEqual([
      "p:The Project Gutenberg eBook of",
      "h:A TALE OF TWO CITIES",
      "h:CHAPTER I. The Period",
      "p:It was the best of times, it w",
      "p:A line of verse and another",
      "p:One",
      "p:Two",
      "h:CHAPTER II.",
      "p:Long sentence here. Long sente",
    ]);
  });

  it("pages by size, starts chapters on a new page and builds contents", () => {
    const { pages, toc } = htmlToPages(html, 400);
    expect(pages.length).toBeGreaterThan(2);
    expect(toc.map((e) => [e.title, e.page])).toEqual([
      ["A TALE OF TWO CITIES", 0],
      ["CHAPTER I. The Period", 0],
      ["CHAPTER II.", pages.findIndex((p) => p.text.startsWith("CHAPTER II."))],
    ]);
    for (const p of pages) {
      for (const b of p.blocks) expect(p.text.slice(b.s, b.e).length).toBeGreaterThan(0);
      expect(p.words).toBeGreaterThan(0);
    }
  });
});
