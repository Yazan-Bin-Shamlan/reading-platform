"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { themes } from "@/lib/preferences/themes";

/** Visual swatches for the four themes (Settings page). */
export function ThemePicker() {
  const t = useTranslations("theme");
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label={t("label")} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {themes.map((name) => {
        const selected = resolvedTheme === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(name)}
            className={cn(
              name,
              "rounded-xl border bg-background p-3 text-start text-foreground transition-shadow",
              selected ? "ring-2 ring-ring" : "hover:shadow-sm",
            )}
          >
            <span className="block font-serif text-lg leading-none">Aa أب</span>
            <span className="mt-2 block text-xs text-muted-foreground">{t(name)}</span>
          </button>
        );
      })}
    </div>
  );
}
