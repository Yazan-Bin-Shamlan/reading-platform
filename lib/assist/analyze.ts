import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { PROMPT_VERSION, type DocLang } from "@/lib/ai/prompts";
import type { AiProvider } from "@/lib/ai/provider";
import { AiPausedError, AiUserLimitError, runAi } from "@/lib/ai/quota";
import type { Term } from "@/lib/ai/schemas";
import { detectLanguage } from "@/lib/text/analyze";
import type { Block } from "@/lib/text/reflow";
import { locateTerms } from "./locate";

/** Pages being analysed right now on this server instance, so a page is sent once. */
const inFlight = new Set<string>();
/** Pages whose analysis just failed: not retried for a while, so they don't use up the quota. */
const failedAt = new Map<string, number>();
const RETRY_FAILED_MS = 10 * 60_000;
const recentlyFailed = (key: string) => (failedAt.get(key) ?? 0) > Date.now() - RETRY_FAILED_MS;

/** The page's language, by script: Arabic if it's mostly Arabic. */
export const pageLang = (text: string): DocLang => (detectLanguage(text).language === "ar" ? "ar" : "en");

/** Cached analyses of these pages by the current model. */
export async function cachedPages(ai: AiProvider, contentId: string, pages: number[]) {
  const rows = await db.assistPage.findMany({
    where: { contentId, pageIndex: { in: pages }, promptVersion: PROMPT_VERSION, model: ai.model("fast") },
    select: { pageIndex: true, terms: true },
  });
  return new Map(rows.map((r) => [r.pageIndex, r.terms as Term[]]));
}

async function analyze(ai: AiProvider, contentId: string, page: number, userId: string) {
  const row = await db.contentPage.findUnique({ where: { contentId_pageIndex: { contentId, pageIndex: page } } });
  const blocks = (row?.blocks ?? []) as Block[];
  let terms: Term[] = [];
  if (row && blocks.length && row.words > 0) {
    const paragraphs = blocks.map((b) => row.text.slice(b.s, b.e));
    const raw = await runAi("fast", userId, (p) => p.analyzePage(pageLang(row.text), paragraphs));
    terms = locateTerms(row.text, blocks, raw);
  }
  const data = { model: ai.model("fast"), terms: terms as unknown as Prisma.InputJsonValue };
  await db.assistPage.upsert({
    where: { contentId_pageIndex_promptVersion: { contentId, pageIndex: page, promptVersion: PROMPT_VERSION } },
    create: { contentId, pageIndex: page, promptVersion: PROMPT_VERSION, ...data },
    update: data,
  });
}

/**
 * Analyses the given pages one after another once the response has been
 * sent (the reader polls for results). Stops at the first quota problem.
 */
export function analyzeLater(ai: AiProvider, contentId: string, pages: number[], userId: string) {
  const todo = pages.filter((p) => !inFlight.has(`${contentId}:${p}`) && !recentlyFailed(`${contentId}:${p}`));
  if (!todo.length) return;
  todo.forEach((p) => inFlight.add(`${contentId}:${p}`));
  after(async () => {
    try {
      for (const page of todo) {
        try {
          await analyze(ai, contentId, page, userId);
        } catch (e) {
          if (e instanceof AiPausedError || e instanceof AiUserLimitError) return;
          console.error(`Smart Assist: page ${page} of ${contentId} failed`, e);
          failedAt.set(`${contentId}:${page}`, Date.now());
        } finally {
          inFlight.delete(`${contentId}:${page}`);
        }
      }
    } finally {
      todo.forEach((p) => inFlight.delete(`${contentId}:${p}`));
    }
  });
}

/** Pages that failed recently and won't be retried yet. */
export const hasFailed = (contentId: string, page: number) => recentlyFailed(`${contentId}:${page}`);
