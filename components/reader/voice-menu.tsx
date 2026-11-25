"use client";

import { Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AiVoicePicker, DeviceVoicePicker, EngineToggle, SpeedSlider, useCanSpeak } from "@/components/settings/voice-settings";
import { Link } from "@/i18n/navigation";
import { useSpeechPrefs, type SpeechLang } from "@/lib/speech";

/** The toolbar's voice button: which voice reads this book aloud, and how fast. Everything else is in Settings. */
export function VoiceMenu({ aiAvailable, lang }: { aiAvailable: boolean; lang: SpeechLang }) {
  const t = useTranslations("speech");
  const prefs = useSpeechPrefs();
  const supported = useCanSpeak();
  if (!supported) return null;
  const ai = aiAvailable && prefs.engine === "ai";

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("readerLabel")}>
              <Volume2 aria-hidden />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("readerLabel")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="flex w-80 flex-col gap-5 p-4">
        {aiAvailable && <EngineToggle aiAvailable className="w-full" />}
        <div className="flex flex-col gap-2">
          <label htmlFor="reader-voice" className="text-xs font-medium text-muted-foreground">
            {t("voice")}
          </label>
          {ai ? <AiVoicePicker id="reader-voice" sampleLangs={[lang]} /> : <DeviceVoicePicker id="reader-voice" lang={lang} />}
        </div>
        <SpeedSlider />
        <Link href="/settings" className="text-sm font-medium text-brand underline-offset-2 hover:underline">
          {t("more")}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
