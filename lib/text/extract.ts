import "server-only";
import { join } from "node:path";
import { after } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { storage } from "@/lib/storage";
import { edgeLines, reflowPage, type TextItem } from "./reflow";

/** Bump when reflow changes enough that stored pages should be rebuilt. */
export const TEXT_VERSION = 1;

const LOCK_MS = 5 * 60_000;
const BATCH = 50;
const SAMPLE_PAGES = 40;

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDoc = Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>;

let pdfjsLoading: Promise<PdfJs> | null = null;
function loadPdfjs() {
  return (pdfjsLoading ??= (async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // Run pdf.js's worker in this process. Importing it here (not by URL) also
    // lets the deployment's file tracing find it.
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    return pdfjs;
  })());
}

/** Page text items in the same order and with the same options as the browser's text layer. */
async function pageItems(pdf: PdfDoc, index: number): Promise<TextItem[]> {
  const page = await pdf.getPage(index + 1);
  const content = await page.getTextContent({ includeMarkedContent: true, disableNormalization: true });
  page.cleanup();
  const items: TextItem[] = [];
  for (const it of content.items) {
    if (!("str" in it)) continue;
    const [a, b, c, d, x, y] = it.transform as number[];
    // Rotated text (margin stamps, vertical labels) stays in the list to keep
    // item numbers aligned, but contributes no text.
    const rotated = Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3 || a <= 0;
    items.push({ str: rotated ? "" : it.str, x, y, w: it.width, h: it.height || Math.hypot(c, d) });
  }
  return items;
}

/** Lines that repeat at the top or bottom of many pages: running headers and footers. */
async function findFurniture(pdf: PdfDoc): Promise<Set<string>> {
  const n = pdf.numPages;
  if (n < 6) return new Set();
  const picks = new Set<number>();
  for (let k = 0; k < Math.min(SAMPLE_PAGES, n); k++) picks.add(Math.floor((k * n) / Math.min(SAMPLE_PAGES, n)));
  const counts = new Map<string, number>();
  for (const i of picks) {
    for (const sig of new Set(edgeLines(await pageItems(pdf, i)))) {
      if (sig.length > 1) counts.set(sig, (counts.get(sig) ?? 0) + 1);
    }
  }
  const min = Math.max(3, Math.ceil(picks.size * 0.2));
  return new Set([...counts].filter(([, c]) => c >= min).map(([sig]) => sig));
}

/**
 * Extracts and reflows every page of a PDF into ContentPage rows. Only one
 * extraction runs per content at a time; a crashed one is retried after the
 * lock expires.
 */
export async function extractContent(contentId: string) {
  const now = new Date();
  const locked = await db.content.updateMany({
    where: {
      id: contentId,
      format: "pdf",
      textVersion: { lt: TEXT_VERSION },
      OR: [{ extractLock: null }, { extractLock: { lt: new Date(now.getTime() - LOCK_MS) } }],
    },
    data: { extractLock: now },
  });
  if (!locked.count) return;

  let pdf: PdfDoc | null = null;
  try {
    const content = await db.content.findUniqueOrThrow({ where: { id: contentId } });
    const data = await storage().read(content.storageKey);
    const pdfjs = await loadPdfjs();
    const root = join(process.cwd(), "node_modules", "pdfjs-dist");
    pdf = await pdfjs.getDocument({
      data,
      cMapUrl: join(root, "cmaps") + "/",
      cMapPacked: true,
      standardFontDataUrl: join(root, "standard_fonts") + "/",
      useSystemFonts: false,
      verbosity: 0,
    }).promise;

    const furniture = await findFurniture(pdf);
    await db.contentPage.deleteMany({ where: { contentId } });

    const words: number[] = [];
    let rows: Prisma.ContentPageCreateManyInput[] = [];
    for (let i = 0; i < pdf.numPages; i++) {
      const page = reflowPage(await pageItems(pdf, i), { furniture });
      words.push(page.words);
      rows.push({ contentId, pageIndex: i, text: page.text, blocks: page.blocks, map: page.map, words: page.words });
      if (rows.length === BATCH || i === pdf.numPages - 1) {
        await db.contentPage.createMany({ data: rows });
        await db.content.update({ where: { id: contentId }, data: { extractLock: new Date() } });
        rows = [];
      }
    }
    await db.content.update({
      where: { id: contentId },
      data: { textVersion: TEXT_VERSION, extractLock: null, pageWords: words },
    });
  } catch (e) {
    console.error(`Text extraction failed for ${contentId}`, e);
    await db.content.update({ where: { id: contentId }, data: { extractLock: null } }).catch(() => {});
  } finally {
    await pdf?.loadingTask.destroy();
  }
}

/** Runs extraction after the current response is sent. */
export function extractLater(contentId: string) {
  after(() => extractContent(contentId));
}
