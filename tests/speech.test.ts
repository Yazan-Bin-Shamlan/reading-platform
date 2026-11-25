import { describe, expect, it } from "vitest";
import { toWholeWords } from "@/lib/reader/annotations";
import { aiPieces, chunks, langOf, rankVoices } from "@/lib/speech";

const voice = (name: string, lang: string) => ({ name, lang, localService: true });

describe("voices", () => {
  // Names as macOS lists them in Chrome.
  const voices = [
    voice("Bubbles", "en-US"),
    voice("Fred", "en-US"),
    voice("Samantha", "en-US"),
    voice("Ava (Premium)", "en-US"),
    voice("Daniel", "en-GB"),
    voice("Eddy (English (United States))", "en-US"),
    voice("Google UK English Female", "en-GB"),
    voice("Majed", "ar-001"),
    voice("Majed (Enhanced)", "ar-001"),
  ];
  it("puts natural voices first and leaves out novelty ones", () => {
    const en = rankVoices(voices, "en").map((v) => v.name);
    expect(en[0]).toBe("Ava (Premium)");
    expect(en[1]).toBe("Google UK English Female");
    expect(en).not.toContain("Bubbles");
    expect(en.slice(-2)).toEqual(["Eddy (English (United States))", "Fred"]);
    expect(rankVoices(voices, "ar").map((v) => v.name)).toEqual(["Majed (Enhanced)", "Majed"]);
  });
  it("reads a passage in its main language", () => {
    expect(langOf("The council considered an ambiguous promise.")).toBe("en");
    expect(langOf("كان الرحالة يتساءل عن مخطوطات بيت الحكمة")).toBe("ar");
    expect(langOf("قرأ كتاب Darwin عن الأصول")).toBe("ar");
  });
});

describe("chunks", () => {
  it("keeps short text whole", () => {
    expect(chunks("Hello there.  How are you?")).toEqual(["Hello there. How are you?"]);
  });
  it("splits long passages at sentence ends, including Arabic ones", () => {
    const en = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const parts = chunks(en, 80);
    expect(parts.every((p) => p.length <= 80)).toBe(true);
    expect(parts.join(" ")).toBe(en);
    expect(parts.every((p) => p.endsWith("."))).toBe(true);
    const ar = "هل قرأت الكتاب؟ نعم قرأته. كان جميلًا جدًا.";
    expect(chunks(ar, 20)).toEqual(["هل قرأت الكتاب؟", "نعم قرأته.", "كان جميلًا جدًا."]);
  });
  it("breaks a very long sentence at commas, then spaces", () => {
    const long = "one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve";
    const parts = chunks(long, 25);
    expect(parts.every((p) => p.length <= 25)).toBe(true);
    expect(parts.join(" ")).toBe(long);
    expect(chunks("x".repeat(30) + " " + "y".repeat(30), 40)).toEqual(["x".repeat(30), "y".repeat(30)]);
  });
});

describe("toWholeWords", () => {
  const text = "debts with remarkable equanimity. Her letter illuminated the war.";
  it("widens a selection that starts or ends mid-word", () => {
    const start = text.indexOf("markable");
    const end = text.indexOf("illuminated") + 3;
    const r = toWholeWords({ page: 0, start, endPage: 0, end }, text, text);
    expect(text.slice(r.start, r.end)).toBe("remarkable equanimity. Her letter illuminated");
  });
  it("leaves whole words and Arabic words alone or completes them", () => {
    const start = text.indexOf("with");
    const r = toWholeWords({ page: 0, start, endPage: 0, end: start + 4 }, text, text);
    expect(text.slice(r.start, r.end)).toBe("with");
    const ar = "كان الرحالة يتساءل";
    const a = toWholeWords({ page: 0, start: 6, endPage: 0, end: 9 }, ar, ar);
    expect(ar.slice(a.start, a.end)).toBe("الرحالة");
  });
});

describe("aiPieces", () => {
  it("starts with a short piece, then full-size ones, losing nothing", () => {
    const text = Array.from({ length: 30 }, (_, i) => `كان الرحالة يتساءل عن المخطوطة رقم ${i}.`).join(" ");
    const pieces = aiPieces(text);
    expect(pieces[0].length).toBeLessThanOrEqual(200);
    expect(pieces.slice(1).every((p) => p.length <= 500)).toBe(true);
    expect(pieces.slice(1, -1).every((p) => p.length > 300)).toBe(true);
    expect(pieces.join(" ")).toBe(text);
    expect(aiPieces("  ")).toEqual([]);
    expect(aiPieces("Short one.")).toEqual(["Short one."]);
  });
});
