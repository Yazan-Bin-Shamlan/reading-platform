import { describe, expect, it } from "vitest";
import { nextReset, quotaDay, quotaErrorFrom } from "@/lib/ai/limits";

describe("quota errors", () => {
  it("tells a daily limit from a per-minute one", () => {
    expect(quotaErrorFrom(429, '{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}')?.scope).toBe("day");
    expect(quotaErrorFrom(429, "quota_exceeded: You have exceeded your daily quota.")?.scope).toBe("day");
    const minute = quotaErrorFrom(429, 'rate_limit_exceeded ... "retryDelay": "17s"');
    expect(minute?.scope).toBe("minute");
    expect(minute?.retryAfterMs).toBe(17_000);
    expect(quotaErrorFrom(500, "boom")).toBeNull();
  });
});

describe("quota day", () => {
  it("follows Pacific time", () => {
    // 05:00 UTC on Nov 24 is still Nov 23 in California.
    expect(quotaDay(new Date("2026-11-24T05:00:00Z")).toISOString().slice(0, 10)).toBe("2026-11-23");
  });
  it("resets at the next Pacific midnight, with and without daylight saving", () => {
    expect(nextReset(new Date("2026-11-23T12:00:00Z")).toISOString()).toBe("2026-11-24T08:00:00.000Z");
    expect(nextReset(new Date("2026-07-01T12:00:00Z")).toISOString()).toBe("2026-07-02T07:00:00.000Z");
  });
});
