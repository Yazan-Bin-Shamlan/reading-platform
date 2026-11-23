import "server-only";
import { db } from "@/lib/db";
import { AiQuotaError, nextReset, quotaDay } from "./limits";
import { getProvider, type AiProvider, type Tier } from "./provider";

// Free-tier quotas belong to the whole project (one API key), so they're
// shared by every reader. These caps keep one busy day, or one reader, from
// using it all. Google's own limits still apply; a daily-limit error pauses
// Smart Assist until the quota resets at midnight Pacific time.
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
const DAILY_LIMIT: Record<Tier, number> = {
  fast: num(process.env.AI_DAILY_LIMIT_FAST, 1000),
  smart: num(process.env.AI_DAILY_LIMIT_SMART, 200),
};
const USER_DAILY_LIMIT = num(process.env.AI_USER_DAILY_LIMIT, 300);
/** Spacing between requests from one server instance (4 s ≈ 15 a minute). */
const MIN_INTERVAL_MS = num(process.env.AI_MIN_INTERVAL_MS, 4000);
const RETRIES = 3;

/** Smart Assist is paused (daily quota used up) until `until`. */
export class AiPausedError extends Error {
  constructor(public until: Date) {
    super("AI paused");
  }
}
/** This reader has used their share for today. */
export class AiUserLimitError extends Error {}
/** No provider configured (no GEMINI_API_KEY in production). */
export class AiUnavailableError extends Error {}

/** When Smart Assist resumes, if a model is paused now. */
export async function pausedUntil(model: string, now = new Date()): Promise<Date | null> {
  const row = await db.aiUsage.findUnique({ where: { day_model: { day: quotaDay(now), model } } });
  return row?.pausedUntil && row.pausedUntil > now ? row.pausedUntil : null;
}

async function pause(model: string) {
  const until = nextReset();
  const day = quotaDay();
  await db.aiUsage.upsert({
    where: { day_model: { day, model } },
    create: { day, model, pausedUntil: until },
    update: { pausedUntil: until },
  });
  return until;
}

async function count(model: string, userId: string) {
  const day = quotaDay();
  await Promise.all([
    db.aiUsage.upsert({
      where: { day_model: { day, model } },
      create: { day, model, requests: 1 },
      update: { requests: { increment: 1 } },
    }),
    db.aiUserUsage.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, requests: 1 },
      update: { requests: { increment: 1 } },
    }),
  ]);
}

// One request at a time per server instance, spaced out for per-minute limits.
let chain: Promise<unknown> = Promise.resolve();
let lastStart = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function queued<T>(spacing: number, fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastStart + spacing - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

/**
 * Runs one AI call within the quotas: checks the pause and caps, queues it,
 * retries per-minute limits with backoff, and pauses on a daily limit.
 */
export async function runAi<T>(tier: Tier, userId: string, call: (ai: AiProvider) => Promise<T>): Promise<T> {
  const ai = await getProvider();
  if (!ai) throw new AiUnavailableError();
  const model = ai.model(tier);
  const day = quotaDay();

  const [usage, mine] = await Promise.all([
    db.aiUsage.findUnique({ where: { day_model: { day, model } } }),
    db.aiUserUsage.findUnique({ where: { userId_day: { userId, day } } }),
  ]);
  if (usage?.pausedUntil && usage.pausedUntil > new Date()) throw new AiPausedError(usage.pausedUntil);
  if ((usage?.requests ?? 0) >= DAILY_LIMIT[tier]) throw new AiPausedError(await pause(model));
  if ((mine?.requests ?? 0) >= USER_DAILY_LIMIT) throw new AiUserLimitError();

  const spacing = ai.name === "demo" ? 0 : MIN_INTERVAL_MS;
  for (let attempt = 0; ; attempt++) {
    try {
      await count(model, userId);
      return await queued(spacing, () => call(ai));
    } catch (e) {
      if (!(e instanceof AiQuotaError)) throw e;
      if (e.scope === "day") throw new AiPausedError(await pause(model));
      if (attempt >= RETRIES) throw e;
      await sleep(e.retryAfterMs || 2000 * 2 ** attempt);
    }
  }
}

/** Whether this reader has used their share of requests for today. */
export async function userLimitReached(userId: string) {
  const row = await db.aiUserUsage.findUnique({ where: { userId_day: { userId, day: quotaDay() } } });
  return (row?.requests ?? 0) >= USER_DAILY_LIMIT;
}
