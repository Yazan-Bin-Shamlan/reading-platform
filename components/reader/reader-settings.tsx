"use client";

import { AlignJustify, AlignLeft, AlignRight, Check, Minus, Plus, Type } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/use-theme";
import { themes, type Theme } from "@/lib/preferences/themes";
import { fontStacks, readerFonts, type ReaderPrefs } from "@/lib/reader/prefs";
import { cn } from "@/lib/utils";

const themeSwatch: Record<Theme, string> = {
  light: "bg-[oklch(0.985_0.004_85)] text-[oklch(0.2_0_0)]",
  sepia: "bg-[oklch(0.94_0.028_82)] text-[oklch(0.3_0.03_60)]",
  dark: "bg-[oklch(0.2_0.006_260)] text-[oklch(0.9_0_0)]",
  black: "bg-black text-[oklch(0.85_0_0)]",
};

export const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  const t = useTranslations("settings");
  return (
    <div className="flex items-center rounded-lg border">
      <Button variant="ghost" size="icon" className="size-9" aria-label={t("smaller", { what: label })} onClick={onMinus} disabled={minusDisabled}>
        <Minus aria-hidden />
      </Button>
      <span className="flex-1 text-center text-sm tabular-nums">{value}</span>
      <Button variant="ghost" size="icon" className="size-9" aria-label={t("larger", { what: label })} onClick={onPlus} disabled={plusDisabled}>
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

export function ReaderSettings({
  mode,
  prefs,
  onPrefs,
  zoom,
  onZoom,
}: {
  mode: ReaderPrefs["mode"];
  prefs: ReaderPrefs;
  onPrefs: (p: Partial<ReaderPrefs>) => void;
  zoom: number;
  onZoom: (z: number) => void;
}) {
  const t = useTranslations("settings");
  const tTheme = useTranslations("theme");
  const rtl = useLocale() === "ar";
  // "System" isn't one of the swatches: mark the theme it currently resolves to.
  const { resolvedTheme: theme, setTheme } = useTheme();
  const zoomIndex = ZOOMS.findIndex((z) => z >= zoom - 0.001);

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("label")}>
              <Type aria-hidden />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("label")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="flex w-80 flex-col gap-5 p-4">
        <Row label={tTheme("label")}>
          <div className="grid grid-cols-4 gap-2">
            {themes.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTheme(name)}
                aria-pressed={theme === name}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  themeSwatch[name],
                  theme === name && "ring-2 ring-brand ring-offset-2 ring-offset-popover",
                )}
              >
                <span className="font-serif text-base leading-none">Aa</span>
                <span className="opacity-80">{tTheme(name)}</span>
              </button>
            ))}
          </div>
        </Row>

        {mode === "original" ? (
          <Row label={t("zoom")}>
            <Stepper
              label={t("zoom")}
              value={`${Math.round(zoom * 100)}%`}
              onMinus={() => onZoom(ZOOMS[Math.max(0, zoomIndex - 1)])}
              onPlus={() => onZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)])}
              minusDisabled={zoomIndex <= 0}
              plusDisabled={zoomIndex >= ZOOMS.length - 1}
            />
          </Row>
        ) : (
          <>
            <Row label={t("font")}>
              <div className="grid grid-cols-3 gap-2">
                {readerFonts.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onPrefs({ font: f })}
                    aria-pressed={prefs.font === f}
                    className={cn(
                      "relative flex h-14 flex-col items-center justify-center rounded-lg border text-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      prefs.font === f && "border-brand bg-accent",
                    )}
                  >
                    <span className="text-lg leading-tight" style={{ fontFamily: fontStacks[f] }}>
                      {rtl ? "أب" : "Aa"}
                    </span>
                    <span className="text-muted-foreground">{t(`fonts.${f}`)}</span>
                    {prefs.font === f && <Check aria-hidden className="absolute end-1.5 top-1.5 size-3 text-brand" />}
                  </button>
                ))}
              </div>
            </Row>
            <Row label={t("size")}>
              <Stepper
                label={t("size")}
                value={String(prefs.size)}
                onMinus={() => onPrefs({ size: Math.max(14, prefs.size - 1) })}
                onPlus={() => onPrefs({ size: Math.min(32, prefs.size + 1) })}
                minusDisabled={prefs.size <= 14}
                plusDisabled={prefs.size >= 32}
              />
            </Row>
            <Row label={t("lineHeight")}>
              <Slider
                min={1.3}
                max={2.2}
                step={0.05}
                value={[prefs.lineHeight]}
                onValueChange={([v]) => onPrefs({ lineHeight: v })}
                aria-label={t("lineHeight")}
              />
            </Row>
            <Row label={t("width")}>
              <Slider
                min={24}
                max={48}
                step={1}
                value={[prefs.width]}
                onValueChange={([v]) => onPrefs({ width: v })}
                aria-label={t("width")}
              />
            </Row>
            <Row label={t("margins")}>
              <Slider
                min={0}
                max={3}
                step={1}
                value={[prefs.margin]}
                onValueChange={([v]) => onPrefs({ margin: v })}
                aria-label={t("margins")}
              />
            </Row>
            <Row label={t("alignment")}>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={prefs.justify ? "justify" : "start"}
                onValueChange={(v) => v && onPrefs({ justify: v === "justify" })}
                className="w-full"
              >
                <ToggleGroupItem value="start" className="flex-1">
                  {rtl ? <AlignRight aria-hidden /> : <AlignLeft aria-hidden />}
                  {t("ragged")}
                </ToggleGroupItem>
                <ToggleGroupItem value="justify" className="flex-1">
                  <AlignJustify aria-hidden />
                  {t("justified")}
                </ToggleGroupItem>
              </ToggleGroup>
            </Row>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
