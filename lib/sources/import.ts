import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/limits";
import { keys, storage } from "@/lib/storage";
import { extractLater, inspectPdf, TEXT_VERSION } from "@/lib/text/extract";
import { htmlToPages } from "@/lib/text/html";
import { jatsToHtml } from "@/lib/text/jats";
import { sourceFetch, SourceError } from "./http";
import { getRecord, saveRecord } from "./index";
import { normalizeLicense } from "./license";
import type { CatalogRecord, SourceId } from "./types";

export type ImportErrorCode = "not-found" | "not-open" | "no-file" | "too-large" | "not-pdf" | "unavailable";
export class ImportError extends Error {
  constructor(public code: ImportErrorCode) {
    super(code);
  }
}

const MAX_HTML_BYTES = 20 * 1024 * 1024;
const PAGE_BATCH = 200;
const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");

/** Reads a response body, refusing to go past `max` bytes. */
async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  if (Number(res.headers.get("content-length")) > max) throw new ImportError("too-large");
  const reader = res.body?.getReader();
  if (!reader) throw new ImportError("unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new ImportError("too-large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

const fetchFile = async (url: string, accept: string) => {
  try {
    return await sourceFetch(url, { accept, timeoutMs: 120_000, retries: 1 });
  } catch (e) {
    throw e instanceof SourceError || e instanceof Error ? new ImportError("unavailable") : e;
  }
};

// ACO's books are page scans with no text layer; the Internet Archive's Arabic
// books have one, but its OCR is unreadable.
const isScan = (r: CatalogRecord) => r.source === "aco" || (r.source === "archive" && r.language === "ar");

/** Marks content read straight from its source through /api/proxy, never stored (see remoteUrl). */
export const REMOTE = "remote:";
export const remoteUrl = (storageKey: string) => (storageKey.startsWith(REMOTE) ? storageKey.slice(REMOTE.length) : null);

/**
 * A PDF too large to store (over the 50 MB per-file limit) but whose source
 * serves byte ranges: the reader fetches the pages it needs through our proxy.
 */
async function linkRemotePdf(r: CatalogRecord, size: number): Promise<string> {
  const id = sha256(`${REMOTE}${r.pdfUrl}`);
  if (await db.content.findUnique({ where: { id }, select: { id: true } })) return id;
  const scanned = isScan(r);
  await db.content.create({
    data: {
      id,
      format: "pdf",
      storageKey: `${REMOTE}${r.pdfUrl}`,
      byteSize: size,
      language: r.language,
      direction: r.language === "ar" ? "rtl" : "ltr",
      textStatus: scanned ? "scanned" : "pending",
      toc: [],
    },
  });
  if (!scanned) extractLater(id);
  return id;
}

/** A PDF from a source, stored once (by content) and prepared like an upload. */
async function ingestPdf(r: CatalogRecord): Promise<string> {
  // Ask for the first kilobyte: is it really a PDF, and how big is it?
  const probe = await sourceFetch(r.pdfUrl!, { accept: "application/pdf", headers: { range: "bytes=0-1023" }, retries: 1 }).catch(() => {
    throw new ImportError("unavailable");
  });
  let bytes: Uint8Array;
  if (probe.status === 206) {
    const head = new Uint8Array(await probe.arrayBuffer());
    if (!new TextDecoder().decode(head).includes("%PDF-")) throw new ImportError("not-pdf");
    const total = Number(probe.headers.get("content-range")?.split("/")[1]);
    if (total > MAX_UPLOAD_BYTES) {
      // ACO's scans have damaged cross-reference tables: pdf.js has to read the
      // whole file before showing a page, which is too slow range by range.
      if (r.source === "aco") throw new ImportError("too-large");
      return linkRemotePdf(r, total);
    }
    bytes = await readCapped(await fetchFile(r.pdfUrl!, "application/pdf"), MAX_UPLOAD_BYTES);
  } else {
    // The source ignored the range and is sending the whole file: keep it.
    bytes = await readCapped(probe, MAX_UPLOAD_BYTES);
  }
  // Some "PDF" links serve a web page instead.
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-")) throw new ImportError("not-pdf");
  const id = sha256(bytes);
  if (await db.content.findUnique({ where: { id }, select: { id: true } })) return id;

  const store = storage();
  const storageKey = keys.content(id);
  await store.write(storageKey, bytes, "application/pdf");
  const info = await inspectPdf(bytes).catch(() => ({ pageCount: null, toc: [] }));
  const scanned = isScan(r);
  await db.content.create({
    data: {
      id,
      format: "pdf",
      storageKey,
      byteSize: bytes.byteLength,
      pageCount: info.pageCount,
      language: r.language,
      direction: r.language === "ar" ? "rtl" : "ltr",
      textStatus: scanned ? "scanned" : "pending",
      toc: info.toc,
    },
  });
  if (!scanned) extractLater(id);
  return id;
}

/** A text edition (Gutenberg's HTML, Europe PMC's XML), turned straight into text pages for Reading mode. */
async function ingestHtml(r: CatalogRecord): Promise<string> {
  const jats = r.source === "europepmc";
  const bytes = await readCapped(await fetchFile(r.htmlUrl!, jats ? "application/xml" : "text/html"), MAX_HTML_BYTES);
  const id = sha256(bytes);
  if (await db.content.findUnique({ where: { id }, select: { id: true } })) return id;

  const text = new TextDecoder().decode(bytes);
  const { pages, toc } = htmlToPages(jats ? jatsToHtml(text) : text);
  if (!pages.length) throw new ImportError("no-file");
  await db.content.create({
    data: {
      id,
      format: "html",
      // Not stored as a file: the source URL, should it need fetching again.
      storageKey: r.htmlUrl!,
      byteSize: bytes.byteLength,
      pageCount: pages.length,
      language: r.language,
      direction: r.language === "ar" ? "rtl" : "ltr",
      textStatus: "ok",
      textVersion: TEXT_VERSION,
      pageWords: pages.map((p) => p.words),
      toc,
    },
  });
  for (let i = 0; i < pages.length; i += PAGE_BATCH) {
    await db.contentPage.createMany({
      data: pages.slice(i, i + PAGE_BATCH).map((p, k) => ({
        contentId: id,
        pageIndex: i + k,
        text: p.text,
        blocks: p.blocks,
        map: [],
        words: p.words,
      })),
    });
  }
  return id;
}

/**
 * Adds a catalog item to someone's library, fetching and caching its file the
 * first time anyone opens it. Returns the document id.
 */
export async function importItem(userId: string, source: SourceId, sourceId: string): Promise<string> {
  const record = await getRecord(source, sourceId);
  if (!record) throw new ImportError("not-found");
  if (!normalizeLicense(record.license)) throw new ImportError("not-open");
  if (!record.pdfUrl && !record.htmlUrl) throw new ImportError("no-file");

  const item = await saveRecord(record);
  const existing = await db.document.findFirst({ where: { userId, catalogItemId: item.id }, select: { id: true } });
  if (existing) return existing.id;

  const contentId = item.contentId ?? (record.htmlUrl ? await ingestHtml(record) : await ingestPdf(record));
  if (!item.contentId) await db.catalogItem.update({ where: { id: item.id }, data: { contentId } });

  const doc = await db.document.upsert({
    where: { userId_catalogItemId: { userId, catalogItemId: item.id } },
    create: {
      userId,
      origin: "catalog",
      type: record.type,
      title: record.title,
      authors: record.authors,
      language: record.language,
      catalogItemId: item.id,
      contentId,
    },
    update: {},
    select: { id: true },
  });
  return doc.id;
}
