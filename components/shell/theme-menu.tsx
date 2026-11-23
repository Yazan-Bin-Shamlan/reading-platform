"use client";

import { Check, Moon, MoonStar, ScrollText, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { themes, type Theme } from "@/lib/preferences/themes";

const icons: Record<Theme, typeof Sun> = {
  light: Sun,
  sepia: ScrollText,
  dark: Moon,
  black: MoonStar,
};

export function ThemeMenu() {
  const t = useTranslations("theme");
  const { theme, resolvedTheme, setTheme } = useTheme();
  const Icon = icons[resolvedTheme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("label")}>
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {themes.map((name) => {
          const ItemIcon = icons[name];
          return (
            <DropdownMenuItem key={name} onSelect={() => setTheme(name)}>
              <ItemIcon aria-hidden />
              <span className="flex-1">{t(name)}</span>
              {theme === name && <Check aria-hidden className="text-brand" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
