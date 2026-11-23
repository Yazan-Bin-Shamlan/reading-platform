"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AssistStatus } from "@/hooks/use-assist";
import { levels, type AssistSettings, type ExplainLang, type Level } from "@/lib/assist/filter";
import { cn } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** The toolbar's Smart Assist button and its settings. */
export function AssistMenu({
  settings,
  onSettings,
  docEnabled,
  onDocEnabled,
  status,
  analyzing,
  demo,
  english,
}: {
  settings: AssistSettings;
  onSettings: (s: Partial<AssistSettings>) => void;
  docEnabled: boolean;
  onDocEnabled: (on: boolean) => void;
  status: AssistStatus;
  analyzing: boolean;
  demo: boolean;
  /** Level only matters for English text. */
  english: boolean;
}) {
  const t = useTranslations("assist");
  const on = settings.enabled && docEnabled;
  const note =
    status === "unavailable" ? t("status.unavailable")
    : status === "no-text" ? t("status.noText")
    : status === "paused" ? t("status.paused")
    : status === "limit" ? t("status.limit")
    : demo ? t("demoNote")
    : null;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`${t("title")} (A)`} aria-pressed={on}>
              {on && analyzing ? (
                <Loader2 aria-hidden className="animate-spin text-brand" />
              ) : (
                <Sparkles aria-hidden className={cn(on && "fill-brand/20 text-brand")} />
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{`${t("title")} (A)`}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="flex w-80 flex-col gap-5 p-4">
        <label className="flex items-start justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("title")}</span>
            <span className="text-xs text-muted-foreground">{t("description")}</span>
          </span>
          <Switch checked={settings.enabled} onCheckedChange={(enabled) => onSettings({ enabled })} />
        </label>

        {note && <p className="rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">{note}</p>}

        {english && (
          <Row label={t("level")}>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={settings.level ?? ""}
              onValueChange={(v) => v && onSettings({ level: v as Level })}
              className="w-full"
            >
              {levels.map((l) => (
                <ToggleGroupItem key={l} value={l} className="flex-1">
                  {t(`levels.${l}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Row>
        )}

        <Row label={t("density")}>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[settings.density]}
            onValueChange={([density]) => onSettings({ density })}
            aria-label={t("density")}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("few")}</span>
            <span>{t("many")}</span>
          </div>
        </Row>

        <Row label={t("explainIn")}>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={settings.explainLang}
            onValueChange={(v) => v && onSettings({ explainLang: v as ExplainLang })}
            className="w-full"
          >
            {(["ar", "en", "both"] as const).map((l) => (
              <ToggleGroupItem key={l} value={l} className="flex-1">
                {t(`explainLangs.${l}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Row>

        <label className="flex items-start justify-between gap-3 border-t pt-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm">{t("thisDocument")}</span>
            <span className="text-xs text-muted-foreground">{t("thisDocumentHint")}</span>
          </span>
          <Switch checked={docEnabled} onCheckedChange={onDocEnabled} />
        </label>
      </PopoverContent>
    </Popover>
  );
}

/** First time with an English text: ask the reader's level, so only harder words get marked. */
export function LevelPrompt({ onPick, onLater }: { onPick: (l: Level) => void; onLater: () => void }) {
  const t = useTranslations("assist");
  return (
    <div
      role="dialog"
      aria-labelledby="level-title"
      className="fixed inset-x-3 bottom-14 z-40 mx-auto flex max-w-md flex-col gap-3 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl sm:bottom-16"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <Sparkles aria-hidden className="size-4" />
        </span>
        <div>
          <p id="level-title" className="font-medium">
            {t("levelPromptTitle")}
          </p>
          <p className="text-sm text-muted-foreground">{t("levelPromptBody")}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {levels.map((l) => (
          <Button key={l} variant="outline" onClick={() => onPick(l)} className="h-auto flex-col gap-0.5 py-2">
            <span>{t(`levels.${l}`)}</span>
            <span className="text-[0.7rem] font-normal text-muted-foreground">{t(`levelHints.${l}`)}</span>
          </Button>
        ))}
      </div>
      <button type="button" onClick={onLater} className="self-center text-xs text-muted-foreground hover:underline">
        {t("later")}
      </button>
    </div>
  );
}
