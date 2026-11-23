// pdf.js ships no types for its worker module; the server imports it to run
// the worker in-process (see lib/text/extract.ts).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
