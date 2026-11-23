// Prompts for Smart Reading Assist. Bump PROMPT_VERSION when a change should
// invalidate cached page analyses and explanations.
export const PROMPT_VERSION = 3;

export type DocLang = "en" | "ar";

/** Page text with numbered paragraphs, which the model refers back to. */
export function numberedParagraphs(paragraphs: string[]) {
  return paragraphs.map((p, i) => `[${i + 1}] ${p}`).join("\n\n");
}

const ENGLISH_PAGE = `You help a native Arabic speaker read English. Mark what they may not understand on this page of a book or paper:
- Difficult words and phrases: rare or literary words, idioms, phrasal verbs, technical terms and academic jargon. Rate each from 1 (common) to 5 (rare/specialist): 2 ≈ CEFR B1, 3 ≈ B2, 4 ≈ C1, 5 ≈ C2. Skip everyday words (difficulty 1) unless used in an unusual sense.
- Every person mentioned by name, and named places, organisations and events (kind person/place/org/event). Give their difficulty as how little-known they are.
- Key concepts the passage depends on (kind concept).
Mark each item once (its first appearance). At most 30 items; prefer the most useful.
For each item copy "text" exactly as written in that paragraph. Write "translation", "simpleAr" and "contextAr" in Modern Standard Arabic; "simple", "context" and "example" in easy English.
For people, places, organisations and events, give "nameEn" (full canonical name, e.g. "Charles Darwin") and "nameAr", and explain "why" this paragraph mentions them using only the text. Never invent biographical facts.

Fields:
- p: the paragraph number [n]; text: the exact words as written there; lemma: dictionary form (for names, the name)
- pos: part of speech (noun, verb, idiom…); ipa: IPA pronunciation, e.g. /ɪˈfɛm(ə)rəl/
- translation: a short Arabic translation (one to four words)
- simple / simpleAr: the plain meaning in at most 15 easy words
- context / contextAr: what the word means in THIS sentence, at most 20 words (explain the sense; don't repeat or translate the sentence)
- example: one new short sentence using it
- why / whyAr: for names only, why this paragraph mentions them`;

const ARABIC_PAGE = `أنت تساعد قارئًا عربيًا على فهم نص عربي قد يكون تراثيًا أو متخصصًا. حدّد في هذه الصفحة:
- الكلمات والعبارات الصعبة أو الفصيحة النادرة أو التراثية أو المصطلحات المتخصصة. قيّم صعوبتها من 1 (شائعة) إلى 5 (نادرة أو تراثية جدًا). تجاهل الكلمات المألوفة.
- كل شخص مذكور باسمه، والأماكن والمؤسسات والأحداث المسماة (kind person/place/org/event).
- المفاهيم الأساسية التي يعتمد عليها النص (kind concept).
علّم كل عنصر مرة واحدة (أول ظهور)، وبحد أقصى 30 عنصرًا.
انسخ "text" كما ورد في الفقرة تمامًا بالتشكيل نفسه. اكتب "simple" و"context" و"example" بعربية معاصرة بسيطة، و"translation" ترجمةً إنجليزية قصيرة. اترك "simpleAr" و"contextAr" فارغين.
للأشخاص والأماكن والمؤسسات والأحداث أعطِ "nameEn" (الاسم الإنجليزي المعتمد، مثل "Ibn Khaldun") و"nameAr"، واشرح سبب ذكرهم في الفقرة اعتمادًا على النص فقط: بالعربية في "whyAr" وبالإنجليزية السهلة في "why". لا تخترع معلومات عن سيرتهم.

الحقول:
- p: رقم الفقرة [n]؛ text: الكلمات كما وردت تمامًا؛ lemma: الصيغة المعجمية (وللأسماء: الاسم)
- pos: نوع الكلمة؛ translation: ترجمة إنجليزية قصيرة
- simple: المعنى بعربية معاصرة بسيطة في 15 كلمة على الأكثر
- context: معنى الكلمة في هذه الجملة تحديدًا في 20 كلمة على الأكثر (اشرح المعنى، ولا تكرر الجملة)
- example: جملة قصيرة جديدة تستعمل الكلمة
- why / whyAr: للأسماء فقط، سبب ذكرها في الفقرة`;

export function pagePrompt(lang: DocLang, paragraphs: string[]) {
  return {
    system: lang === "ar" ? ARABIC_PAGE : ENGLISH_PAGE,
    user: numberedParagraphs(paragraphs),
  };
}

/** A word or phrase the reader selected themselves. */
export function lookupPrompt(lang: DocLang, text: string, context: string) {
  const system =
    lang === "ar"
      ? `${ARABIC_PAGE}\nاشرح العنصر الذي حدده القارئ فقط، واستعمل p = 1.`
      : `${ENGLISH_PAGE}\nExplain only the item the reader selected, with p = 1.`;
  return { system, user: `Selected: "${text}"\n\n[1] ${context}` };
}

/** "Explain this paragraph". */
export function paragraphPrompt(lang: DocLang, text: string) {
  const system =
    lang === "ar"
      ? "اشرح هذا المقطع لقارئ عربي بعربية معاصرة بسيطة في summaryAr، وبإنجليزية سهلة في summary. لا تضف معلومات من خارج النص."
      : "Explain this passage for a native Arabic speaker who is learning English: easy English in summary, simple Modern Standard Arabic in summaryAr. Stay faithful to the text; add nothing it doesn't say.";
  return { system, user: text };
}

/** "Explain more" about a marked or selected term. */
export function morePrompt(lang: DocLang, text: string, context: string) {
  const system =
    lang === "ar"
      ? "اشرح الكلمة أو العبارة المحددة شرحًا أوسع لقارئ عربي: معناها وأصلها إن كان مفيدًا وكيف تُستعمل، وفي هذه الجملة تحديدًا. اكتب moreAr بعربية بسيطة وmore بإنجليزية سهلة."
      : "Explain the selected word or phrase more fully for a native Arabic speaker learning English: its meanings, how it is used, nuances, and its sense in this sentence. Easy English in more, simple Arabic in moreAr.";
  return { system, user: `Term: "${text}"\n\nSentence: ${context}` };
}
