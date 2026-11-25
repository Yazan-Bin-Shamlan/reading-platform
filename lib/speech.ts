"use client";

// Reading aloud, two ways:
// - "device": the browser's own voices (free, instant, no quota). The most
//   natural voice for each language is chosen automatically, or people pick one.
//   Long passages are read sentence by sentence: some browsers stop a single
//   long utterance partway through.
// - "ai": Gemini's voices through /api/speech (natural, a few seconds to start,
//   uses the shared daily AI allowance). Passages are fetched piece by piece,
//   the next while the current one plays. When the AI voice isn't available
//   (limit reached, busy, not set up), the device voice takes over.
// The choice is kept on this device, since each device has its own voices.

import { useSyncExternalStore } from "react";
import { DEFAULT_AI_VOICE, isAiVoice, MAX_SPEECH_CHARS, type AiVoice } from "@/lib/ai/voices";

export type SpeechLang = "en" | "ar";
export type SpeechEngine = "device" | "ai";
export type SpeechPrefs = { engine: SpeechEngine; aiVoice: AiVoice; en: string | null; ar: string | null; rate: number };

const PREFS_KEY = "qiraa:speech";
export const DEFAULT_RATE = 0.9;
const DEFAULT_PREFS: SpeechPrefs = { engine: "device", aiVoice: DEFAULT_AI_VOICE, en: null, ar: null, rate: DEFAULT_RATE };
const MAX_CHUNK = 220;
const FIRST_AI_PIECE = 200;

// macOS sound effects and joke voices, which aren't for reading.
const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Pipe Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/i;
// Older synthesised voices: understandable, but robotic.
const ROBOTIC = /^(Fred|Junior|Ralph|Kathy|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/i;

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

export const langOf = (text: string): SpeechLang => {
  const ar = text.match(/[؀-ۿ]/g)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  return ar > latin ? "ar" : "en";
};

/** How natural a voice is likely to sound, from what its name says. */
export function voiceScore(v: Pick<SpeechSynthesisVoice, "name" | "lang" | "localService">): number {
  let s = 0;
  if (/premium/i.test(v.name)) s += 5;
  if (/enhanced|neural|natural/i.test(v.name)) s += 4;
  if (/siri/i.test(v.name)) s += 3;
  if (/^microsoft\b/i.test(v.name)) s += 3;
  if (ROBOTIC.test(v.name)) s -= 4;
  // Voices on the device start at once and always work. Chrome's online
  // "Google …" voices can take seconds to start and fail on longer text.
  if (v.localService) s += 1;
  // The accents learners most often aim for, then the other main one.
  if (/^en-US$/i.test(v.lang) || /^ar-(SA|001)$/i.test(v.lang)) s += 1;
  else if (/^en-GB$/i.test(v.lang)) s += 0.5;
  return s;
}

/** The reading voices for a language, most natural first. */
export function rankVoices<V extends Pick<SpeechSynthesisVoice, "name" | "lang" | "localService">>(voices: V[], lang: SpeechLang): V[] {
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith(lang) && !NOVELTY.test(v.name))
    .sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
}

/** Sentences packed into pieces short enough for every browser to finish. */
export function chunks(text: string, max = MAX_CHUNK): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?؟…\n]+[.!?؟…]*["'”’»)]*\s*/g) ?? [];
  const out: string[] = [];
  let cur = "";
  const push = (s: string) => {
    if ((cur + s).length > max && cur) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  };
  for (const sentence of sentences) {
    if (sentence.length <= max) {
      push(sentence);
      continue;
    }
    // A very long sentence: break at commas, then at spaces.
    for (const part of sentence.match(/[^,،;؛]+[,،;؛]?\s*/g) ?? [sentence]) {
      if (part.length <= max) push(part);
      else for (const word of part.split(/(?<=\s)/)) push(word);
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ── Preferences (this device only) ────────────────────────────────────────────

const prefListeners = new Set<() => void>();
let prefsCache: SpeechPrefs | null = null;

export function readPrefs(): SpeechPrefs {
  if (prefsCache) return prefsCache;
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<SpeechPrefs> | null;
    prefsCache = { ...DEFAULT_PREFS, ...raw };
    if (!isAiVoice(prefsCache.aiVoice)) prefsCache.aiVoice = DEFAULT_AI_VOICE;
  } catch {
    prefsCache = DEFAULT_PREFS;
  }
  return prefsCache;
}

export function savePrefs(next: Partial<SpeechPrefs>) {
  prefsCache = { ...readPrefs(), ...next };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefsCache));
  } catch {
    // Private windows may refuse storage; the choice still holds for this visit.
  }
  prefListeners.forEach((l) => l());
}

