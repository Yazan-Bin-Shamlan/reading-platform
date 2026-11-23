import "server-only";
import { db } from "@/lib/db";
import { firstSentences, MIN_SCORE, scoreCandidate, toInfo, type EntityInfo, type EntityKind, type WikidataEntity } from "./wikidata";

// Wikimedia asks for a descriptive User-Agent with contact details, at most
// three requests at a time, and backing off on 429. Without contact details a
// client counts as unidentified and gets 10 requests a minute instead of 200.
// https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy
// https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
const USER_AGENT = `QiraaReader/0.1 (${process.env.WIKIMEDIA_CONTACT || "contact not set"}) node-fetch`;
const MAX_CONCURRENT = 3;
const CACHE_DAYS = 30;

/** Wikimedia said "too many requests": fail fast until this time. */
export class WikimediaBusyError extends Error {}
let blockedUntil = 0;

let active = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/** JSON from a Wikimedia API; null if it isn't there. Throws if Wikimedia can't be reached or is limiting us. */
async function get<T>(url: string): Promise<T | null> {
  if (Date.now() < blockedUntil) throw new WikimediaBusyError();
  return slot(async () => {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429 || res.status === 503) {
      blockedUntil = Date.now() + (Number(res.headers.get("retry-after")) || 10) * 1000;
      throw new WikimediaBusyError();
    }
    return res.ok ? ((await res.json()) as T) : null;
  });
}

const api = (host: string, params: Record<string, string>) =>
  `https://${host}/w/api.php?${new URLSearchParams({ format: "json", ...params })}`;

async function search(name: string, lang: "en" | "ar"): Promise<string[]> {
  const r = await get<{ search?: { id: string }[] }>(
    api("www.wikidata.org", { action: "wbsearchentities", search: name, language: lang, uselang: lang, type: "item", limit: "7" }),
  );
  return r?.search?.map((s) => s.id) ?? [];
}

async function entities(ids: string[]): Promise<WikidataEntity[]> {
  if (!ids.length) return [];
  const r = await get<{ entities?: Record<string, WikidataEntity> }>(
    api("www.wikidata.org", {
      action: "wbgetentities",
      ids: ids.join("|"),
      props: "labels|descriptions|aliases|claims|sitelinks",
      languages: "en|ar",
      sitefilter: "enwiki|arwiki",
    }),
  );
  return ids.map((id) => r?.entities?.[id]).filter((e): e is WikidataEntity => Boolean(e));
}

async function thumbnail(file: string): Promise<string | null> {
  const r = await get<{ query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string }[] }> } }>(
    api("commons.wikimedia.org", { action: "query", prop: "imageinfo", titles: `File:${file}`, iiprop: "url", iiurlwidth: "240" }),
  );
  const info = Object.values(r?.query?.pages ?? {})[0]?.imageinfo?.[0];
  return info?.thumburl ?? info?.url ?? null;
}

/** The start of the Wikipedia article and its picture; missing parts are just null. */
async function summary(url: string | null): Promise<{ extract: string | null; image: string | null }> {
  if (!url) return { extract: null, image: null };
  const { host, pathname } = new URL(url);
  const title = pathname.replace(/^\/wiki\//, "");
  const r = await get<{ extract?: string; thumbnail?: { source?: string } }>(
    `https://${host}/api/rest_v1/page/summary/${title}`,
  ).catch((e) => {
    if (e instanceof WikimediaBusyError) throw e;
    return null;
  });
  return { extract: firstSentences(r?.extract), image: r?.thumbnail?.source ?? null };
}

/**
 * Finds who or what a name refers to. Returns null when there's no
 * confident match: the card then says so instead of guessing. Throws
 * WikimediaBusyError (nothing cached) when Wikimedia is limiting requests.
 */
export async function lookupEntity(
  name: string,
  kind: EntityKind,
  lang: "en" | "ar",
  /** Another spelling to try, e.g. the Arabic name when the English one doesn't match exactly. */
  alt?: { name: string; lang: "en" | "ar" },
): Promise<EntityInfo | null> {
  const found = await lookupOne(name, kind, lang);
  if (found || !alt?.name || alt.name === name) return found;
  return lookupOne(alt.name, kind, alt.lang);
}

async function lookupOne(name: string, kind: EntityKind, lang: "en" | "ar"): Promise<EntityInfo | null> {
  const query = `${kind}:${name.trim().toLowerCase()}`.slice(0, 200);
  const cached = await db.entityLookup.findUnique({ where: { query_lang: { query, lang } }, include: { entity: true } });
  if (cached && cached.fetchedAt.getTime() > Date.now() - CACHE_DAYS * 86_400_000) {
    return cached.entity ? strip(cached.entity) : null;
  }

  const ids = await search(name, lang);
  const candidates = await entities(ids.slice(0, 7));
  const scored = candidates
    .map((e) => ({ e, score: scoreCandidate(e, name, kind, ids.indexOf(e.id)) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];

  let entityId: string | null = null;
  let result: EntityInfo | null = null;
  if (best && best.score >= MIN_SCORE) {
    const { image, ...info } = toInfo(best.e);
    const [en, ar] = await Promise.all([summary(info.wikiUrlEn), summary(info.wikiUrlAr)]);
    // The article's picture usually; Commons only when there's no article with one.
    const imageUrl = en.image ?? ar.image ?? (image ? await thumbnail(image) : null);
    result = { ...info, imageUrl, extractEn: en.extract, extractAr: ar.extract };
    const { id, ...data } = result;
    await db.entity.upsert({ where: { id }, create: { id, ...data }, update: { ...data, fetchedAt: new Date() } });
    entityId = id;
  }
  const confidence = best ? Math.min(1, Math.max(0, best.score / 10)) : 0;
  await db.entityLookup.upsert({
    where: { query_lang: { query, lang } },
    create: { query, lang, entityId, confidence },
    update: { entityId, confidence, fetchedAt: new Date() },
  });
  return result;
}

const strip = (e: EntityInfo): EntityInfo => ({
  id: e.id,
  labelEn: e.labelEn,
  labelAr: e.labelAr,
  descriptionEn: e.descriptionEn,
  descriptionAr: e.descriptionAr,
  extractEn: e.extractEn,
  extractAr: e.extractAr,
  born: e.born,
  died: e.died,
  imageUrl: e.imageUrl,
  wikiUrlEn: e.wikiUrlEn,
  wikiUrlAr: e.wikiUrlAr,
});
