"use client";

import { useSyncExternalStore } from "react";
import {
  isDarkTheme,
  THEME_COOKIE,
  themes,
  type Theme,
  type ThemeChoice,
} from "@/lib/preferences/themes";

type Snapshot = { choice: ThemeChoice; resolved: Theme };

const listeners = new Set<() => void>();
const SERVER: Snapshot = { choice: "system", resolved: "light" };
let cached: Snapshot = SERVER;

const systemTheme = (): Theme =>
  matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

function read(): Snapshot {
  const el = document.documentElement;
  const choice = (el.dataset.themeChoice as ThemeChoice | undefined) ?? "system";
  const resolved = themes.find((t) => el.classList.contains(t)) ?? "light";
  if (cached.choice !== choice || cached.resolved !== resolved) cached = { choice, resolved };
  return cached;
}

function applyTheme(choice: ThemeChoice) {
  const el = document.documentElement;
  const resolved = choice === "system" ? systemTheme() : choice;
  el.classList.remove(...themes);
  el.classList.add(resolved);
  el.dataset.themeChoice = choice;
  el.style.colorScheme = isDarkTheme(resolved) ? "dark" : "light";
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (read().choice === "system") applyTheme("system");
  };
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
  };
}

export function useTheme() {
  const { choice, resolved } = useSyncExternalStore(subscribe, read, () => SERVER);

  const setTheme = (next: ThemeChoice) => {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    applyTheme(next);
  };

  return { theme: choice, resolvedTheme: resolved, setTheme };
}
