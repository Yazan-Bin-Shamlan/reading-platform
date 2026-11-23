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

type Font = { style: { fontFamily: string } };

/**
 * A font stack for mixed Latin and Arabic text. Each next/font family comes
 * with a metric-matched fallback face (e.g. "Geist Fallback" = local Arial)
 * that has no unicode-range, so `var(--font-ui), var(--font-ui-ar)` would let
 * Arial catch Arabic letters before IBM Plex Sans Arabic ever loads. Listing
 * every real face first and the fallbacks after fixes that.
 */
function stack(fonts: Font[], generic: string) {
  const lists = fonts.map((f) => f.style.fontFamily.split(",").map((s) => s.trim()));
  return [...lists.map((l) => l[0]), ...lists.flatMap((l) => l.slice(1)), generic].join(", ");
}

/** Set on <html>; app/globals.css and the reader refer to them. */
export const fontStacks = {
  "--stack-ui": stack([uiLatin, uiArabic], "ui-sans-serif, system-ui, sans-serif"),
  "--stack-serif": stack([literata, naskh], "Georgia, serif"),
  "--stack-classic": stack([sourceSerif, naskh], "Georgia, serif"),
} as React.CSSProperties;
