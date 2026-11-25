"use client";

import { Loader2, Play, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { aiVoices, type AiVoice } from "@/lib/ai/voices";
import {
  canSpeak,
  rankVoices,
  savePrefs,
  speak,
  stopSpeaking,
  useSpeaking,
  useSpeechLoading,
  useSpeechPrefs,
  useVoices,
  type SpeechEngine,
  type SpeechLang,
} from "@/lib/speech";
import { cn } from "@/lib/utils";

const LANGS: SpeechLang[] = ["en", "ar"];
const noop = () => () => {};

/** Whether this browser can read aloud at all (assumed yes while rendering on the server). */
export const useCanSpeak = () => useSyncExternalStore(noop, canSpeak, () => true);

/** Play/Stop for a sample, with a spinner while the AI voice prepares it. */
function SampleButton({ sampleKey, onPlay }: { sampleKey: string; onPlay: () => void }) {
  const t = useTranslations("speech");
  const speaking = useSpeaking() === sampleKey;
  const loading = useSpeechLoading(sampleKey);
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-10 shrink-0"
      aria-label={loading ? t("loading") : speaking ? t("stop") : t("test")}
      onClick={() => (speaking ? stopSpeaking() : onPlay())}
    >
      {loading ? <Loader2 aria-hidden className="animate-spin" /> : speaking ? <Square aria-hidden /> : <Play aria-hidden />}
    </Button>
  );
}

const selectClass = "h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm";

function useSample() {
  const t = useTranslations("speech");
  return (lang: SpeechLang) => t(lang === "en" ? "sampleEn" : "sampleAr");
}

/** Device voice or AI voice. Without the AI voice on this server, it stays on Device. */
export function EngineToggle({ aiAvailable, className }: { aiAvailable: boolean; className?: string }) {
  const t = useTranslations("speech");
  const prefs = useSpeechPrefs();
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={aiAvailable ? prefs.engine : "device"}
      onValueChange={(v) => v && savePrefs({ engine: v as SpeechEngine })}
      disabled={!aiAvailable}
      className={cn("w-fit", className)}
    >
      <ToggleGroupItem value="device" className="flex-1">
        {t("engineDevice")}
      </ToggleGroupItem>
      <ToggleGroupItem value="ai" className="flex-1">
        {t("engineAi")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** The AI voice list, with samples in the given languages. */
export function AiVoicePicker({ id, sampleLangs = LANGS }: { id: string; sampleLangs?: SpeechLang[] }) {
  const t = useTranslations("speech");
  const prefs = useSpeechPrefs();
  const sample = useSample();
  const select = (
    <select id={id} value={prefs.aiVoice} onChange={(e) => savePrefs({ aiVoice: e.target.value as AiVoice })} className={selectClass}>
      {aiVoices.map((v) => (
        <option key={v.name} value={v.name}>
          {v.name} · {t(`styles.${v.style}`)}
        </option>
      ))}
    </select>
  );
  const play = (lang: SpeechLang) => speak(sample(lang), { key: `ai:${lang}`, lang, engine: "ai" });

  // One language: the sample sits beside the list.
  if (sampleLangs.length === 1)
    return (
      <div className="flex items-center gap-2">
        {select}
        <SampleButton sampleKey={`ai:${sampleLangs[0]}`} onPlay={() => play(sampleLangs[0])} />
      </div>
    );
  return (
    <>
      <div className="flex items-center gap-2">{select}</div>
      <div className="flex flex-wrap gap-2">
        {sampleLangs.map((lang) => (
          <div key={lang} className="flex items-center gap-2 text-sm text-muted-foreground">
            <SampleButton sampleKey={`ai:${lang}`} onPlay={() => play(lang)} />
            {t(lang === "en" ? "english" : "arabic")}
          </div>
        ))}
      </div>
    </>
  );
}

/** The device voices for one language, best first, with a sample. */
export function DeviceVoicePicker({ id, lang }: { id: string; lang: SpeechLang }) {
  const t = useTranslations("speech");
  const voices = useVoices();
  const prefs = useSpeechPrefs();
  const sample = useSample();
  const list = rankVoices(voices, lang);
  if (voices.length > 0 && list.length === 0)
    return <p className="text-sm text-muted-foreground">{t("none", { language: t(lang === "en" ? "english" : "arabic") })}</p>;
  return (
    <div className="flex items-center gap-2">
      <select id={id} value={prefs[lang] ?? ""} onChange={(e) => savePrefs({ [lang]: e.target.value || null })} className={selectClass}>
        <option value="">{list[0] ? t("auto", { name: list[0].name }) : t("autoNone")}</option>
        {list.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>
            {v.name} · {v.lang}
          </option>
        ))}
      </select>
      <SampleButton sampleKey={`device:${lang}`} onPlay={() => speak(sample(lang), { key: `device:${lang}`, lang, engine: "device" })} />
    </div>
  );
}

/** Reading speed, shared by both voice types. */
export function SpeedSlider() {
  const t = useTranslations("speech");
  const prefs = useSpeechPrefs();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{t("speed")}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{prefs.rate.toFixed(2)}×</span>
      </div>
      <Slider min={0.6} max={1.3} step={0.05} value={[prefs.rate]} onValueChange={([rate]) => savePrefs({ rate })} aria-label={t("speed")} />
    </div>
  );
}

/** How text is read aloud (Settings page): AI or device voice, which voice, and the speed. Kept on this device. */
export function VoiceSettings({ aiAvailable }: { aiAvailable: boolean }) {
  const t = useTranslations("speech");
  const supported = useCanSpeak();
  const prefs = useSpeechPrefs();
  const engine: SpeechEngine = aiAvailable ? prefs.engine : "device";

  if (!supported) return <p className="text-sm text-muted-foreground">{t("unsupported")}</p>;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="font-medium">{t("engine")}</p>
        <EngineToggle aiAvailable={aiAvailable} />
        <p className="text-sm text-muted-foreground">
          {!aiAvailable ? t("aiUnavailable") : engine === "ai" ? t("engineAiHint") : t("engineDeviceHint")}
        </p>
      </div>

      {engine === "ai" && (
        <div className="space-y-2">
          <label htmlFor="voice-ai" className="font-medium">
            {t("aiVoice")}
          </label>
          <AiVoicePicker id="voice-ai" />
        </div>
      )}

      {engine === "ai" && <p className="pt-2 text-sm font-medium text-muted-foreground">{t("deviceVoices")}</p>}
      {LANGS.map((lang) => (
        <div key={lang} className="space-y-2">
          <label htmlFor={`voice-${lang}`} className="font-medium">
            {t(lang === "en" ? "english" : "arabic")}
          </label>
          <DeviceVoicePicker id={`voice-${lang}`} lang={lang} />
        </div>
      ))}

      <SpeedSlider />

      <p className="text-sm leading-relaxed text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
