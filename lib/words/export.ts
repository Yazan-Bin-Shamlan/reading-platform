// My Words as CSV (for spreadsheets) or as an Anki import file.

export type ExportWord = {
  surface: string;
  lemma: string;
  lang: "ar" | "en";
  translation: string | null;
  meaning: string | null;
  sentence: string;
  source: string | null;
  pageIndex: number | null;
  createdAt: Date;
};

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** UTF-8 CSV with a byte-order mark, so Excel shows Arabic correctly. */
export function toCsv(words: ExportWord[]): string {
  const head = ["word", "lemma", "language", "translation", "meaning", "sentence", "source", "page", "added"];
  const rows = words.map((w) => [
    w.surface,
    w.lemma,
    w.lang,
    w.translation,
    w.meaning,
    w.sentence,
    w.source,
    w.pageIndex === null ? null : w.pageIndex + 1,
    w.createdAt.toISOString().slice(0, 10),
  ]);
  return "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const escapeHtml = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const oneLine = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();

/** The sentence with the word in bold. */
function boldIn(sentence: string, word: string) {
  const html = escapeHtml(oneLine(sentence));
  const w = escapeHtml(word);
  const at = html.indexOf(w);
  return at < 0 ? html : `${html.slice(0, at)}<b>${w}</b>${html.slice(at + w.length)}`;
}

/**
 * Tab-separated notes for Anki's File → Import (Basic note type): the word
 * and its sentence on the front, translation and meaning on the back. The
 * header lines tell Anki the separator, that fields are HTML, and the deck.
 */
export function toAnki(words: ExportWord[], deck: string): string {
  const lines = ["#separator:tab", "#html:true", "#notetype:Basic", `#deck:${oneLine(deck)}`, "#tags column:3"];
  for (const w of words) {
    const dir = w.lang === "ar" ? ' dir="rtl"' : "";
    const front = `<div${dir}><b>${escapeHtml(oneLine(w.surface))}</b></div><div${dir}><i>${boldIn(w.sentence, w.surface)}</i></div>`;
    const back = [w.translation, w.meaning]
      .filter((x): x is string => Boolean(x))
      .map((x) => `<div dir="auto">${escapeHtml(oneLine(x))}</div>`)
      .join("");
    lines.push([front, back || "&nbsp;", `qiraa ${w.lang}`].join("\t"));
  }
  return lines.join("\n") + "\n";
}
