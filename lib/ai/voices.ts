// Gemini's prebuilt speech voices (https://ai.google.dev/gemini-api/docs/speech-generation,
// checked 2026-11-25). Each speaks every supported language, Arabic included,
// and picks up the language from the text. Shared by the server and Settings.

export const aiVoices = [
  { name: "Zephyr", style: "bright" },
  { name: "Puck", style: "upbeat" },
  { name: "Charon", style: "informative" },
  { name: "Kore", style: "firm" },
  { name: "Fenrir", style: "excitable" },
  { name: "Leda", style: "youthful" },
  { name: "Orus", style: "firm" },
  { name: "Aoede", style: "breezy" },
  { name: "Callirrhoe", style: "easyGoing" },
  { name: "Autonoe", style: "bright" },
  { name: "Enceladus", style: "breathy" },
  { name: "Iapetus", style: "clear" },
  { name: "Umbriel", style: "easyGoing" },
  { name: "Algieba", style: "smooth" },
  { name: "Despina", style: "smooth" },
  { name: "Erinome", style: "clear" },
  { name: "Algenib", style: "gravelly" },
  { name: "Rasalgethi", style: "informative" },
  { name: "Laomedeia", style: "upbeat" },
  { name: "Achernar", style: "soft" },
  { name: "Alnilam", style: "firm" },
  { name: "Schedar", style: "even" },
  { name: "Gacrux", style: "mature" },
  { name: "Pulcherrima", style: "forward" },
  { name: "Achird", style: "friendly" },
  { name: "Zubenelgenubi", style: "casual" },
  { name: "Vindemiatrix", style: "gentle" },
  { name: "Sadachbia", style: "lively" },
  { name: "Sadaltager", style: "knowledgeable" },
  { name: "Sulafat", style: "warm" },
] as const;

export type AiVoice = (typeof aiVoices)[number]["name"];
export const aiVoiceNames = aiVoices.map((v) => v.name) as AiVoice[];
/** Clear and calm: easy to follow for someone learning the language. */
export const DEFAULT_AI_VOICE: AiVoice = "Erinome";
/** Longest text in one request; longer passages are read piece by piece. */
export const MAX_SPEECH_CHARS = 500;

export const isAiVoice = (v: unknown): v is AiVoice => typeof v === "string" && (aiVoiceNames as string[]).includes(v);
