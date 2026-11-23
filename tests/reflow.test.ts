import { describe, expect, it } from "vitest";
import { lineSignature, reflowPage, type TextItem } from "@/lib/text/reflow";

/** Lines of words laid out left to right, 7 units per character, 10pt text. */
function lines(rows: { text: string; y: number; x?: number; h?: number }[]): TextItem[] {
  return rows.map(({ text, y, x = 50, h = 10 }) => ({ str: text, x, y, w: text.length * 5, h }));
}

const paragraphs = (items: TextItem[]) => {
  const r = reflowPage(items);
  return r.blocks.map((b) => `${b.k}:${r.text.slice(b.s, b.e)}`);
};

describe("reflowPage", () => {
  it("joins lines into paragraphs and splits on vertical gaps", () => {
    const items = lines([
      { text: "The traveller considered the ephemeral nature", y: 700 },
      { text: "of fame before the winter came. The river", y: 686 },
      { text: "remembered a conspicuous silence.", y: 672 },
      { text: "Every scholar described the quiet harbour at dusk", y: 640 },
      { text: "with remarkable equanimity.", y: 626 },
    ]);
    expect(paragraphs(items)).toEqual([
      "p:The traveller considered the ephemeral nature of fame before the winter came. The river remembered a conspicuous silence.",
      "p:Every scholar described the quiet harbour at dusk with remarkable equanimity.",
    ]);
  });

  it("re-joins words hyphenated across lines, but keeps real hyphens", () => {
    const items = lines([
      { text: "an unprecedented and meticulous exam-", y: 700 },
      { text: "ple of a Jean-", y: 686 },
      { text: "Paul style.", y: 672 },
    ]);
    expect(paragraphs(items)).toEqual(["p:an unprecedented and meticulous example of a Jean-Paul style."]);
  });

  it("drops page numbers and known running headers", () => {
    const items = lines([
      { text: "A VERY LONG CHRONICLE", y: 760 },
      { text: "Body text that matters here.", y: 700 },
      { text: "42", y: 40 },
    ]);
    const r = reflowPage(items, { furniture: new Set([lineSignature("A very long chronicle")]) });
    expect(r.text).toBe("Body text that matters here.");
  });

  it("marks bigger text as a heading", () => {
    const items = [
      ...lines([{ text: "Chapter 3", y: 740, h: 20 }]),
      ...lines([
        { text: "It was a quiet morning in the harbour town and", y: 700 },
        { text: "nobody spoke.", y: 686 },
      ]),
    ];
    expect(paragraphs(items)).toEqual(["h:Chapter 3", "p:It was a quiet morning in the harbour town and nobody spoke."]);
  });

  it("orders a right-to-left line drawn in pieces and keeps English runs readable", () => {
    // Visual order, left to right: "Ibn" "Khaldun" then the Arabic words (rightmost first in reading).
    const items: TextItem[] = [
      { str: "في مقدمته الشهيرة", x: 200, y: 720, w: 90, h: 10 },
      { str: "Ibn", x: 50, y: 700, w: 15, h: 10 },
      { str: "Khaldun", x: 68, y: 700, w: 35, h: 10 },
      { str: "كما ذكر", x: 106, y: 700, w: 40, h: 10 },
      { str: "قال", x: 149, y: 700, w: 20, h: 10 },
    ];
    expect(reflowPage(items).text).toBe("في مقدمته الشهيرة قال كما ذكر Ibn Khaldun");
  });

  it("puts a diacritic drawn as its own item back on its letter", () => {
    // "العالِم" drawn as: م (51–56) · kasra at 57 · ل (57–60) · "العا" (60–76)
    const items: TextItem[] = [
      { str: "م", x: 51, y: 700, w: 5, h: 13 },
      { str: "ِ", x: 57, y: 704, w: 0, h: 13 },
      { str: "ل", x: 57, y: 700, w: 3, h: 13 },
      { str: "العا", x: 60, y: 700, w: 16, h: 13 },
    ];
    expect(reflowPage(items).text).toBe("العالِم");
  });

  it("reads two columns one after the other", () => {
    const col = (x: number, y0: number, words: string[]) =>
      words.map((text, k) => ({ str: text, x, y: y0 - k * 14, w: 200, h: 10 }));
    const items = [
      { str: "A Title Across Both Columns For The Paper", x: 50, y: 780, w: 460, h: 10 },
      ...col(50, 740, ["left column first line goes on", "and ends the paragraph here."]),
      ...col(310, 740, ["Right column starts a new one", "that also finishes."]),
    ];
    const out = paragraphs(items);
    expect(out.at(-2)).toBe("p:left column first line goes on and ends the paragraph here.");
    expect(out.at(-1)).toBe("p:Right column starts a new one that also finishes.");
  });

  it("maps every output character back to its item", () => {
    const items = lines([
      { text: "exam-", y: 700 },
      { text: "ple ﬁne", y: 686 },
    ]);
    const r = reflowPage(items);
    expect(r.text).toBe("example fine");
    // Each output character comes from an item character that produces it ("ﬁ" gives both f and i).
    for (const [ts, item, is, len] of r.map) {
      for (let k = 0; k < len; k++) {
        expect(items[item].str[is + k].normalize("NFKC")).toContain(r.text[ts + k]);
      }
    }
  });
});
