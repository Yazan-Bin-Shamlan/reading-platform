import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // Detect from Accept-Language on first visit, then remember via cookie.
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

export const localeDir = (locale: string): "rtl" | "ltr" =>
  locale === "ar" ? "rtl" : "ltr";
