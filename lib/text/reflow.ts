// Rebuilds readable paragraphs from a PDF page's positioned text items.
//
// pdf.js gives text in drawing order: fragments with positions, where Arabic
// diacritics often arrive as separate zero-width items and a right-to-left
// line comes as left-to-right pieces. This puts characters back in reading
// order, joins lines into paragraphs, drops running headers and page numbers,
// and keeps a map from every output character to its source item so the
// Original view can find the same text on the PDF's text layer.

/** One pdf.js text item, in PDF units (y is the baseline, measured from the bottom). */
export type TextItem = { str: string; x: number; y: number; w: number; h: number };

export type BlockKind = "p" | "h";
/** A paragraph (`p`) or heading (`h`): characters [s, e) of the page text. */
export type Block = { s: number; e: number; k: BlockKind };
/** Characters [textStart, textStart + length) come from item `item` at [itemStart, itemStart + length). */
export type MapRun = [textStart: number, item: number, itemStart: number, length: number];
export type PageText = { text: string; blocks: Block[]; map: MapRun[]; words: number };

/** A character and where it came from (item -1 = added by us, e.g. a space). */
type Unit = { c: string; i: number; ci: number };

type Line = {
  units: Unit[];
  y: number;
  left: number;
  right: number;
  size: number;
  rtl: boolean;
  text: string;
};

