export const themes = ["light", "sepia", "dark", "black"] as const;
export type Theme = (typeof themes)[number];
export type ThemeChoice = Theme | "system";

export const THEME_COOKIE = "theme";
export const isDarkTheme = (t: Theme) => t === "dark" || t === "black";

/**
 * Runs in <head> before first paint: reads the saved choice from the cookie,
 * resolves "system", and puts the theme class on <html>. No flash, no
 * hydration mismatch. Keep in sync with applyTheme() in use-theme.ts.
 */
export const themeScript = `(function(){try{var a=${JSON.stringify(themes)};var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var c=m?decodeURIComponent(m[1]):"system";if(a.indexOf(c)<0)c="system";var t=c==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;var d=document.documentElement;d.classList.remove.apply(d.classList,a);d.classList.add(t);d.dataset.themeChoice=c;d.style.colorScheme=(t==="dark"||t==="black")?"dark":"light"}catch(e){}})()`;
