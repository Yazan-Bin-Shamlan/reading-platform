"use client";

import type { DocumentInitParameters, PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

type PdfJs = typeof import("pdfjs-dist");
let loading: Promise<PdfJs> | null = null;

/** Loads pdf.js on demand (browser only) with the worker served from our origin. */
export function loadPdfjs(): Promise<PdfJs> {
  return (loading ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    return pdfjs;
  }));
}

/** Asset locations copied by scripts/copy-pdfjs-assets.mjs. */
const assets = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
  iccUrl: "/pdfjs/iccs/",
} satisfies DocumentInitParameters;

export async function openPdf(source: { url: string } | { data: ArrayBuffer }): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({
    ...assets,
    ...source,
    // Big files: fetch only the byte ranges needed for the pages being viewed.
    rangeChunkSize: 256 * 1024,
    disableAutoFetch: true,
  }).promise;
}

export type { PDFDocumentProxy };
