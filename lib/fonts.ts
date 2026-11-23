import {
  Geist,
  Geist_Mono,
  IBM_Plex_Sans_Arabic,
  Literata,
  Noto_Naskh_Arabic,
  Source_Serif_4,
} from "next/font/google";

// Interface fonts (preloaded).
export const uiLatin = Geist({ subsets: ["latin"], variable: "--font-ui" });
export const uiArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-ui-ar",
});
export const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

// Reading fonts (loaded when the reader uses them).
export const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
  preload: false,
});
export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  preload: false,
});
export const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  variable: "--font-naskh",
  preload: false,
});

export const fontVariables = [uiLatin, uiArabic, mono, literata, sourceSerif, naskh]
  .map((f) => f.variable)
  .join(" ");
