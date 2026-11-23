// Turns an HTML book (Project Gutenberg's editions) into the same pages of
// paragraph blocks that PDFs become, so Reading mode, search, highlights and
// Smart Assist work the same way.
import { HTMLElement, NodeType, parse, type Node } from "node-html-parser";
import type { TocEntry } from "@/lib/library/schemas";
import type { Block } from "./reflow";

export type HtmlPage = { text: string; blocks: Block[]; words: number };

const SKIP = new Set(["script", "style", "head", "nav", "img", "svg", "figure", "audio", "video", "object", "iframe", "button", "form"]);
const HEADING = /^h[1-4]$/;
const PARAGRAPH = new Set(["p", "li", "dd", "dt", "pre", "blockquote", "figcaption", "caption", "address"]);
const BLOCKISH = new Set([...PARAGRAPH, "div", "section", "article", "header", "footer", "main", "ul", "ol", "dl", "table", "tbody", "thead", "tr", "td", "th", "body", "html"]);

const clean = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim();
const countWords = (s: string) => s.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu)?.length ?? 0;

type Item = { k: "p" | "h"; text: string; level: number };

/** Paragraphs and headings in reading order. */
export function htmlBlocks(html: string): Item[] {
  const root = parse(html, { blockTextElements: { script: false, style: false, pre: true } });
  const body = root.querySelector("body") ?? root;
  const out: Item[] = [];
  const walk = (node: Node) => {
    if (node.nodeType !== NodeType.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.rawTagName?.toLowerCase() ?? "";
    if (SKIP.has(tag)) return;
    if (HEADING.test(tag)) {
      const text = clean(el.textContent);
      if (text) out.push({ k: "h", text, level: Number(tag[1]) });
      return;
    }
    // A paragraph, or a container holding only text and inline elements.
    const hasBlockChild = el.childNodes.some(
      (c) => c.nodeType === NodeType.ELEMENT_NODE && BLOCKISH.has((c as HTMLElement).rawTagName?.toLowerCase() ?? ""),
    );
    if (PARAGRAPH.has(tag) && !hasBlockChild) {
      const text = clean(el.textContent);
      if (text) out.push({ k: "p", text, level: 0 });
      return;
    }
    if (!hasBlockChild && tag !== "body" && tag !== "html") {
      const text = clean(el.textContent);
      if (text) out.push({ k: "p", text, level: 0 });
      return;
    }
    for (const c of el.childNodes) {
      if (c.nodeType === NodeType.TEXT_NODE && clean(c.textContent).length > 1) out.push({ k: "p", text: clean(c.textContent), level: 0 });
      else walk(c);
    }
  };
  walk(body);
  return out;
}

/** Splits an over-long paragraph at sentence ends so a page stays readable. */
function split(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const cut = rest.slice(0, max).search(/[.!?؟]\s(?=[^.!?؟]*$)/);
    const at = cut > max * 0.4 ? cut + 1 : rest.lastIndexOf(" ", max);
    parts.push(rest.slice(0, at > 0 ? at : max).trim());
    rest = rest.slice(at > 0 ? at : max).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Pages of about `pageChars` characters (never splitting a paragraph unless it alone is huge), plus contents from the headings. */
export function htmlToPages(html: string, pageChars = 3000): { pages: HtmlPage[]; toc: TocEntry[] } {
  const items = htmlBlocks(html).flatMap((it) => split(it.text, pageChars * 1.5).map((text) => ({ ...it, text })));
  const pages: HtmlPage[] = [];
  const toc: TocEntry[] = [];
  let cur: { text: string; blocks: Block[] } = { text: "", blocks: [] };
  const flush = () => {
    if (cur.blocks.length) pages.push({ ...cur, words: countWords(cur.text) });
    cur = { text: "", blocks: [] };
  };
  for (const it of items) {
    // Start chapters on a fresh page, and keep pages near the target size.
    if (cur.text && (cur.text.length + it.text.length > pageChars || (it.k === "h" && it.level <= 2 && cur.text.length > pageChars * 0.3))) flush();
    if (it.k === "h" && it.level <= 3 && it.text.length < 200) {
      const entry = { title: it.text, page: pages.length };
      const parent = toc.at(-1);
      if (it.level === 3 && parent) (parent.children ??= []).push(entry);
      else toc.push(entry);
    }
    if (cur.text) cur.text += "\n";
    const s = cur.text.length;
    cur.text += it.text;
    cur.blocks.push({ s, e: cur.text.length, k: it.k });
  }
  flush();
  return { pages, toc };
}
