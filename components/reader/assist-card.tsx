"use client";

import { useQuery } from "@tanstack/react-query";
import { BookmarkCheck, BookmarkPlus, Check, ExternalLink, Sparkles, Volume2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isEntity, type MoreExplanation, type ParagraphExplanation, type Term } from "@/lib/ai/schemas";
import type { ExplainLang } from "@/lib/assist/filter";
import type { EntityInfo } from "@/lib/entities/wikidata";
import { cn } from "@/lib/utils";

/** What the card is about: a marked term, a selection to look up, or a passage to explain. */
export type CardTarget =
  | { mode: "term"; term: Term; page: number; sentence: string }
  | { mode: "lookup"; text: string; sentence: string; page: number; s: number; e: number }
  | { mode: "paragraph"; text: string };

type ExplainKind = "lookup" | "more" | "paragraph";
type ExplainResponse<T> = { status: "ok" | "paused" | "limit" | "unavailable" | "off" | "empty" | "error"; result?: T; until?: string };

async function explain<T>(docId: string, kind: ExplainKind, text: string, context: string): Promise<ExplainResponse<T>> {
  const res = await fetch("/api/assist/explain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ docId, kind, text, context }),
  });
  return res.json().catch(() => ({ status: "error" }));
}

function useExplain<T>(docId: string, kind: ExplainKind, text: string, context: string, enabled = true) {
  return useQuery({
    queryKey: ["explain", docId, kind, text, context],
    queryFn: () => explain<T>(docId, kind, text, context),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

const isArabic = (s: string) => /[؀-ۿ]/.test(s);

/** Reads a word aloud with the browser's own speech (no cost, works offline on most systems). */
function speak(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = isArabic(text) ? "ar-SA" : "en-US";
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

export function Shimmer({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2 py-1" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-3.5 animate-pulse rounded bg-muted" style={{ width: `${[90, 75, 60, 80][i % 4]}%` }} />
      ))}
    </div>
  );
}

function Problem({ status, until }: { status: string; until?: string }) {
  const t = useTranslations("assist");
  const time = until ? new Date(until).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
  const key = ["paused", "limit", "unavailable", "off", "empty", "busy"].includes(status) ? status : "error";
  return <p className="text-sm text-muted-foreground">{t(`problem.${key}`, { time })}</p>;
}

function Section({ label, children, ar }: { label?: string; children: React.ReactNode; ar?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>}
      <p dir={ar ? "rtl" : "auto"} lang={ar ? "ar" : undefined} className={cn("text-sm leading-relaxed", ar && "font-[family-name:var(--stack-ui)]")}>
        {children}
      </p>
    </div>
  );
}

function DemoNote() {
  const t = useTranslations("assist");
  return <p className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{t("demoNote")}</p>;
}

/** Shared frame: the term, how to say it, and the card's body. */
function Header({ text, sub, audio = true }: { text: string; sub?: string; audio?: boolean }) {
  const t = useTranslations("assist");
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p dir="auto" className="font-serif text-lg leading-tight font-semibold break-words">
          {text}
        </p>
        {sub && (
          <p dir="auto" className="mt-0.5 text-xs text-muted-foreground">
            {sub}
          </p>
        )}
      </div>
      {audio && typeof window !== "undefined" && "speechSynthesis" in window && (
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t("listen")} onClick={() => speak(text)}>
          <Volume2 aria-hidden />
        </Button>
      )}
    </div>
  );
}

function MoreSection({ docId, text, sentence, explainLang }: { docId: string; text: string; sentence: string; explainLang: ExplainLang }) {
  const q = useExplain<MoreExplanation>(docId, "more", text, sentence);
  if (q.isLoading) return <Shimmer lines={4} />;
  const d = q.data;
  if (!d || d.status !== "ok" || !d.result) return <Problem status={d?.status ?? "error"} until={d?.until} />;
  const r = d.result;
  return (
    <div className="flex flex-col gap-2 border-t pt-2">
      {explainLang !== "ar" && <Section>{r.more}</Section>}
      {explainLang !== "en" && <Section ar>{r.moreAr}</Section>}
      {r.examples.map((ex) => (
        <p key={ex} dir="auto" className="text-sm text-muted-foreground italic">
          {ex}
        </p>
      ))}
    </div>
  );
}

type WordActions = {
  saved: boolean;
  onSave: () => void;
  onKnow: () => void;
};

