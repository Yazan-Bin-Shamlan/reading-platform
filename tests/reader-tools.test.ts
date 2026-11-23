import { describe, expect, it } from "vitest";
import type { Annotation } from "@/lib/reader/annotations";
import { covers, onPage } from "@/lib/reader/annotations";
import { fileSlug, notesToMarkdown } from "@/lib/reader/export";
import { itemToText, textToItems } from "@/lib/reader/text-map";
import { chapterEnd, minutesLeft } from "@/lib/reader/time-left";
import { fold, searchPages } from "@/lib/text/search";
import type { MapRun } from "@/lib/text/reflow";

const ann = (a: Partial<Annotation>): Annotation => ({
  id: "x",
  kind: "highlight",
  color: "yellow",
  pageIndex: 0,
  start: 0,
  endPage: null,
  end: 5,
  quote: null,
  prefix: null,
  suffix: null,
  note: null,
  createdAt: "2026-11-23T10:00:00.000Z",
  ...a,
});

describe("search", () => {
  it("ignores Arabic diacritics, tatweel and letter shapes", () => {
    const text = "ظلّ العالِم يتأمّل الأميرة ومكتبـــة المدينة";
    expect(searchPages([{ i: 3, text }], "العالم")).toEqual([{ page: 3, start: 4, end: 11 }]);
    expect(searchPages([{ i: 3, text }], "الاميره")).toHaveLength(1);
    const [hit] = searchPages([{ i: 0, text }], "مكتبة");
    expect(text.slice(hit.start, hit.end)).toBe("مكتبـــة");
  });

  it("ignores case and Latin accents", () => {
    const hits = searchPages([{ i: 0, text: "Café society. CAFE life." }], "cafe");
    expect(hits.map((h) => h.start)).toEqual([0, 14]);
  });

  it("maps folded positions back to the original text", () => {
    const f = fold("a  b");
    expect(f.text).toBe("a b");
    expect(f.index).toEqual([0, 1, 3]);
  });
});

describe("text map", () => {
  const map: MapRun[] = [
    [0, 0, 0, 5],
    [6, 2, 0, 4],
  ];
  it("converts both ways", () => {
    expect(itemToText(map, 2, 1)).toBe(7);
    expect(textToItems(map, 3, 8)).toEqual([
      { item: 0, start: 3, end: 5 },
      { item: 2, start: 0, end: 2 },
    ]);
  });
  it("snaps unmapped characters to the nearest mapped one", () => {
    expect(itemToText(map, 2, 9)).toBe(10);
    expect(itemToText(map, 1, 0)).toBeNull();
  });
});

describe("annotations", () => {
  it("splits a range across pages", () => {
    const r = { page: 2, start: 50, endPage: 4, end: 10 };
    expect(onPage(r, 2, 300)).toEqual([50, 300]);
    expect(onPage(r, 3, 280)).toEqual([0, 280]);
    expect(onPage(r, 4, 290)).toEqual([0, 10]);
    expect(onPage(r, 5, 100)).toBeNull();
  });
  it("finds the highlight under a point", () => {
    const a = ann({ pageIndex: 1, start: 10, end: 20 });
    expect(covers(a, 1, 15)).toBe(true);
    expect(covers(a, 1, 25)).toBe(false);
    expect(covers(a, 0, 15)).toBe(false);
  });
});

describe("markdown export", () => {
  it("groups by page in reading order", () => {
    const md = notesToMarkdown(
      { title: "The Quiet Harbour", authors: ["Test Author"] },
      [
        ann({ id: "b", pageIndex: 4, start: 3, quote: "Second", note: "Why?", kind: "note" }),
        ann({ id: "a", pageIndex: 1, start: 0, quote: "First line\nnext" }),
        ann({ id: "c", pageIndex: 4, start: null, end: null, kind: "bookmark", color: null }),
      ],
      { by: "By", exported: "Exported", page: (n) => `Page ${n}`, bookmark: "Bookmark" },
      new Date("2026-11-23"),
    );
    expect(md).toBe(
      "# The Quiet Harbour\n\nBy Test Author  \n_Exported 2026-11-23_\n\n## Page 2\n\n> First line\n> next\n\n## Page 5\n\n- 🔖 Bookmark\n\n> Second\n\nWhy?\n",
    );
  });
  it("makes safe file names", () => {
    expect(fileSlug("حكايات الرحالة: الجزء 1")).toBe("حكايات-الرحالة-الجزء-1");
    expect(fileSlug("???")).toBe("notes");
  });
});

describe("time left", () => {
  it("counts the rest of the page and the pages up to the chapter end", () => {
    expect(chapterEnd([{ title: "1", page: 0 }, { title: "2", page: 10 }], 3, 50)).toBe(10);
    expect(chapterEnd([{ title: "1", page: 0 }], 3, 50)).toBe(50);
    const words = [100, 200, 300, 400];
    expect(minutesLeft(words, 1, 0.5, 4, 100)).toBe(8);
  });
});
