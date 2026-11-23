import { z } from "zod";

export const highlightColors = ["yellow", "green", "blue", "pink", "purple"] as const;
export type HighlightColor = (typeof highlightColors)[number];

export type Annotation = {
  id: string;
  kind: "highlight" | "note" | "bookmark";
  color: HighlightColor | null;
  pageIndex: number;
  start: number | null;
  endPage: number | null;
  end: number | null;
  quote: string | null;
  prefix: string | null;
  suffix: string | null;
  note: string | null;
  createdAt: string;
};

/** A span of text: from `start` on `page` to `end` on `endPage`. */
export type TextRange = { page: number; start: number; endPage: number; end: number };

export const createAnnotationSchema = z
  .object({
    kind: z.enum(["highlight", "note", "bookmark"]),
    color: z.enum(highlightColors).nullable().default(null),
    pageIndex: z.number().int().min(0),
    start: z.number().int().min(0).nullable().default(null),
    endPage: z.number().int().min(0).nullable().default(null),
    end: z.number().int().min(0).nullable().default(null),
    quote: z.string().max(20_000).nullable().default(null),
    prefix: z.string().max(200).nullable().default(null),
    suffix: z.string().max(200).nullable().default(null),
    note: z.string().max(20_000).nullable().default(null),
  })
  .refine((a) => a.kind === "bookmark" || (a.start !== null && a.end !== null), "text annotations need a range");

export const updateAnnotationSchema = z.object({
  color: z.enum(highlightColors).optional(),
  note: z.string().max(20_000).nullable().optional(),
});

export const compareAnnotations = (a: Annotation, b: Annotation) =>
  a.pageIndex - b.pageIndex || (a.start ?? -1) - (b.start ?? -1) || a.createdAt.localeCompare(b.createdAt);

/** The part of a range that falls on `page`, or null. */
export function onPage(r: TextRange, page: number, pageLength: number): [number, number] | null {
  if (page < r.page || page > r.endPage) return null;
  return [page === r.page ? r.start : 0, page === r.endPage ? r.end : pageLength];
}

export const rangeOf = (a: Annotation): TextRange | null =>
  a.start === null || a.end === null ? null : { page: a.pageIndex, start: a.start, endPage: a.endPage ?? a.pageIndex, end: a.end };

export function covers(a: Annotation, page: number, offset: number) {
  const r = rangeOf(a);
  if (!r) return false;
  const afterStart = page > r.page || (page === r.page && offset >= r.start);
  const beforeEnd = page < r.endPage || (page === r.endPage && offset <= r.end);
  return afterStart && beforeEnd;
}
