import { describe, expect, it } from "vitest";
import { toAnki, toCsv, type ExportWord } from "@/lib/words/export";
import { preview, review } from "@/lib/words/srs";

const now = new Date("2026-11-23T12:00:00Z");
const fresh = { intervalDays: 0, ease: 2.5, reps: 0 };

describe("review scheduling", () => {
  it("spaces good answers further and further apart", () => {
    const a = review(fresh, "good", now);
    expect(a.intervalDays).toBe(1);
    const b = review(a, "good", now);
    expect(b.intervalDays).toBe(6);
    const c = review(b, "good", now);
    expect(c.intervalDays).toBe(15);
    expect(c.dueAt.toISOString()).toBe("2026-12-08T12:00:00.000Z");
  });

  it("brings a forgotten card back in ten minutes and lowers its ease", () => {
    const r = review({ intervalDays: 15, ease: 2.5, reps: 3 }, "again", now);
    expect(r.reps).toBe(0);
    expect(r.ease).toBe(2.3);
    expect(r.dueAt.getTime() - now.getTime()).toBe(10 * 60_000);
  });

  it("orders the options from soonest to latest", () => {
    const p = preview({ intervalDays: 6, ease: 2.5, reps: 2 });
    expect(p.again).toBeLessThan(p.hard);
    expect(p.hard).toBeLessThan(p.good);
    expect(p.good).toBeLessThan(p.easy);
  });

  it("never lets ease drop below 1.3", () => {
    let card = { intervalDays: 1, ease: 1.35, reps: 1 };
    for (let i = 0; i < 5; i++) card = review(card, "again", now);
    expect(card.ease).toBe(1.3);
  });
});

const words: ExportWord[] = [
  {
    surface: "equanimity",
    lemma: "equanimity",
    lang: "en",
    translation: "رباطة جأش",
    meaning: "calmness, even in hard times",
    sentence: 'She said "fine", with equanimity.',
    source: "The Quiet Harbour",
    pageIndex: 3,
    createdAt: now,
  },
];

describe("export", () => {
  it("writes CSV with a BOM and quoted fields", () => {
    const csv = toCsv(words);
    expect(csv.startsWith("﻿word,lemma,language")).toBe(true);
    expect(csv).toContain('"She said ""fine"", with equanimity."');
    expect(csv).toContain(",The Quiet Harbour,4,2026-11-23");
  });

  it("writes an Anki import file with the word bold in its sentence", () => {
    const anki = toAnki(words, "Qiraa: My Words");
    const [, , , deck, , note] = anki.trim().split("\n");
    expect(deck).toBe("#deck:Qiraa: My Words");
    const [front, back, tags] = note.split("\t");
    expect(front).toContain("<b>equanimity</b>");
    expect(front).toContain("<i>She said \"fine\", with <b>equanimity</b>.</i>");
    expect(back).toContain("رباطة جأش");
    expect(tags).toBe("qiraa en");
  });
});
