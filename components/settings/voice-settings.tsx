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

const LANGS: SpeechLang[] = ["en", "ar"];
const noop = () => () => {};

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

/** How text is read aloud (Settings page): AI or device voice, which voice, and the speed. Kept on this device. */
export function VoiceSettings({ aiAvailable }: { aiAvailable: boolean }) {
  const t = useTranslations("speech");
  const supported = useSyncExternalStore(noop, canSpeak, () => true);
  const voices = useVoices();
  const prefs = useSpeechPrefs();
  const engine: SpeechEngine = aiAvailable ? prefs.engine : "device";
  const sample = (lang: SpeechLang) => t(lang === "en" ? "sampleEn" : "sampleAr");

  if (!supported) return <p className="text-sm text-muted-foreground">{t("unsupported")}</p>;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="font-medium">{t("engine")}</p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={engine}
          onValueChange={(v) => v && savePrefs({ engine: v as SpeechEngine })}
          disabled={!aiAvailable}
          className="w-fit"
        >
          <ToggleGroupItem value="device">{t("engineDevice")}</ToggleGroupItem>
          <ToggleGroupItem value="ai">{t("engineAi")}</ToggleGroupItem>
        </ToggleGroup>
        <p className="text-sm text-muted-foreground">
          {!aiAvailable ? t("aiUnavailable") : engine === "ai" ? t("engineAiHint") : t("engineDeviceHint")}
        </p>
      </div>

      {engine === "ai" && (
        <div className="space-y-2">
          <label htmlFor="voice-ai" className="font-medium">
            {t("aiVoice")}
          </label>
          <div className="flex items-center gap-2">
            <select id="voice-ai" value={prefs.aiVoice} onChange={(e) => savePrefs({ aiVoice: e.target.value as AiVoice })} className={selectClass}>
              {aiVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} · {t(`styles.${v.style}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((lang) => (
              <div key={lang} className="flex items-center gap-2 text-sm text-muted-foreground">
                <SampleButton sampleKey={`ai:${lang}`} onPlay={() => speak(sample(lang), { key: `ai:${lang}`, lang, engine: "ai" })} />
                {t(lang === "en" ? "english" : "arabic")}
              </div>
            ))}
          </div>
        </div>
      )}

      {engine === "ai" && <p className="pt-2 text-sm font-medium text-muted-foreground">{t("deviceVoices")}</p>}
      {LANGS.map((lang) => {
        const list = rankVoices(voices, lang);
        const label = t(lang === "en" ? "english" : "arabic");
        return (
          <div key={lang} className="space-y-2">
            <label htmlFor={`voice-${lang}`} className="font-medium">
              {label}
            </label>
            {voices.length > 0 && list.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("none", { language: label })}</p>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  id={`voice-${lang}`}
                  value={prefs[lang] ?? ""}
                  onChange={(e) => savePrefs({ [lang]: e.target.value || null })}
                  className={selectClass}
                >
                  <option value="">{list[0] ? t("auto", { name: list[0].name }) : t("autoNone")}</option>
                  {list.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} · {v.lang}
                    </option>
                  ))}
                </select>
                <SampleButton sampleKey={`device:${lang}`} onPlay={() => speak(sample(lang), { key: `device:${lang}`, lang, engine: "device" })} />
              </div>
            )}
          </div>
        );
      })}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">{t("speed")}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{prefs.rate.toFixed(2)}×</span>
        </div>
        <Slider min={0.6} max={1.3} step={0.05} value={[prefs.rate]} onValueChange={([rate]) => savePrefs({ rate })} aria-label={t("speed")} />
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
