import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
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
