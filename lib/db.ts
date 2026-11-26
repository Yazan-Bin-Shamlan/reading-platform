import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { appDatabaseUrl } from "@/lib/db-url";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function client() {
  if (!globalForPrisma.prisma) {
    // Pooled connection (Supabase Supavisor, transaction mode) for serverless.
    const connectionString = appDatabaseUrl();
    if (!connectionString) throw new Error("DATABASE_URL (or the Supabase integration's POSTGRES_PRISMA_URL) is not set");
    globalForPrisma.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return globalForPrisma.prisma;
}

/** Created on first use, so builds and pages that don't touch the DB never need it. */
export const db = new Proxy({} as PrismaClient, {
  get: (_, prop) => Reflect.get(client(), prop),
});
