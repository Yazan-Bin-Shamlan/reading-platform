/** Reads text aloud with the browser's own speech (free; works offline on most systems). */
export function speak(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = /[؀-ۿ]/.test(text) ? "ar-SA" : "en-US";
  u.rate = 0.9;
  speechSynthesis.speak(u);
}