export function useSpeechPrefs(): SpeechPrefs {
  return useSyncExternalStore(
    (l) => {
      prefListeners.add(l);
      return () => prefListeners.delete(l);
    },
    readPrefs,
    () => DEFAULT_PREFS,
  );
}

// ── Voices ────────────────────────────────────────────────────────────────────

const NO_VOICES: SpeechSynthesisVoice[] = [];
let voicesCache: SpeechSynthesisVoice[] = NO_VOICES;

const readVoices = () => {
  if (!supported()) return NO_VOICES;
  const v = speechSynthesis.getVoices();
  // Keep the same array until the list really changes, for useSyncExternalStore.
  if (v.length !== voicesCache.length) voicesCache = v;
  return voicesCache;
};

/** The system's voices, which some browsers only list after a moment. */
export function useVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(
    (l) => {
      if (!supported()) return () => {};
      speechSynthesis.addEventListener("voiceschanged", l);
      return () => speechSynthesis.removeEventListener("voiceschanged", l);
    },
    readVoices,
    () => NO_VOICES,
  );
}

function voiceFor(lang: SpeechLang): SpeechSynthesisVoice | undefined {
  const voices = readVoices();
  const chosen = readPrefs()[lang];
  return (chosen && voices.find((v) => v.voiceURI === chosen)) || rankVoices(voices, lang)[0];
}

/** The best voice installed on the device, for when an online one fails. */
const localVoiceFor = (lang: SpeechLang) => rankVoices(readVoices().filter((v) => v.localService), lang)[0];

/** How long an online voice may take to start before a device voice takes over. */
const START_TIMEOUT_MS = 4000;

// ── Speaking ──────────────────────────────────────────────────────────────────

export type SpeechState = { key: string; loading: boolean } | null;
/** Why the AI voice wasn't used: /api/speech's status ("limit", "paused", "aiBusy", "unavailable", "error"). */
export type SpeechFallback = string;

const stateListeners = new Set<() => void>();
const fallbackListeners = new Set<(reason: SpeechFallback) => void>();
let state: SpeechState = null;
let run = 0;
let audio: HTMLAudioElement | null = null;
let aborter: AbortController | null = null;

const setState = (next: SpeechState) => {
  state = next;
  stateListeners.forEach((l) => l());
};

export const canSpeak = () => typeof window !== "undefined" && ("speechSynthesis" in window || "Audio" in window);

/** Called when the AI voice falls back to the device voice, with the reason. */
export function onSpeechFallback(listener: (reason: SpeechFallback) => void) {
  fallbackListeners.add(listener);
  return () => void fallbackListeners.delete(listener);
}

function speakDevice(text: string, key: string, lang: SpeechLang, id: number, voiceURI?: string) {
  if (!supported()) return setState(null);
  const pieces = chunks(text);
  if (!pieces.length) return setState(null);
  const voice = (voiceURI && readVoices().find((v) => v.voiceURI === voiceURI)) || voiceFor(lang);
  setState({ key, loading: false });
  // Chrome may drop speech queued in the same moment as the cancel() before it.
  setTimeout(() => id === run && queueUtterances(pieces, voice, lang, id), 60);
}

function queueUtterances(pieces: string[], voice: SpeechSynthesisVoice | undefined, lang: SpeechLang, id: number) {
  const online = voice ? !voice.localService : false;
  let started = false;
  let switched = false;
  // An online voice that fails or never starts: read the rest with one on the device.
  const switchFrom = (i: number) => {
    if (switched || id !== run) return;
    switched = true;
    const local = localVoiceFor(lang);
    speechSynthesis.cancel();
    setTimeout(() => id === run && queueUtterances(pieces.slice(i), local, lang, id), 60);
  };
  pieces.forEach((piece, i) => {
    const u = new SpeechSynthesisUtterance(piece);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? (lang === "ar" ? "ar-SA" : "en-US");
    u.rate = readPrefs().rate;
    u.onstart = () => (started = true);
    u.onerror = (e) => {
      // Cancelled on purpose (Stop, a new passage, or switching voices): nothing to do.
      if (e.error === "interrupted" || e.error === "canceled" || id !== run) return;
      if (online && !switched) return switchFrom(i);
      if (i === pieces.length - 1) setState(null);
    };
    if (i === pieces.length - 1) u.onend = () => id === run && !switched && setState(null);
    speechSynthesis.speak(u);
  });
  if (online) setTimeout(() => !started && switchFrom(0), START_TIMEOUT_MS);
}

