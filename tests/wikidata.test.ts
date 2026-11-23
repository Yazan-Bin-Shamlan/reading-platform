import { describe, expect, it } from "vitest";
import { firstSentences, scoreCandidate, toInfo, yearOf, type WikidataEntity } from "@/lib/entities/wikidata";

const claim = (value: unknown) => [{ mainsnak: { datavalue: { value } } }];

const ibnKhaldun: WikidataEntity = {
  id: "Q9294",
  labels: { en: { value: "Ibn Khaldun" }, ar: { value: "ابن خلدون" } },
  descriptions: { en: { value: "Arab historian and sociologist" } },
  claims: {
    P31: claim({ id: "Q5" }),
    P569: claim({ time: "+1332-05-27T00:00:00Z", precision: 11 }),
    P570: claim({ time: "+1406-03-17T00:00:00Z", precision: 11 }),
    P18: claim("Ibn Khaldun.jpg"),
  },
  sitelinks: { enwiki: { title: "Ibn Khaldun" }, arwiki: { title: "ابن خلدون" } },
};
const street: WikidataEntity = {
  id: "Q1",
  labels: { en: { value: "Ibn Khaldun Street" } },
  claims: { P31: claim({ id: "Q79007" }), P625: claim({ latitude: 1, longitude: 2 }) },
};

describe("wikidata", () => {
  it("reads years, including BC", () => {
    expect(yearOf("+1332-05-27T00:00:00Z")).toBe("1332");
    expect(yearOf("-0384-00-00T00:00:00Z")).toBe("-384");
    expect(yearOf(undefined)).toBeNull();
  });

  it("prefers a human with the exact name for a person", () => {
    const person = scoreCandidate(ibnKhaldun, "Ibn Khaldun", "person", 1);
    const notPerson = scoreCandidate(street, "Ibn Khaldun", "person", 0);
    expect(person).toBeGreaterThanOrEqual(5);
    expect(notPerson).toBeLessThan(5);
  });

  it("turns an item into card facts", () => {
    const info = toInfo(ibnKhaldun);
    expect(info).toMatchObject({
      labelAr: "ابن خلدون",
      born: "1332",
      died: "1406",
      image: "Ibn Khaldun.jpg",
      wikiUrlEn: "https://en.wikipedia.org/wiki/Ibn_Khaldun",
    });
    expect(info.wikiUrlAr).toBe(`https://ar.wikipedia.org/wiki/${encodeURIComponent("ابن_خلدون")}`);
  });

  it("keeps the start of an extract short", () => {
    const text = "Ibn Khaldun was an Arab historian. He wrote the Muqaddimah. He also served as a judge in Cairo for many years.";
    expect(firstSentences(text, 70)).toBe("Ibn Khaldun was an Arab historian. He wrote the Muqaddimah.");
    expect(firstSentences("A very long first sentence that keeps going and going without end", 30)).toBe("A very long first sentence…");
  });
});
