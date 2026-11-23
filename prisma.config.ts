import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 doesn't load env files itself. Next.js convention: .env.local wins.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // The CLI (migrations) uses the direct connection; the app uses the pooled
  // DATABASE_URL through the driver adapter in lib/db.ts.
  datasource: { url: process.env.DIRECT_URL ?? "" },
});
