import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // The Supabase integration on Vercel sets the project's address as SUPABASE_URL
  // (server only). It's public, so it's passed to the browser too; see
  // lib/supabase/config.ts.
  env: { SUPABASE_PROJECT_URL: process.env.SUPABASE_URL ?? "" },
  // pdf.js runs on the server for text extraction. Keep it out of the bundle
  // (it loads its worker and CMap files at runtime) and ship the CMaps, which
  // some fonts need to map glyphs to text.
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: Object.fromEntries(
    ["/api/documents/**", "/api/explore/**", "/api/cron/**"].map((route) => [
      route,
      ["./node_modules/pdfjs-dist/cmaps/**", "./node_modules/pdfjs-dist/standard_fonts/**"],
    ]),
  ),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
