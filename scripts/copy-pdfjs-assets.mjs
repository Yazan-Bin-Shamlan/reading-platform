// Copies the pdf.js worker and its data files (CMaps for CJK/Arabic fonts,
// standard fonts, ICC profiles, WASM decoders) to public/pdfjs so the browser
// can load them from our own origin. Runs on postinstall.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = dirname(require.resolve("pdfjs-dist/package.json"));
const out = join(process.cwd(), "public", "pdfjs");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "build", "pdf.worker.min.mjs"), join(out, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts", "iccs", "wasm"]) {
  cpSync(join(root, dir), join(out, dir), { recursive: true });
}
console.log("pdf.js assets copied to public/pdfjs");
