// Pure text heuristics used when a PDF is added. No DOM, unit-tested.

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LATIN = /[A-Za-zÀ-ɏ]/g;
const JUNK = /[�-\u0000-\u0008\u000E-\u001F]/g;

const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;

export type LanguageGuess = {
  language: "ar" | "en" | null;
  direction: "rtl" | "ltr" | "mixed" | null;
};

/** Arabic vs Latin script share. Mixed when neither clearly dominates. */
export function detectLanguage(text: string): LanguageGuess {
  const ar = count(text, ARABIC);
  const la = count(text, LATIN);
  const total = ar + la;
  if (total < 40) return { language: null, direction: null };
  const share = ar / total;
  if (share > 0.7) return { language: "ar", direction: "rtl" };
  if (share < 0.15) return { language: "en", direction: "ltr" };
  return { language: share >= 0.5 ? "ar" : "en", direction: "mixed" };
}

/**
 * Whether extracted text is usable. Scanned PDFs have (almost) no text layer;
 * some PDFs have one full of private-use glyphs that don't map to letters.
 */
export function textStatus(pages: string[]): "ok" | "scanned" | "garbled" {
  if (!pages.length) return "scanned";
  const all = pages.join("\n");
  const visible = all.replace(/\s+/g, "");
  if (visible.length / pages.length < 30) return "scanned";
  if (count(visible, JUNK) / visible.length > 0.1) return "garbled";
  const letters = count(visible, ARABIC) + count(visible, LATIN);
  if (letters / visible.length < 0.3) return "garbled";
  return "ok";
}

export type DocType = "book" | "paper" | "study" | "article" | "other";

/** A first guess the user can change with one tap. */
export function guessType(pageCount: number, firstPagesText: string): DocType {
  const t = firstPagesText.toLowerCase();
  const hasAbstract = /\babstract\b|المستخلص|الملخص|ملخص البحث/.test(t);
  const scholarly = /\breferences\b|\bdoi\b|arxiv|\bkeywords\b|الكلمات المفتاحية|المراجع/.test(t);
  const empirical = /\bparticipants\b|\brespondents\b|\bsample size\b|\bcohort\b|\bwe surveyed\b|\bwe conducted\b|عينة الدراسة|أفراد العينة/.test(t);
  if (hasAbstract && empirical && pageCount <= 150) return "study";
  if (hasAbstract && scholarly && pageCount <= 80) return "paper";
  if (pageCount >= 60) return "book";
  if (pageCount <= 20) return "article";
  return "other";
}

const JUNK_TITLE = /^(untitled|document\d*|microsoft word\b.*|title|\d+)$|\.(docx?|pdf|tex|indd|rtf|odt)$/i;

/** PDF metadata title if it looks real, otherwise a tidy version of the file name. */
export function cleanTitle(metaTitle: string | null | undefined, fileName: string): string {
  const meta = metaTitle?.replace(/\s+/g, " ").trim();
  if (meta && meta.length >= 3 && !JUNK_TITLE.test(meta)) return meta;
  const base = fileName.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").replace(/\s*-\s*/g, " – ").trim();
  return base || "Untitled";
}

export function splitAuthors(author: string | null | undefined): string[] {
  if (!author?.trim()) return [];
  return author
    .split(/\s*(?:;|&|\band\b|،|\s+و\s+)\s*/i)
    .map((a) => a.replace(/\s+/g, " ").trim())
    .filter((a) => a.length > 1)
    .slice(0, 20);
}
