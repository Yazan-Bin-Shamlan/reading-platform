import { describe, expect, it } from "vitest";
import { cleanTitle, detectLanguage, guessType, splitAuthors, textStatus } from "@/lib/text/analyze";

describe("detectLanguage", () => {
  it("detects Arabic", () => {
    expect(detectLanguage("بسم الله الرحمن الرحيم. هذا كتاب عن تاريخ العلوم عند العرب والمسلمين")).toEqual({
      language: "ar",
      direction: "rtl",
    });
  });
  it("detects English", () => {
    expect(detectLanguage("The history of science is the study of the development of science and knowledge.")).toEqual({
      language: "en",
      direction: "ltr",
    });
  });
  it("detects mixed text", () => {
    const text = "Introduction to machine learning تعلم الآلة هو فرع من فروع الذكاء الاصطناعي deep networks";
    expect(detectLanguage(text).direction).toBe("mixed");
  });
  it("returns null for too little text", () => {
    expect(detectLanguage("12 34")).toEqual({ language: null, direction: null });
  });
});

describe("textStatus", () => {
  const page = "This is a perfectly ordinary page of extracted text with plenty of letters in it.";
  it("ok for normal text", () => expect(textStatus([page, page])).toBe("ok"));
  it("scanned when pages have no text", () => expect(textStatus(["", " ", ""])).toBe("scanned"));
  it("garbled when glyphs don't map to letters", () =>
    expect(textStatus(["".repeat(20)])).toBe("garbled"));
});

describe("guessType", () => {
  it("paper", () => expect(guessType(12, "Abstract. We propose... References doi:10.1/x")).toBe("paper"));
  it("study", () => expect(guessType(30, "Abstract ... participants were recruited ... methodology")).toBe("study"));
  it("a methodology section alone doesn't make a study", () =>
    expect(guessType(10, "Abstract ... 2. Methodology ... References doi:10.1/x")).toBe("paper"));
  it("book", () => expect(guessType(320, "Chapter one")).toBe("book"));
  it("article", () => expect(guessType(6, "Some essay")).toBe("article"));
  it("Arabic paper", () => expect(guessType(20, "المستخلص ... الكلمات المفتاحية ... المراجع")).toBe("paper"));
});

describe("cleanTitle", () => {
  it("keeps real metadata titles", () => expect(cleanTitle("On the Origin of Species", "x.pdf")).toBe("On the Origin of Species"));
  it("falls back to the file name", () => {
    expect(cleanTitle("Microsoft Word - draft.docx", "my_great_paper.pdf")).toBe("my great paper");
    expect(cleanTitle("", "Kalila-wa-Dimna.pdf")).toBe("Kalila – wa – Dimna");
  });
});

describe("splitAuthors", () => {
  it("splits common separators", () => {
    expect(splitAuthors("Ada Lovelace; Charles Babbage")).toEqual(["Ada Lovelace", "Charles Babbage"]);
    expect(splitAuthors("A. Smith and B. Jones")).toEqual(["A. Smith", "B. Jones"]);
    expect(splitAuthors("طه حسين، العقاد")).toEqual(["طه حسين", "العقاد"]);
  });
  it("keeps 'Last, First' together", () => expect(splitAuthors("Darwin, Charles")).toEqual(["Darwin, Charles"]));
  it("empty", () => expect(splitAuthors(undefined)).toEqual([]));
});
