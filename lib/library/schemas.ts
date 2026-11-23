import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/lib/limits";

export const itemTypes = ["book", "paper", "study", "article", "other"] as const;
export type ItemType = (typeof itemTypes)[number];

export type TocEntry = { title: string; page: number; children?: TocEntry[] };

const tocEntry: z.ZodType<TocEntry> = z.lazy(() =>
  z.object({
    title: z.string().max(500),
    page: z.number().int().min(0),
    children: z.array(tocEntry).max(500).optional(),
  }),
);

export const startUploadSchema = z.object({
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  contentType: z.literal("application/pdf"),
  /** Lets us skip the upload when this person already has the same file. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export const finalizeSchema = z.object({
  uploadKey: z.string().regex(/^incoming\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  title: z.string().trim().min(1).max(500),
  authors: z.array(z.string().trim().min(1).max(200)).max(20),
  type: z.enum(itemTypes),
  pageCount: z.number().int().positive().max(100_000),
  language: z.enum(["ar", "en"]).nullable(),
  direction: z.enum(["rtl", "ltr", "mixed"]).nullable(),
  textStatus: z.enum(["ok", "scanned", "garbled"]),
  toc: z.array(tocEntry).max(2000),
});
export type FinalizeInput = z.infer<typeof finalizeSchema>;

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  type: z.enum(itemTypes).optional(),
  /** Off = this document's text is never sent to the AI provider. */
  assistEnabled: z.boolean().optional(),
});

export const progressSchema = z.object({
  pageIndex: z.number().int().min(0),
  /** Fraction of the page scrolled past (0–1). */
  offset: z.number().min(0).max(1),
  percent: z.number().min(0).max(1),
});
