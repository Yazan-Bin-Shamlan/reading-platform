// Generates test PDFs into .local/fixtures with headless Chrome (which shapes
// Arabic correctly and writes PDF bookmarks from headings):
//   english-book.pdf  – book with a table of contents
//   long-book.pdf     – 600+ pages, for virtualization and resume
//   arabic-book.pdf   – Arabic, right-to-left, with chapters
//   paper.pdf         – two-column research paper (abstract, references, DOI)
//   scanned.pdf       – image-only pages, no text layer
// Usage: node scripts/make-test-pdfs.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(".local/fixtures");
mkdirSync(out, { recursive: true });
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rand() * a.length)];

const en = {
  subj: ["The traveller", "Every scholar", "The old library", "A patient reader", "The river", "Her letter", "The council", "Our neighbour"],
  verb: ["considered", "remembered", "described", "questioned", "illuminated", "abandoned", "reconciled", "contemplated"],
  obj: ["the ephemeral nature of fame", "an unprecedented drought", "the meticulous ledger of debts", "a conspicuous silence", "the venerable manuscripts", "an ambiguous promise", "the quiet harbour at dusk", "the intricate geometry of the dome"],
  tail: ["before the winter came.", "with remarkable equanimity.", "as Ibn Khaldun once argued.", "while Newton was still young.", "in the manner of Avicenna.", "despite every misgiving.", "long after the war ended.", "according to Darwin's notes."],
};
const ar = {
  subj: ["كان الرحالة", "ظلّ العالِم", "وقف القارئ", "سار التاجر", "جلس الشيخ", "كتبت الأميرة", "تأمّل الطالب", "روى الجدّ"],
  verb: ["يتأمّل", "يصف", "يستذكر", "يناقش", "يدوّن", "يتساءل عن", "يقارن بين", "يستقصي"],
  obj: ["أطلال المدينة القديمة", "مخطوطات بيت الحكمة", "أسرار علم الفلك", "حكايات البحر والسفن", "معاني الشعر الجاهلي", "دروب القوافل في الصحراء", "آراء ابن رشد في الفلسفة", "قصص كليلة ودمنة"],
  tail: ["حتى أقبل الليل.", "كما ذكر ابن خلدون في مقدّمته.", "في زمن الخليفة المأمون.", "بصبر لا ينفد.", "قبل أن يرحل إلى قرطبة.", "على ضوء السراج الخافت.", "كما رواه الجاحظ.", "في صباح يوم ربيعي."],
};
const sentence = (w) => `${pick(w.subj)} ${pick(w.verb)} ${pick(w.obj)} ${pick(w.tail)}`;
const para = (w, n = 6) => `<p>${Array.from({ length: n }, () => sentence(w)).join(" ")}</p>`;

const css = (extra = "") => `
  @page { size: A5; margin: 18mm 16mm; }
  body { font: 11.5pt/1.55 Georgia, "Times New Roman", serif; color: #222; }
  h1 { font-size: 20pt; margin: 0 0 14pt; break-before: page; }
  h1:first-of-type { break-before: auto; }
  h2 { font-size: 13pt; margin: 14pt 0 6pt; }
  p { margin: 0 0 8pt; text-align: justify; }
  .title { text-align: center; margin-top: 35%; break-after: page; }
  .title h1 { font-size: 28pt; } ${extra}`;

function book({ file, title, author, lang = "en", chapters, parasPerChapter, words }) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const font = lang === "ar" ? `body { font-family: "Geeza Pro", "Damascus", serif; font-size: 13pt; }` : "";
  const label = lang === "ar" ? (i) => `الفصل ${i}` : (i) => `Chapter ${i}`;
  const body = Array.from({ length: chapters }, (_, c) => {
    const sections = [1, 2]
      .map((s) => `<h2>${lang === "ar" ? `القسم ${s}` : `Part ${s}`}</h2>${Array.from({ length: parasPerChapter / 2 }, () => para(words)).join("")}`)
      .join("");
    return `<h1>${label(c + 1)}</h1>${sections}`;
  }).join("");
  return render(file, `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${title}</title>
    <meta name="author" content="${author}"><style>${css(font)}</style></head>
    <body><div class="title"><div style="font-size:28pt;font-weight:bold">${title}</div><p style="text-align:center">${author}</p></div>${body}</body></html>`);
}

function paper() {
  const sec = (h, n) => `<h2>${h}</h2>${Array.from({ length: n }, () => para(en, 5)).join("")}`;
  return render("paper.pdf", `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Reading Comprehension Under Assisted Glossing</title>
    <meta name="author" content="A. Researcher; B. Scholar"><style>${css(`
      @page { size: A4; margin: 18mm; } body { font-size: 10pt; }
      .cols { columns: 2; column-gap: 8mm; } h1 { text-align: center; break-before: auto; }`)}</style></head><body>
    <h1>Reading Comprehension Under Assisted Glossing: A Controlled Study</h1>
    <p style="text-align:center">A. Researcher · B. Scholar — doi:10.0000/example.2026.001</p>
    <p><b>Abstract.</b> ${sentence(en)} ${sentence(en)} ${sentence(en)}</p>
    <p><b>Keywords:</b> reading, glossing, second-language acquisition</p>
    <div class="cols">${sec("1. Introduction", 8)}${sec("2. Methodology", 10)}${sec("3. Results", 10)}${sec("4. Discussion", 8)}
    <h2>References</h2>${Array.from({ length: 14 }, (_, i) => `<p>[${i + 1}] ${pick(["Smith", "Haddad", "Lee", "Nasser"])}, ${2000 + i}. ${pick(en.obj)}. doi:10.0000/ref.${i}</p>`).join("")}</div>
    </body></html>`);
}

function scanned() {
  // Text drawn on <canvas> prints as an image: a PDF with no text layer, like a scan.
  const pages = Array.from({ length: 4 }, (_, i) => `<canvas width="1000" height="1414" data-i="${i}"></canvas>`).join("");
  return render("scanned.pdf", `<!doctype html><html><head><meta charset="utf-8"><title>Scanned Manuscript</title><style>
    @page { size: A5; margin: 0; } body { margin: 0; } canvas { width: 148mm; height: 209mm; display: block; break-after: page; }</style></head>
    <body>${pages}<script>
      document.querySelectorAll("canvas").forEach((c) => {
        const g = c.getContext("2d"); g.fillStyle = "#f3ead7"; g.fillRect(0, 0, 1000, 1414);
        g.fillStyle = "#2b2217"; g.font = "38px Geeza Pro, serif"; g.direction = "rtl"; g.textAlign = "right";
        for (let y = 140; y < 1320; y += 62) g.fillText(${JSON.stringify(sentence(ar))}, 920, y);
      });
    </script></body></html>`);
}

function render(file, html) {
  const src = join(out, file.replace(/\.pdf$/, ".html"));
  writeFileSync(src, html);
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--generate-pdf-document-outline",
    "--virtual-time-budget=5000", `--print-to-pdf=${join(out, file)}`, `file://${src}`,
  ], { stdio: "ignore" });
  rmSync(src);
  console.log("✓", file);
}

book({ file: "english-book.pdf", title: "The Quiet Harbour", author: "Test Author", chapters: 12, parasPerChapter: 10, words: en });
book({ file: "long-book.pdf", title: "A Very Long Chronicle", author: "Test Author", chapters: 60, parasPerChapter: 40, words: en });
book({ file: "arabic-book.pdf", title: "حكايات الرحالة", author: "مؤلف تجريبي", lang: "ar", chapters: 10, parasPerChapter: 10, words: ar });
paper();
scanned();
