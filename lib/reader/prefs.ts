import { z } from "zod";

export const readerFonts = ["serif", "classic", "sans"] as const;
export type ReaderFont = (typeof readerFonts)[number];

/** Latin face first; Arabic text falls through to the Arabic face (see lib/fonts.ts). */
export const fontStacks: Record<ReaderFont, string> = {
  serif: "var(--stack-serif)",
  classic: "var(--stack-classic)",
  sans: "var(--stack-ui)",
};

export const readerPrefsSchema = z.object({
  mode: z.enum(["original", "reading"]),
  font: z.enum(readerFonts),
  /** Text size in px. */
  size: z.number().min(14).max(32),
  lineHeight: z.number().min(1.3).max(2.2),
  /** Column width in em. */
  width: z.number().min(24).max(48),
  /** Side margins, 0 (none) to 3 (wide). */
  margin: z.number().int().min(0).max(3),
  justify: z.boolean(),
});
export type ReaderPrefs = z.infer<typeof readerPrefsSchema>;

export const defaultReaderPrefs: ReaderPrefs = {
  mode: "original",
  font: "serif",
  size: 20,
  lineHeight: 1.7,
  width: 34,
  margin: 1,
  justify: false,
};

export const marginPx = [8, 20, 40, 72] as const;

/** Stored preferences merged over the defaults, ignoring anything invalid. */
export function readPrefs(stored: unknown): ReaderPrefs {
  const reader = (stored as { reader?: unknown } | null)?.reader;
  const parsed = readerPrefsSchema.partial().safeParse(reader ?? {});
  return { ...defaultReaderPrefs, ...(parsed.success ? parsed.data : {}) };
}
