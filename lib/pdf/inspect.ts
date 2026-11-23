"use client";

import type { TocEntry } from "@/lib/library/schemas";
import { cleanTitle, detectLanguage, guessType, splitAuthors, textStatus, type DocType } from "@/lib/text/analyze";
import { openPdf, type PDFDocumentProxy } from "./pdfjs";

export type PdfInfo = {
  title: string;
  authors: string[];
  pageCount: number;
  language: "ar" | "en" | null;
  direction: "rtl" | "ltr" | "mixed" | null;
  textStatus: "ok" | "scanned" | "garbled";
  type: DocType;
  toc: TocEntry[];
  cover: Blob | null;
};

export class PdfError extends Error {
  constructor(public code: "encrypted" | "corrupt") {
    super(code);
  }
}

const SAMPLE_PAGES = 6;
const COVER_WIDTH = 360;

/** Everything we can learn from a PDF in the browser, before uploading it. */
export async function inspectPdf(file: File, data: ArrayBuffer): Promise<PdfInfo> {
  let pdf: PDFDocumentProxy;
  try {
    // pdf.js takes ownership of the buffer it's given, so hand it a copy.
    pdf = await openPdf({ data: data.slice(0) });
  } catch (e) {
    throw new PdfError((e as Error).name === "PasswordException" ? "encrypted" : "corrupt");
  }

  try {
    const [meta, samples, toc, cover] = await Promise.all([
      pdf.getMetadata().catch(() => null),
      samplePages(pdf),
      readOutline(pdf).catch(() => []),
      renderCover(pdf).catch(() => null),
    ]);
    const info = (meta?.info ?? {}) as { Title?: string; Author?: string };
    const xmpTitle = meta?.metadata?.get("dc:title") ?? null;
    const text = samples.join("\n");
    const lang = detectLanguage(text);

    return {
      title: cleanTitle(info.Title || xmpTitle, file.name),
      authors: splitAuthors(info.Author ?? meta?.metadata?.get("dc:creator")),
      pageCount: pdf.numPages,
      ...lang,
      textStatus: textStatus(samples),
      type: guessType(pdf.numPages, text),
      toc,
      cover,
    };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

async function samplePages(pdf: PDFDocumentProxy): Promise<string[]> {
  const n = Math.min(SAMPLE_PAGES, pdf.numPages);
  const pages: string[] = [];
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" ").normalize("NFKC"));
    page.cleanup();
  }
  return pages;
}

type OutlineNode = Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>[number];

async function readOutline(pdf: PDFDocumentProxy): Promise<TocEntry[]> {
  const outline = await pdf.getOutline();
  if (!outline?.length) return [];
  let budget = 2000;

  const resolve = async (dest: OutlineNode["dest"]): Promise<number | null> => {
    const explicit = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
    const ref = explicit?.[0];
    if (ref == null) return null;
    if (typeof ref === "number") return ref;
    return pdf.getPageIndex(ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0]);
  };

  const walk = async (nodes: OutlineNode[], depth: number): Promise<TocEntry[]> => {
    const out: TocEntry[] = [];
    for (const node of nodes) {
      if (budget-- <= 0) break;
      const page = await resolve(node.dest).catch(() => null);
      const children = depth < 4 && node.items?.length ? await walk(node.items, depth + 1) : [];
      const title = node.title?.replace(/\s+/g, " ").trim().slice(0, 500);
      if (!title) continue;
      out.push({ title, page: page ?? children[0]?.page ?? 0, ...(children.length ? { children } : {}) });
    }
    return out;
  };
  return walk(outline, 0);
}

async function renderCover(pdf: PDFDocumentProxy): Promise<Blob | null> {
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: COVER_WIDTH / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  // "print" intent renders without requestAnimationFrame, so covers still get
  // made when the user drops files and switches to another tab.
  await page.render({ canvas, viewport, background: "#ffffff", intent: "print" }).promise;
  page.cleanup();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
