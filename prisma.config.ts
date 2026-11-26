import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { migrationDatabaseUrl } from "./lib/db-url";

// Prisma 7 doesn't load env files itself. Next.js convention: .env.local wins.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // The CLI (migrations) needs a session connection; the app uses the pooled
  // one through the driver adapter in lib/db.ts. See lib/db-url.ts.
  datasource: { url: migrationDatabaseUrl() ?? "" },
});