/** A difficult word or phrase: translation, plain meaning, meaning here, example. */
function WordBody({
  docId,
  term,
  sentence,
  explainLang,
  actions,
}: {
  docId: string;
  term: Term;
  sentence: string;
  explainLang: ExplainLang;
  actions: WordActions;
}) {
  const t = useTranslations("assist");
  const [more, setMore] = useState(false);
  const arabicDoc = isArabic(term.text);
  const showEn = explainLang !== "ar";
  const showAr = explainLang !== "en";
  const sub = [term.ipa, term.pos].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-2.5">
      <Header text={term.text} sub={sub} />
      {arabicDoc ? (
        <>
          {term.simple && <Section label={t("meaning")} ar>{term.simple}</Section>}
          {term.context && <Section label={t("inThisSentence")} ar>{term.context}</Section>}
          {term.translation && showEn && <Section label={t("inEnglish")}>{term.translation}</Section>}
        </>
      ) : (
        <>
          {term.translation && showAr && (
            <p dir="rtl" lang="ar" className="font-[family-name:var(--stack-ui)] text-xl leading-snug font-medium text-brand">
              {term.translation}
            </p>
          )}
          {showEn && term.simple && <Section label={t("meaning")}>{term.simple}</Section>}
          {!showEn && term.simpleAr && <Section label={t("meaning")} ar>{term.simpleAr}</Section>}
          {(term.context || term.contextAr) && (
            <div className="rounded-lg bg-muted/60 px-2.5 py-2">
              <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">{t("inThisSentence")}</span>
              {showEn && term.context && <p className="text-sm leading-relaxed">{term.context}</p>}
              {showAr && term.contextAr && (
                <p dir="rtl" lang="ar" className="text-sm leading-relaxed">
                  {term.contextAr}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {term.example && <p dir="auto" className="text-sm text-muted-foreground italic">“{term.example}”</p>}
      {more && <MoreSection docId={docId} text={term.text} sentence={sentence} explainLang={explainLang} />}
      <div className="-mx-1 flex flex-wrap gap-1 pt-0.5">
        {!more && (
          <Button variant="ghost" size="sm" onClick={() => setMore(true)}>
            <Sparkles aria-hidden />
            {t("explainMore")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={actions.onSave} disabled={actions.saved}>
          {actions.saved ? <BookmarkCheck aria-hidden className="text-brand" /> : <BookmarkPlus aria-hidden />}
          {actions.saved ? t("saved") : t("save")}
        </Button>
        <Button variant="ghost" size="sm" onClick={actions.onKnow}>
          <Check aria-hidden />
          {t("know")}
        </Button>
      </div>
    </div>
  );
}

const years = (born: string | null, died: string | null, bc: string) => {
  const y = (v: string | null) => (v ? (v.startsWith("-") ? `${v.slice(1)} ${bc}` : v) : "");
  if (!born && !died) return "";
  return died ? `${y(born) || "?"}–${y(died)}` : y(born);
};

/** A person, place, organisation or event: facts from Wikidata/Wikipedia, and why it's mentioned. */
function EntityBody({ term, explainLang }: { term: Term; explainLang: ExplainLang }) {
  const t = useTranslations("assist");
  const uiAr = useLocale() === "ar";
  const kind = term.kind as "person" | "place" | "org" | "event";
  const name = term.nameEn || term.text;
  const lang = term.nameEn ? "en" : isArabic(name) ? "ar" : "en";
  const q = useQuery({
    queryKey: ["entity", kind, name, lang],
    queryFn: async () => {
      const res = await fetch(`/api/assist/entity?${new URLSearchParams({ name, kind, lang })}`);
      return (await res.json().catch(() => ({ status: "error" }))) as { status: string; entity: EntityInfo | null };
    },
    staleTime: Infinity,
    retry: false,
  });
  const e = q.data?.entity;
  const showEn = explainLang !== "ar";
  const showAr = explainLang !== "en";
  // Arabic documents explain in Arabic in `why` alone; English ones give both.
  const why = (isArabic(term.why) ? [term.why] : [showEn ? term.why : "", showAr ? term.whyAr : ""]).filter(Boolean);
  const readMore = e?.wikiUrlAr ?? e?.wikiUrlEn;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start gap-3">
        {e?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- remote Wikimedia thumbnail, already sized
          <img src={e.imageUrl} alt="" className="size-16 shrink-0 rounded-lg bg-muted object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <Header
            text={(uiAr ? e?.labelAr : e?.labelEn) ?? (uiAr ? term.nameAr : term.nameEn) ?? term.text}
            sub={[uiAr ? e?.labelEn : e?.labelAr ?? term.nameAr, e && years(e.born, e.died, t("bc"))].filter(Boolean).join(" · ")}
            audio={false}
          />
        </div>
      </div>

      {q.isLoading ? (
        <Shimmer lines={3} />
      ) : e ? (
        <>
          {showEn && (e.extractEn || e.descriptionEn) && <Section>{e.extractEn ?? e.descriptionEn}</Section>}
          {showAr && (e.extractAr || e.descriptionAr) && <Section ar>{e.extractAr ?? e.descriptionAr}</Section>}
        </>
      ) : (
        <p className="rounded-md bg-muted/60 px-2 py-1.5 text-sm text-muted-foreground">
          {q.data?.status === "busy" ? t("problem.busy") : t(`notFound.${kind}`)}
        </p>
      )}

      {why.length > 0 && (
        <div className="rounded-lg bg-muted/60 px-2.5 py-2">
          <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">{t("whyMentioned")}</span>
          {why.map((w) => (
            <p key={w} dir="auto" className="text-sm leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}

      {readMore && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <a href={readMore} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            {t("readMore")}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
          {e?.wikiUrlAr && e.wikiUrlEn && (
            <a href={e.wikiUrlEn} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline">
              {t("inEnglishWikipedia")}
            </a>
          )}
        </div>
      )}
      {e && <p className="text-[0.7rem] text-muted-foreground">{t("source")}</p>}
    </div>
  );
}

function LookupBody({
  docId,
  target,
  explainLang,
  actions,
}: {
  docId: string;
  target: Extract<CardTarget, { mode: "lookup" }>;
  explainLang: ExplainLang;
  actions: (term: Term) => WordActions;
}) {
  const q = useExplain<Term>(docId, "lookup", target.text, target.sentence);
  if (q.isLoading) return <Shimmer lines={4} />;
  const d = q.data;
  if (!d || d.status !== "ok" || !d.result) return <Problem status={d?.status ?? "error"} until={d?.until} />;
  const term = d.result;
  return isEntity(term.kind) ? (
    <EntityBody term={term} explainLang={explainLang} />
  ) : (
    <WordBody docId={docId} term={term} sentence={target.sentence} explainLang={explainLang} actions={actions(term)} />
  );
}

function ParagraphBody({ docId, text, explainLang }: { docId: string; text: string; explainLang: ExplainLang }) {
  const t = useTranslations("assist");
  const q = useExplain<ParagraphExplanation>(docId, "paragraph", text, "");
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles aria-hidden className="size-4 text-brand" />
        {t("paragraphTitle")}
      </p>
      {q.isLoading ? (
        <Shimmer lines={5} />
      ) : q.data?.status !== "ok" || !q.data.result ? (
        <Problem status={q.data?.status ?? "error"} until={q.data?.until} />
      ) : (
        <>
          {explainLang !== "ar" && <Section>{q.data.result.summary}</Section>}
          {explainLang !== "en" && <Section ar>{q.data.result.summaryAr}</Section>}
          {q.data.result.points.length > 0 && (
            <ul className="list-disc ps-5 text-sm text-muted-foreground">
              {q.data.result.points.map((p) => (
                <li key={p} dir="auto">
                  {p}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function AssistCard({
  docId,
  target,
  explainLang,
  demo,
  actions,
}: {
  docId: string;
  target: CardTarget;
  explainLang: ExplainLang;
  demo: boolean;
  actions: (term: Term, page: number, sentence: string) => WordActions;
}) {
  return (
    <div className="flex w-[min(21rem,calc(100vw-1.5rem))] flex-col gap-2.5 p-3" aria-live="polite">
      {target.mode === "paragraph" ? (
        <ParagraphBody docId={docId} text={target.text} explainLang={explainLang} />
      ) : target.mode === "lookup" ? (
        <LookupBody
          docId={docId}
          target={target}
          explainLang={explainLang}
          actions={(term) => actions({ ...term, s: target.s, e: target.e }, target.page, target.sentence)}
        />
      ) : isEntity(target.term.kind) ? (
        <EntityBody term={target.term} explainLang={explainLang} />
      ) : (
        <WordBody
          docId={docId}
          term={target.term}
          sentence={target.sentence}
          explainLang={explainLang}
          actions={actions(target.term, target.page, target.sentence)}
        />
      )}
      {demo && <DemoNote />}
    </div>
  );
}