const RTL_CHAR = /[֐-ٟ٪-ۯۺ-ࣿיִ-﷿ﹰ-ﻼ]/g;
const LTR_CHAR = /[A-Za-z0-9À-ɏͰ-ϿЀ-ӿ٠-٩۰-۹]/g;
const MARKS_ONLY = /^[\s\p{M}]*\p{M}[\s\p{M}]*$/u;
const IGNORED = /[\u0000-\u0008\u000b-\u001f\u007f​‎‏‪-‮⁦-⁩﻿]/;
const TERMINAL = /[.!?؟…:;"”»)\]'’؛]$/;
const LOWER_START = /^[a-zß-ÿ]/;

const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Strong direction of a string: R(ight-to-left), L(eft-to-right) or N(eutral). */
function strong(s: string): "R" | "L" | "N" {
  const r = count(s, RTL_CHAR);
  const l = count(s, LTR_CHAR);
  return r > l ? "R" : l > 0 ? "L" : r > 0 ? "R" : "N";
}

/** Normalized, digit-insensitive form of a line, for spotting running headers and footers. */
export function lineSignature(text: string) {
  return text
    .toLowerCase()
    .replace(/[\d٠-٩۰-۹]+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

const PAGE_NUMBER = /^[\s\d٠-٩۰-۹.\-–—|·/]*[\d٠-٩۰-۹][\s\d٠-٩۰-۹.\-–—|·/]*$/;
const ROMAN_PAGE = /^\s*[ivxlc]{1,7}\s*$/i;

function toUnits(str: string, item: number): Unit[] {
  const units: Unit[] = [];
  for (let ci = 0; ci < str.length; ) {
    const cp = str.codePointAt(ci)!;
    const ch = String.fromCodePoint(cp);
    if (!IGNORED.test(ch)) {
      const norm = ch === "­" ? ch : ch.normalize("NFKC");
      // Expansions (ligatures like "ﬁ") map every output character to the same source.
      for (const c of norm) units.push({ c, i: item, ci });
    }
    ci += ch.length;
  }
  return units;
}

type Piece = { units: Unit[]; x: number; w: number; dir: "R" | "L" | "N"; item: number };

/** Characters of one visual line, in reading order. */
function buildLine(
  base: (TextItem & { idx: number })[],
  marks: (TextItem & { idx: number })[],
  pageRtl: boolean,
): Line | null {
  if (!base.length) return null;
  // A line in one script reads in that direction; a mixed line (an English
  // name in Arabic text) follows the page.
  const all = base.map((b) => b.str).join("");
  const r = count(all, RTL_CHAR);
  const l = count(all, LTR_CHAR);
  const rtl = r && l ? pageRtl : r > 0;

  const pieces: Piece[] = base
    .map((b) => ({ units: toUnits(b.str, b.idx), x: b.x, w: b.w, dir: strong(b.str), item: b.idx }))
    .sort((a, b) => a.x - b.x);

  // Put each diacritic back on the letter it sits above or below.
  for (const m of marks) {
    const chars = toUnits(m.str, m.idx).filter((u) => /\p{M}/u.test(u.c));
    if (!chars.length) continue;
    // The piece it falls inside; at a shared edge, the one starting closest before it.
    const inside = pieces.filter((p) => m.x >= p.x - 0.01 && m.x < p.x + p.w);
    const target =
      inside.sort((a, b) => b.x - a.x)[0] ??
      pieces.reduce((best, p) =>
        Math.abs(p.x + p.w / 2 - m.x) < Math.abs(best.x + best.w / 2 - m.x) ? p : best,
      );
    const letters = target.units.filter((u) => !/\p{M}/u.test(u.c));
    if (!letters.length) continue;
    const frac = target.w > 0 ? (m.x - target.x) / target.w : 0;
    const k = Math.min(letters.length - 1, Math.max(0, Math.floor((target.dir === "R" ? 1 - frac : frac) * letters.length)));
    let at = target.units.indexOf(letters[k]) + 1;
    while (at < target.units.length && /\p{M}/u.test(target.units[at].c)) at++;
    target.units.splice(at, 0, ...chars);
  }

  // Visual order → reading order: reverse the whole line if it's right-to-left,
  // then flip back runs that go the other way (an English name in Arabic text).
  const ordered = rtl ? [...pieces].reverse() : pieces;
  const other = rtl ? "L" : "R";
  for (let a = 0; a < ordered.length; a++) {
    if (ordered[a].dir !== other) continue;
    let b = a;
    for (let j = a + 1; j < ordered.length && ordered[j].dir !== (rtl ? "R" : "L"); j++) {
      if (ordered[j].dir === other) b = j;
    }
    if (b > a) ordered.splice(a, b - a + 1, ...ordered.slice(a, b + 1).reverse());
    a = b;
  }

  const size = median(base.map((b) => b.h)) || 10;
  const units: Unit[] = [];
  for (let k = 0; k < ordered.length; k++) {
    const p = ordered[k];
    if (k > 0) {
      const q = ordered[k - 1];
      const gap = Math.max(p.x - (q.x + q.w), q.x - (p.x + p.w));
      const last = units.at(-1)?.c ?? " ";
      const first = p.units[0]?.c ?? " ";
      if (gap > size * 0.18 && !/\s/.test(last) && !/\s/.test(first)) units.push({ c: " ", i: -1, ci: 0 });
    }
    units.push(...p.units);
  }
  // Collapse whitespace runs and trim.
  const clean: Unit[] = [];
  for (const u of units) {
    const ws = /\s/.test(u.c);
    if (ws && (!clean.length || /\s/.test(clean.at(-1)!.c))) continue;
    clean.push(ws && u.c !== " " ? { ...u, c: " " } : u);
  }
  while (clean.length && clean.at(-1)!.c === " ") clean.pop();
  if (!clean.length) return null;

  return {
    units: clean,
    y: median(base.map((b) => b.y)),
    left: Math.min(...base.map((b) => b.x)),
    right: Math.max(...base.map((b) => b.x + b.w)),
    size,
    rtl,
    text: clean.map((u) => u.c).join(""),
  };
}

/** Groups items into visual lines, following the order they were drawn in. */
function groupLines(items: TextItem[]): Line[] {
  const text = items.map((it) => it.str).join("");
  const pageRtl = count(text, RTL_CHAR) > count(text, LTR_CHAR);
  const groups: { y: number; size: number; base: (TextItem & { idx: number })[]; marks: (TextItem & { idx: number })[] }[] = [];
  items.forEach((it, idx) => {
    if (!it.str || /^\s+$/.test(it.str)) return;
    const isMark = MARKS_ONLY.test(it.str);
    const size = it.h || 10;
    const cur = groups.at(-1);
    if (cur && Math.abs(it.y - cur.y) <= Math.max(size, cur.size) * 0.45) {
      (isMark ? cur.marks : cur.base).push({ ...it, idx });
      if (!isMark && cur.base.length === 1) cur.y = it.y;
      return;
    }
    groups.push({ y: it.y, size, base: isMark ? [] : [{ ...it, idx }], marks: isMark ? [{ ...it, idx }] : [] });
  });
  return groups.map((g) => buildLine(g.base, g.marks, pageRtl)).filter((l): l is Line => l !== null);
}

/**
 * The column each line sits in. Columns are the x-ranges most body lines
 * cover; the few lines that cross a gutter (a full-width abstract) don't
 * close it. A line spanning several columns gets their union.
 */
function findColumns(lines: Line[], body: number) {
  const sized = lines.filter((l) => Math.abs(l.size - body) < body * 0.15);
  // Much wider than a typical line = spans columns; it says nothing about where they are.
  const typical = median(sized.map((l) => l.right - l.left));
  const bodyLines = sized.filter((l) => l.right - l.left <= typical * 1.6);
  const minX = Math.min(...lines.map((l) => l.left));
  const maxX = Math.max(...lines.map((l) => l.right));
  const bin = Math.max(1, body * 0.25);
  const cov = new Array<number>(Math.ceil((maxX - minX) / bin) + 1).fill(0);
  for (const l of bodyLines) {
    for (let b = Math.floor((l.left - minX) / bin); b <= Math.floor((l.right - minX) / bin); b++) cov[b]++;
  }
  const threshold = Math.max(1, Math.max(...cov) * 0.2);
  const segments: { left: number; right: number }[] = [];
  cov.forEach((c, b) => {
    if (c < threshold) return;
    const x = minX + b * bin;
    const last = segments.at(-1);
    if (last && x - last.right <= body * 0.8) last.right = x + bin;
    else segments.push({ left: x, right: x + bin });
  });
  return lines.map((l) => {
    const width = l.right - l.left;
    const mine = segments.filter((s) => {
      const overlap = Math.min(l.right, s.right) - Math.max(l.left, s.left);
      return overlap > 0.4 * (s.right - s.left) || overlap > 0.5 * width;
    });
    if (!mine.length) return { left: l.left, right: l.right };
    return {
      left: Math.min(l.left, ...mine.map((s) => s.left)),
      right: Math.max(l.right, ...mine.map((s) => s.right)),
    };
  });
}

export type ReflowOptions = {
  /** Signatures (see lineSignature) of running headers/footers found across the document. */
  furniture?: ReadonlySet<string>;
};

/** Top and bottom lines of a page, where running headers, footers and page numbers live. */
export function edgeLines(items: TextItem[]): string[] {
  const lines = groupLines(items);
  const byY = [...lines].sort((a, b) => b.y - a.y);
  const picks = new Set([...byY.slice(0, 2), ...byY.slice(-2)]);
  return [...picks].map((l) => lineSignature(l.text));
}

export function reflowPage(items: TextItem[], opts: ReflowOptions = {}): PageText {
  let lines = groupLines(items);
  if (!lines.length) return { text: "", blocks: [], map: [], words: 0 };

  // Drop page numbers and running headers/footers at the top and bottom edges.
  const byY = [...lines].sort((a, b) => b.y - a.y);
  const edges = new Set([...byY.slice(0, 2), ...byY.slice(-2)]);
  lines = lines.filter((l) => {
    if (!edges.has(l)) return true;
    const t = l.text.trim();
    if (t.length <= 12 && (PAGE_NUMBER.test(t) || ROMAN_PAGE.test(t))) return false;
    return !opts.furniture?.has(lineSignature(t));
  });
  if (!lines.length) return { text: "", blocks: [], map: [], words: 0 };

  const sizes = lines.flatMap((l) => Array(Math.min(50, l.units.length)).fill(l.size) as number[]);
  const body = median(sizes);
  const gaps: number[] = [];
  for (let k = 1; k < lines.length; k++) {
    const g = lines[k - 1].y - lines[k].y;
    if (g > 0 && g < body * 3 && Math.abs(lines[k].size - body) < body * 0.1) gaps.push(g);
  }
  const lineGap = median(gaps) || body * 1.3;

  const column = findColumns(lines, body);
  const isFull = (k: number) => lines[k].right - lines[k].left >= 0.85 * (column[k].right - column[k].left);
  const indent = (k: number) =>
    lines[k].rtl ? column[k].right - lines[k].right : lines[k].left - column[k].left;

  // A short line on its own with no closing punctuation and space above it: a same-size heading.
  const spaceAbove = (k: number) => k === 0 || lines[k - 1].y - lines[k].y > lineGap * 1.45;
  const headingLike = (k: number) =>
    spaceAbove(k) &&
    !TERMINAL.test(lines[k].text) &&
    lines[k].right - lines[k].left < 0.6 * (column[k].right - column[k].left) &&
    lines[k].units.length < 120;

  const breaks = (k: number) => {
    const prev = lines[k - 1];
    const cur = lines[k];
    const ends = TERMINAL.test(prev.text);
    if (Math.abs(cur.size - prev.size) > 0.12 * Math.max(cur.size, prev.size)) return true;
    if (/^([•·▪◦●■–—-]\s|\(?\d{1,3}[.)]\s|\(?[a-z][.)]\s)/.test(cur.text)) return true;
    const dy = prev.y - cur.y;
    if (dy < -cur.size) return ends || !isFull(k - 1); // jumped up: next column
    if (dy > Math.max(lineGap, cur.size * 1.3) * 1.45) return true;
    if (!isFull(k - 1) && ends) return true;
    if (headingLike(k - 1)) return true;
    if (isFull(k - 1) && indent(k) > cur.size * 1.2 && indent(k - 1) < cur.size * 0.6) return true;
    return false;
  };

  // Lines → blocks, joining with a space or by removing an end-of-line hyphen.
  const blocks: { units: Unit[]; heading: boolean }[] = [];
  let cur: Unit[] = [];
  let curHeading = true;
  let curLines = 0;
  let curFirst = 0;
  const flush = () => {
    const big = curHeading && curLines <= 4 && cur.length < 300;
    const alone = curLines === 1 && headingLike(curFirst) && !lines[curFirst + 1]?.text.match(LOWER_START);
    if (cur.length) blocks.push({ units: cur, heading: big || alone });
    cur = [];
    curHeading = true;
    curLines = 0;
  };
  lines.forEach((line, k) => {
    if (k > 0 && breaks(k)) flush();
    if (!cur.length) curFirst = k;
    if (cur.length) {
      const last = cur.at(-1)!;
      const beforeLast = cur.at(-2)?.c ?? "";
      if ((last.c === "-" || last.c === "­") && /\p{L}/u.test(beforeLast)) {
        if (last.c === "­" || LOWER_START.test(line.text)) cur.pop(); // re-join "exam-ple"
        // else keep "Jean-Paul" together without a space
      } else {
        cur.push({ c: " ", i: -1, ci: 0 });
      }
    }
    cur.push(...line.units.filter((u) => u.c !== "­" || u === line.units.at(-1)));
    curHeading &&= line.size >= body * 1.15;
    curLines++;
  });
  flush();

  // Assemble the page text, its blocks and the source map.
  let text = "";
  const out: Block[] = [];
  const map: MapRun[] = [];
  for (const b of blocks) {
    if (text) text += "\n";
    const s = text.length;
    for (const u of b.units) {
      const at = text.length;
      text += u.c;
      if (u.i < 0) continue;
      const run = map.at(-1);
      // Extend the run while text and item advance together.
      if (run && run[1] === u.i && run[0] + run[3] === at && run[2] + run[3] === u.ci) run[3] += u.c.length;
      else map.push([at, u.i, u.ci, u.c.length]);
    }
    out.push({ s, e: text.length, k: b.heading ? "h" : "p" });
  }
  const words = count(text, /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu);
  return { text, blocks: out, map, words };
}
