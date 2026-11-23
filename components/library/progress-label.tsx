"use client";

import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";

export function ReadingProgress({ percent, showLabel = true }: { percent: number; showLabel?: boolean }) {
  const t = useTranslations("library");
  const p = Math.round(percent * 100);
  const label = p >= 99 ? t("finished") : p === 0 ? t("notStarted") : t("percentRead", { percent: p });
  return (
    <div className="space-y-1.5">
      <Progress value={p} aria-label={label} className="h-1 [&>[data-slot=progress-indicator]]:bg-brand" />
      {showLabel && <p className="text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}
