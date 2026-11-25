"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import { onSpeechFallback } from "@/lib/speech";

const REASONS = ["limit", "paused", "aiBusy", "unavailable", "error"];

/** Says once per visit why the device voice is reading instead of the AI voice. */
export function SpeechNotices() {
  const t = useTranslations("speech.fallback");
  useEffect(() => {
    const told = new Set<string>();
    return onSpeechFallback((reason) => {
      const r = REASONS.includes(reason) ? reason : "error";
      if (told.has(r)) return;
      told.add(r);
      toast(t(r));
    });
  }, [t]);
  return null;
}
