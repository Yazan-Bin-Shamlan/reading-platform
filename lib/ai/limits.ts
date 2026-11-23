// Pure helpers for AI quotas, kept apart from server code so they can be tested.

/** The provider is out of requests: for the minute (retry soon) or the day. */
export class AiQuotaError extends Error {
  constructor(
    public scope: "minute" | "day",
    public retryAfterMs = 0,
  ) {
    super(`AI quota exceeded (${scope})`);
  }
}

/** The model is overloaded or too slow right now (HTTP 503/504, timeouts): worth retrying soon. */
export class AiBusyError extends Error {
  constructor() {
    super("AI model busy");
  }
}

/**
 * Reads a rate-limit error (HTTP 429): a daily quota mentions the day
 * ("PerDay", "daily", quota_exceeded); anything else is per-minute.
 * Gemini may include a retry delay such as "retryDelay": "17s".
 */
export function quotaErrorFrom(status: number, message: string): AiQuotaError | null {
  if (status !== 429) return null;
  const daily = /per ?day|daily|quota_exceeded/i.test(message);
  const delay = message.match(/retry(?:Delay)?["\s:in]+(\d+(?:\.\d+)?)s/i);
  return new AiQuotaError(daily ? "day" : "minute", delay ? Number(delay[1]) * 1000 : 0);
}

const PACIFIC = "America/Los_Angeles";
const pacificDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: PACIFIC }).format(d);

/** Today's date in Pacific time (when Gemini's daily quotas reset), as stored in @db.Date columns. */
export const quotaDay = (now = new Date()) => new Date(`${pacificDate(now)}T00:00:00Z`);

/** The next midnight in Pacific time. */
export function nextReset(now = new Date()): Date {
  const tomorrow = new Date(quotaDay(now).getTime() + 86_400_000).toISOString().slice(0, 10);
  // Midnight Pacific is 07:00 or 08:00 UTC depending on daylight saving.
  for (const hour of ["07", "08"]) {
    const t = new Date(`${tomorrow}T${hour}:00:00Z`);
    const h = new Intl.DateTimeFormat("en-US", { timeZone: PACIFIC, hour: "2-digit", hourCycle: "h23" }).format(t);
    if (h === "00") return t;
  }
  return new Date(`${tomorrow}T08:00:00Z`);
}
