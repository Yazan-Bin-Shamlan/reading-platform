import { compareAnnotations, type Annotation } from "./annotations";

export type ExportLabels = {
  by: string;
  exported: string;
  page: (n: number) => string;
  bookmark: string;
};

/** Highlights, notes and bookmarks as a Markdown document, in reading order. */
export function notesToMarkdown(
  doc: { title: string; authors: string[] },
  annotations: Annotation[],
  labels: ExportLabels,
  date = new Date(),
): string {
  const lines = [`# ${doc.title}`, ""];
  if (doc.authors.length) lines.push(`${labels.by} ${doc.authors.join(", ")}  `);
  lines.push(`_${labels.exported} ${date.toISOString().slice(0, 10)}_`, "");

  let page = -1;
  for (const a of [...annotations].sort(compareAnnotations)) {
    if (a.pageIndex !== page) {
      page = a.pageIndex;
      lines.push(`## ${labels.page(page + 1)}`, "");
    }
    if (a.kind === "bookmark") {
      lines.push(`- 🔖 ${labels.bookmark}`, "");
      continue;
    }
    if (a.quote) lines.push(...a.quote.trim().split(/\n+/).map((l) => `> ${l}`), "");
    if (a.note) lines.push(a.note.trim(), "");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** A safe file name from a title, keeping Arabic letters. */
export function fileSlug(title: string) {
  return (
    title
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "notes"
  );
}
