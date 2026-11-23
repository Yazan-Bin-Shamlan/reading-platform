// People, places, organisations and events from Wikidata and Wikipedia, so
// the facts on a card come from an encyclopedia, not the model's memory.
// Pure helpers here; the cached lookup is in lookup.ts.
import { fold } from "@/lib/text/search";

export type EntityKind = "person" | "place" | "org" | "event";

export type EntityInfo = {
  id: string;
  labelEn: string | null;
  labelAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  extractEn: string | null;
  extractAr: string | null;
  /** Signed year ("-384" is 384 BC), or null. */
  born: string | null;
  died: string | null;
  imageUrl: string | null;
  wikiUrlEn: string | null;
  wikiUrlAr: string | null;
};

type Snak = { mainsnak?: { datavalue?: { value?: unknown } } };
export type WikidataEntity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, Snak[]>;
  sitelinks?: Record<string, { title: string }>;
};

const HUMAN = "Q5";

const values = (e: WikidataEntity, prop: string) =>
  (e.claims?.[prop] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter((v) => v !== undefined);

const itemIds = (e: WikidataEntity, prop: string) =>
  values(e, prop).map((v) => (v as { id?: string }).id).filter((v): v is string => Boolean(v));

/** "+1332-05-27T00:00:00Z" → "1332"; "-0384-00-00T00:00:00Z" → "-384". */
export function yearOf(time: string | undefined): string | null {
  const m = time?.match(/^([+-])0*(\d+)-/);
  if (!m) return null;
  return m[1] === "-" ? `-${m[2]}` : m[2];
}

const year = (e: WikidataEntity, prop: string) => yearOf((values(e, prop)[0] as { time?: string } | undefined)?.time);

/** How well a candidate fits the name and kind we're looking for (higher is better). */
export function scoreCandidate(e: WikidataEntity, name: string, kind: EntityKind, rank: number): number {
  const target = fold(name).text;
  const names = [
    ...Object.values(e.labels ?? {}).map((l) => l.value),
    ...Object.values(e.aliases ?? {}).flatMap((a) => a.map((x) => x.value)),
  ].map((n) => fold(n).text);
  const human = itemIds(e, "P31").includes(HUMAN);
  const located = values(e, "P625").length > 0;

  // Only an exact name (label or alias) counts: "Darwin" alone could be anyone.
  if (!names.includes(target)) return 0;
  let score = 3;
  if (kind === "person") score += human ? 4 : -4;
  if (kind === "place") score += (located ? 3 : 0) + (human ? -4 : 0);
  if (kind === "org" || kind === "event") score += human ? -3 : 1;
  if (e.sitelinks?.enwiki) score += 1;
  if (e.sitelinks?.arwiki) score += 0.5;
  return score + Math.max(0, 5 - rank) * 0.3;
}

/** Below this, we say we couldn't find them rather than guess. */
export const MIN_SCORE = 5;

const wikiUrl = (lang: string, title: string | undefined) =>
  title ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}` : null;

/** The parts of a Wikidata item a card shows (image and extracts are fetched separately). */
export function toInfo(e: WikidataEntity): Omit<EntityInfo, "imageUrl" | "extractEn" | "extractAr"> & { image: string | null } {
  return {
    id: e.id,
    labelEn: e.labels?.en?.value ?? null,
    labelAr: e.labels?.ar?.value ?? null,
    descriptionEn: e.descriptions?.en?.value ?? null,
    descriptionAr: e.descriptions?.ar?.value ?? null,
    born: year(e, "P569") ?? year(e, "P571"),
    died: year(e, "P570") ?? year(e, "P576"),
    image: (values(e, "P18")[0] as string | undefined) ?? null,
    wikiUrlEn: wikiUrl("en", e.sitelinks?.enwiki?.title),
    wikiUrlAr: wikiUrl("ar", e.sitelinks?.arwiki?.title),
  };
}

/** The first one or two sentences of a Wikipedia extract, kept short for a card. */
export function firstSentences(extract: string | undefined, max = 300): string | null {
  if (!extract) return null;
  const sentences = extract.replace(/\s+/g, " ").match(/[^.!?؟]+[.!?؟]+(\s|$)/g) ?? [extract];
  let out = "";
  for (const s of sentences) {
    if (out && (out + s).length > max) break;
    out += s;
    if (out.length > max * 0.6) break;
  }
  out = out.trim();
  if (out.length <= max) return out || null;
  // One long sentence: cut at a word boundary.
  return `${out.slice(0, max).replace(/\s+\S*$/, "")}…`;
}
