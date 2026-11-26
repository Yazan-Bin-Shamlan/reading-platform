import { describe, expect, it } from "vitest";
import { appDatabaseUrl, migrationDatabaseUrl } from "@/lib/db-url";
import { unquote } from "@/lib/supabase/config";

const POOLER = "aws-0-eu-central-1.pooler.supabase.com";
const integration = {
  POSTGRES_PRISMA_URL: `postgres://postgres.ref:pw@${POOLER}:6543/postgres?sslmode=require&supa=base-pooler.x&pgbouncer=true`,
  POSTGRES_URL_NON_POOLING: "postgres://postgres:pw@db.ref.supabase.co:5432/postgres?sslmode=require",
};

describe("database addresses", () => {
  it("uses our own variables in local mode", () => {
    const env = { DATABASE_URL: "postgresql://postgres@localhost:54329/qiraa", DIRECT_URL: "postgresql://postgres@localhost:54329/qiraa" };
    expect(appDatabaseUrl(env)).toBe(env.DATABASE_URL);
    expect(migrationDatabaseUrl(env)).toBe(env.DIRECT_URL);
  });

  it("prefers the Supabase integration, and skips a value pasted with quotes", () => {
    const env = { ...integration, DATABASE_URL: '"postgresql://broken"', DIRECT_URL: '"postgresql://broken"' };
    const app = new URL(appDatabaseUrl(env)!);
    expect(app.hostname).toBe(POOLER);
    expect(app.port).toBe("6543");
    expect(app.searchParams.get("sslmode")).toBe("require");
    expect(app.searchParams.get("uselibpqcompat")).toBe("true");
    expect(app.searchParams.has("pgbouncer")).toBe(false);
  });

  it("migrates through the pooler's session mode, which Vercel can reach", () => {
    const url = new URL(migrationDatabaseUrl(integration)!);
    expect(url.hostname).toBe(POOLER);
    expect(url.port).toBe("5432");
    expect(url.username).toBe("postgres.ref");
    expect(url.searchParams.has("pgbouncer")).toBe(false);
  });

  it("is empty when nothing usable is set", () => {
    expect(appDatabaseUrl({ DATABASE_URL: "" })).toBeUndefined();
    expect(migrationDatabaseUrl({})).toBeUndefined();
  });
});

describe("unquote", () => {
  it("drops quotes copied from a .env file", () => {
    expect(unquote('"https://ref.supabase.co"')).toBe("https://ref.supabase.co");
    expect(unquote(" sb_publishable_x ")).toBe("sb_publishable_x");
    expect(unquote("")).toBeUndefined();
    expect(unquote(undefined)).toBeUndefined();
  });
});