class FallbackError extends Error {}

/** Plays one clip to its end (or until stopped, which pauses it). */
function play(url: string): Promise<void> {
  const a = new Audio(url);
  a.playbackRate = readPrefs().rate;
  audio = a;
  return new Promise((resolve) => {
    a.onended = a.onpause = a.onerror = () => resolve();
    a.play().catch(() => resolve());
  });
}

/**
 * Pieces for the AI voice: a short first one, so reading starts within a few
 * seconds (the wait grows with the length), then full-size pieces.
 */
export function aiPieces(text: string): string[] {
  const head = chunks(text, FIRST_AI_PIECE)[0];
  if (!head) return [];
  return [head, ...chunks(text.replace(/\s+/g, " ").trim().slice(head.length), MAX_SPEECH_CHARS)];
}

async function speakAi(text: string, key: string, lang: SpeechLang, id: number) {
  const pieces = aiPieces(text);
  if (!pieces.length) return setState(null);
  const ctrl = (aborter = new AbortController());
  const voice = readPrefs().aiVoice;
  const fetchPiece = async (piece: string) => {
    const res = await fetch("/api/speech", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: piece, voice }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new FallbackError(((await res.json().catch(() => ({}))) as { status?: string }).status ?? "error");
    return URL.createObjectURL(await res.blob());
  };

  setState({ key, loading: true });
  let next = fetchPiece(pieces[0]);
  for (let i = 0; i < pieces.length; i++) {
    let url: string;
    try {
      url = await next;
    } catch (e) {
      if (id !== run) return;
      // Read the rest with the device voice, and say why once.
      const reason = e instanceof FallbackError ? e.message : "error";
      fallbackListeners.forEach((l) => l(reason));
      return speakDevice(pieces.slice(i).join(" "), key, lang, id);
    }
    if (id !== run) return URL.revokeObjectURL(url);
    if (i + 1 < pieces.length) {
      next = fetchPiece(pieces[i + 1]);
      next.catch(() => {}); // handled when its turn comes
    }
    setState({ key, loading: false });
    await play(url);
    URL.revokeObjectURL(url);
    if (id !== run) return;
  }
  setState(null);
}

/**
 * Reads `text` aloud, stopping anything already playing: with the AI voice or
 * the device's, as chosen in Settings (`engine` overrides that, for samples).
 * `key` names what is playing, so a button can show Stop for its own text.
 */
export function speak(
  text: string,
  { key = text, lang = langOf(text), voiceURI, engine = readPrefs().engine }: { key?: string; lang?: SpeechLang; voiceURI?: string; engine?: SpeechEngine } = {},
) {
  if (!canSpeak()) return;
  halt();
  const id = ++run;
  if (engine === "ai") void speakAi(text, key, lang, id);
  else speakDevice(text, key, lang, id, voiceURI);
}

function halt() {
  aborter?.abort();
  aborter = null;
  audio?.pause();
  audio = null;
  if (supported()) speechSynthesis.cancel();
}

export function stopSpeaking() {
  run++;
  halt();
  setState(null);
}

function useSpeechState(): SpeechState {
  return useSyncExternalStore(
    (l) => {
      stateListeners.add(l);
      return () => stateListeners.delete(l);
    },
    () => state,
    () => null,
  );
}

/** What is being read aloud now (its key), or null. */
export const useSpeaking = (): string | null => useSpeechState()?.key ?? null;
/** Whether the clip for `key` is still being fetched (the AI voice takes a few seconds). */
export const useSpeechLoading = (key: string): boolean => {
  const s = useSpeechState();
  return s?.key === key && s.loading;
};
