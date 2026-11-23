// Prepares pdf.js. Runs on postinstall.
//
// 1. Patches pdf.js's text extraction so Arabic ligatures come out in the
//    right order. A lam-alef glyph maps to two characters ("لا"), and pdf.js
//    reverses every right-to-left run character by character, which turns it
//    into "ال" ("الأميرة" became "األميرة"). Pre-reversing multi-character
//    RTL glyphs cancels that out. The server (legacy build) and the browser
//    worker get the same patch, so both see identical text.
// 2. Copies the patched worker and its data files (CMaps, standard fonts, ICC
//    profiles, WASM decoders) to public/pdfjs, served from our own origin.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = dirname(require.resolve("pdfjs-dist/package.json"));
const out = join(process.cwd(), "public", "pdfjs");

const MARK = "/* qiraa: rtl-ligature-order */";
const FIND = `        if (!intersector) {
          textChunk.str.push(glyphUnicode);
        }`;
const REPLACE = `        if (!intersector) {
          ${MARK}
          textChunk.str.push(glyphUnicode.length > 1 && /^[\\u0590-\\u08ff\\ufb1d-\\ufdff\\ufe70-\\ufefc]/.test(glyphUnicode) ? [...glyphUnicode].reverse().join("") : glyphUnicode);
        }`;

for (const file of ["build/pdf.worker.mjs", "legacy/build/pdf.worker.mjs"]) {
  const path = join(root, file);
  const src = readFileSync(path, "utf8");
  if (src.includes(MARK)) continue;
  if (!src.includes(FIND)) {
    throw new Error(`pdf.js changed: can't apply the Arabic ligature patch to ${file}. Update scripts/setup-pdfjs.mjs.`);
  }
  writeFileSync(path, src.replace(FIND, REPLACE));
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "build", "pdf.worker.mjs"), join(out, "pdf.worker.mjs"));
for (const dir of ["cmaps", "standard_fonts", "iccs", "wasm"]) {
  cpSync(join(root, dir), join(out, dir), { recursive: true });
}
console.log("pdf.js patched and copied to public/pdfjs");
