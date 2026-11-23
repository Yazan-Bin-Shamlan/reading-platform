import "server-only";
import type { DocLang } from "./prompts";
import type { AiProvider } from "./provider";
import type { RawTerm, TermKind } from "./schemas";

// A stand-in for local development without GEMINI_API_KEY. It marks long
// words and capitalised names with simple rules and labels every explanation
// as a demo, so the whole Smart Assist flow can be tried and tested offline.
// Never used in production (see getProvider).

const DEMO = "[Demo]";
const AR_NAMES: [string, TermKind, string][] = [
  ["ابن خلدون", "person", "Ibn Khaldun"],
  ["ابن رشد", "person", "Averroes"],
  ["الجاحظ", "person", "Al-Jahiz"],
  ["المأمون", "person", "Al-Ma'mun"],
  ["قرطبة", "place", "Córdoba"],
  ["بيت الحكمة", "org", "House of Wisdom"],
  ["كليلة ودمنة", "concept", "Kalila and Dimna"],
];
const EN_NOT_NAMES = new Set(["The", "A", "An", "Her", "His", "Our", "Every", "It", "In", "Of", "And", "Abstract", "Keywords", "Chapter", "Part"]);
const EN_PLACES = new Set(["London", "Paris", "Cairo", "Baghdad", "Córdoba", "Cordoba", "Damascus"]);

function term(p: number, text: string, kind: TermKind, difficulty: number, extra: Partial<RawTerm> = {}): RawTerm {
  return {
    p,
    text,
    kind,
    difficulty,
    lemma: text.toLowerCase(),
    pos: kind === "word" ? "word" : "",
    ipa: "",
    translation: `${DEMO} ترجمة «${text}»`,
    simple: `${DEMO} A simple meaning of “${text}”.`,
    simpleAr: `${DEMO} معنى مبسّط لـ«${text}».`,
    context: `${DEMO} What “${text}” means in this sentence.`,
    contextAr: `${DEMO} معنى «${text}» في هذه الجملة.`,
    example: `${DEMO} An example with “${text}”.`,
    nameEn: "",
    nameAr: "",
    why: "",
    whyAr: "",
    ...extra,
  };
}

function english(paragraphs: string[]): RawTerm[] {
  const out: RawTerm[] = [];
  const seen = new Set<string>();
  paragraphs.forEach((para, i) => {
    for (const m of para.matchAll(/\b(?:Ibn|Al|Van|De) [A-Z][a-z]+|\b[A-Z][a-z]{2,}(?: [A-Z][a-z]{2,})?/g)) {
      const name = m[0];
      const atStart = m.index === 0 || /[.!?]\s+$/.test(para.slice(Math.max(0, m.index - 3), m.index));
      if (seen.has(name) || EN_NOT_NAMES.has(name.split(" ")[0]) || (atStart && !name.includes(" "))) continue;
      seen.add(name);
      const kind: TermKind = EN_PLACES.has(name) ? "place" : "person";
      out.push(
        term(i + 1, name, kind, 3, {
          lemma: name,
          nameEn: name,
          why: `${DEMO} Why this paragraph mentions ${name}.`,
          whyAr: `${DEMO} سبب ذكر ${name} في هذه الفقرة.`,
        }),
      );
    }
    for (const m of para.matchAll(/\b[a-z]{9,}\b/g)) {
      const w = m[0];
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(term(i + 1, w, "word", Math.min(5, w.length - 7), { ipa: `/${w}/` }));
    }
  });
  return out.slice(0, 30);
}

function arabic(paragraphs: string[]): RawTerm[] {
  const out: RawTerm[] = [];
  const seen = new Set<string>();
  paragraphs.forEach((para, i) => {
    for (const [name, kind, en] of AR_NAMES) {
      if (seen.has(name) || !para.includes(name)) continue;
      seen.add(name);
      out.push(
        term(i + 1, name, kind, 3, {
          lemma: name,
          nameEn: en,
          nameAr: name,
          translation: en,
          simple: `${DEMO} تعريف مبسّط بـ«${name}».`,
          why: `${DEMO} سبب ذكر «${name}» في هذه الفقرة.`,
        }),
      );
    }
    for (const m of para.matchAll(/[ء-يً-ْ]{7,}/g)) {
      const w = m[0];
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(
        term(i + 1, w, "word", 3, {
          translation: `${DEMO} English gloss`,
          simple: `${DEMO} معنى «${w}» بعربية بسيطة.`,
          context: `${DEMO} معنى «${w}» في هذه الجملة.`,
          example: `${DEMO} مثال على «${w}».`,
          simpleAr: "",
          contextAr: "",
        }),
      );
    }
  });
  return out.slice(0, 30);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createDemo(): AiProvider {
  return {
    name: "demo",
    model: (tier) => `demo-${tier}`,
    async analyzePage(lang: DocLang, paragraphs: string[]) {
      await wait(800); // feel like a real request
      return lang === "ar" ? arabic(paragraphs) : english(paragraphs);
    },
    async explainTerm(lang, text) {
      await wait(400);
      return term(1, text, text.includes(" ") ? "phrase" : "word", 3, lang === "ar" ? { simpleAr: "", contextAr: "" } : {});
    },
    async explainMore(_lang, text) {
      await wait(600);
      return {
        more: `${DEMO} A longer explanation of “${text}” appears here once GEMINI_API_KEY is set.`,
        moreAr: `${DEMO} يظهر هنا شرح أوسع لـ«${text}» بعد إضافة مفتاح GEMINI_API_KEY.`,
        examples: [`${DEMO} Another example with “${text}”.`],
      };
    },
    async explainParagraph() {
      await wait(600);
      return {
        summary: `${DEMO} A simple explanation of the selected passage appears here once GEMINI_API_KEY is set.`,
        summaryAr: `${DEMO} يظهر هنا شرح مبسّط للمقطع المحدد بعد إضافة مفتاح GEMINI_API_KEY.`,
        points: [],
      };
    },
  };
}
