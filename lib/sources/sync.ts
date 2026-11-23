import "server-only";
import { db } from "@/lib/db";
import { ARXIV_OAI, fromArxiv } from "./arxiv";
import { DOAB_OAI, doabHandle, fromDoab } from "./doab";
import { getText } from "./http";
import { saveRecord } from "./index";
import { listRecordsUrl, parseOai } from "./oai";
import type { CatalogRecord } from "./types";

// Daily, incremental harvesting of the catalogs that can't be searched live:
// only records changed since the last run, page by page, within a time budget
// (a run that runs out of time continues from where it stopped next time).

type Cursor = { from: string | null; token: string | null; latest: string | null };

const SOURCES = {
  doab: {
    base: DOAB_OAI,
    prefix: "xoai",
    // DOAB wants full timestamps for `from`.
    stamp: (d: Date) => d.toISOString().replace(/\.\d+Z$/, "Z"),
    firstDays: Number(process.env.SYNC_DOAB_FIRST_DAYS ?? 60),
    map: (id: string, meta: unknown) => fromDoab(meta, doabHandle(id)),
  },
  arxiv: {
    base: ARXIV_OAI,
    prefix: "arXiv",
    stamp: (d: Date) => d.toISOString().slice(0, 10),
    firstDays: Number(process.env.SYNC_ARXIV_FIRST_DAYS ?? 7),
    map: (_id: string, meta: unknown) => fromArxiv(meta),
  },
} as const;
export type SyncedSource = keyof typeof SOURCES;

export async function syncSource(source: SyncedSource, budgetMs: number) {
  const cfg = SOURCES[source];
  const started = Date.now();
  const state = await db.syncState.findUnique({ where: { source } });
  const cursor: Cursor = state?.cursor
    ? JSON.parse(state.cursor)
    : { from: cfg.stamp(new Date(Date.now() - cfg.firstDays * 86_400_000)), token: null, latest: null };
  let { token, latest } = cursor;
  let seen = 0;
  let kept = 0;
  let error: string | null = null;

  try {
    do {
      const page = parseOai(await getText(listRecordsUrl(cfg.base, cfg.prefix, cursor.from, token)));
      if (page.error && page.error !== "noRecordsMatch") throw new Error(`OAI error: ${page.error}`);
      for (const rec of page.records) {
        seen++;
        if (!latest || rec.datestamp > latest) latest = rec.datestamp;
        if (rec.deleted) continue;
        const record: CatalogRecord | null = cfg.map(rec.identifier, rec.metadata);
        if (!record) continue;
        await saveRecord(record);
        kept++;
      }
      token = page.resumptionToken;
    } while (token && Date.now() - started < budgetMs);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // Finished the window: next time, start from the newest record seen.
  const next: Cursor = token ? { ...cursor, token, latest } : { from: latest ?? cursor.from, token: null, latest: null };
  await db.syncState.upsert({
    where: { source },
    create: { source, cursor: JSON.stringify(next), lastRunAt: new Date(), lastError: error },
    update: { cursor: JSON.stringify(next), lastRunAt: new Date(), lastError: error },
  });
  return { source, seen, kept, done: !token, error };
}
