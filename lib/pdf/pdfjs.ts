"use client";

import type { DocumentInitParameters, PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

type PdfJs = typeof import("pdfjs-dist");
let loading: Promise<PdfJs> | null = null;

/** Loads pdf.js on demand (browser only) with the worker served from our origin. */
export function loadPdfjs(): Promise<PdfJs> {
  return (loading ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.mjs";
    return pdfjs;
  }));
}

/** Asset locations copied by scripts/setup-pdfjs.mjs. */
const assets = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
  iccUrl: "/pdfjs/iccs/",
} satisfies DocumentInitParameters;

/**
 * Very large books are read from their source through our proxy. Its
 * responses can't carry a Content-Length (they're streamed), which pdf.js
 * needs to switch to range requests, so we feed it ranges ourselves.
 */
async function rangeTransport(url: string, length: number) {
  const { PDFDataRangeTransport } = await loadPdfjs();
  // progressiveDone: there's no whole-file stream coming, only the ranges pdf.js asks for.
  const transport = new PDFDataRangeTransport(length, null, true);
  transport.requestDataRange = (begin: number, end: number) => {
    void fetch(url, { headers: { range: `bytes=${begin}-${end - 1}` } })
      .then((res) => {
        if (!res.ok) throw new Error(`range ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => transport.onDataRange(begin, new Uint8Array(buf)))
      .catch(() => transport.abort());
  };
  return transport;
}

export async function openPdf(
  source: { url: string; length?: number | null; wholeFile?: boolean } | { data: ArrayBuffer },
): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const input =
    "url" in source && source.length && source.url.startsWith("/api/proxy/")
      ? { range: await rangeTransport(source.url, source.length) }
      : "url" in source
        ? // Page scans often need the whole file anyway: one request beats hundreds of ranges.
          { url: source.url, ...(source.wholeFile ? { disableRange: true, disableStream: false } : {}) }
        : source;
  return pdfjs.getDocument({
    ...assets,
    // Big files: fetch only the byte ranges needed for the pages being viewed,
    // never the whole file as one stream.
    rangeChunkSize: 256 * 1024,
    disableAutoFetch: true,
    disableStream: true,
    ...input,
  }).promise;
}

export type { PDFDocumentProxy };
