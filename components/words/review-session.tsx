"use client";

import { ArrowUpRight, PartyPopper, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import type { WordItem } from "@/lib/words/queries";
import { grades, preview, type Grade } from "@/lib/words/srs";
import { cn } from "@/lib/utils";
import { speak } from "@/lib/speech";
import { Sentence, sourceHref } from "./words-view";

const GRADE_STYLE: Record<Grade, string> = {
  again: "border-destructive/40 hover:bg-destructive/10",
  hard: "hover:bg-muted",
  good: "border-brand/50 hover:bg-brand/10",
  easy: "hover:bg-muted",
};

/** A flashcard session: see the word in its sentence, recall it, show the answer, grade yourself. */
export function ReviewSession({ cards: initial }: { cards: WordItem[] }) {
  const t = useTranslations("review");
  const [queue, setQueue] = useState(initial);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const card = queue[0];
  const total = done + queue.length;

  const grade = useCallback(
    (g: Grade) => {
      if (!card) return;
      void fetch(`/api/words/${card.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grade: g }),
      }).then((r) => !r.ok && toast.error(t("saveFailed")));
      setShown(false);
      // "Again" comes back later in this same session.
      setQueue((q) => (g === "again" ? [...q.slice(1), { ...q[0], reps: 0 }] : q.slice(1)));
      if (g !== "again") setDone((d) => d + 1);
    },
    [card, t],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !card) return;
      if (!shown && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setShown(true);
      } else if (shown && ["1", "2", "3", "4"].includes(e.key)) {
        grade(grades[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, shown, grade]);

  if (!card) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-secondary text-brand">
          <PartyPopper aria-hidden className="size-7" strokeWidth={1.6} />
        </span>
        <h2 className="font-serif text-2xl font-semibold">{t("doneTitle")}</h2>
        <p className="text-muted-foreground">{t("doneBody", { count: done })}</p>
        <Button asChild className="mt-2">
          <Link href="/words">{t("backToWords")}</Link>
        </Button>
      </div>
    );
  }

  const intervals = preview(card);
  const label = (days: number) =>
    days < 1 ? t("minutes", { count: Math.round(days * 1440) }) : days < 30 ? t("days", { count: days }) : t("months", { count: Math.round(days / 30) });
  const href = sourceHref(card);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Progress value={(done / total) * 100} className="h-1.5 flex-1" aria-label={t("progress")} />
        <span className="tabular-nums">
          {done + 1} / {total}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${card.id}:${queue.length}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="flex min-h-80 flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm sm:p-8"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <p dir="auto" className="font-serif text-4xl font-semibold tracking-tight">
              {card.surface}
            </p>
            <Button variant="ghost" size="sm" onClick={() => speak(card.surface)} className="text-muted-foreground">
              <Volume2 aria-hidden />
              {t("listen")}
            </Button>
          </div>
          <blockquote dir="auto" className="border-s-2 ps-3 font-serif leading-relaxed text-muted-foreground">
            <Sentence sentence={card.sentence} word={card.surface} />
          </blockquote>

          {shown ? (
            <div className="flex flex-col gap-2 border-t pt-4">
              {card.translation && (
                <p dir="auto" className={cn("text-2xl leading-snug font-medium text-brand", card.lang === "en" && "font-[family-name:var(--stack-ui)]")}>
                  {card.translation}
                </p>
              )}
              {card.meaning && (
                <p dir="auto" className="text-muted-foreground">
                  {card.meaning}
                </p>
              )}
              {href && (
                <Link href={href} className="mt-1 inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:underline">
                  <span dir="auto">{card.documentTitle}</span>
                  <ArrowUpRight aria-hidden className="size-3.5 rtl:-scale-x-100" />
                </Link>
              )}
            </div>
          ) : (
            <Button size="lg" className="mt-auto" onClick={() => setShown(true)}>
              {t("show")}
              <kbd className="ms-2 hidden rounded border border-current/30 px-1.5 text-xs opacity-70 sm:inline">Space</kbd>
            </Button>
          )}
        </motion.div>
      </AnimatePresence>

      {shown && (
        <div className="grid grid-cols-4 gap-2">
          {grades.map((g, i) => (
            <Button key={g} variant="outline" onClick={() => grade(g)} className={cn("h-auto flex-col gap-0.5 py-2.5", GRADE_STYLE[g])}>
              <span>{t(`grades.${g}`)}</span>
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {label(intervals[g])}
                <kbd className="ms-1.5 hidden opacity-60 sm:inline">{i + 1}</kbd>
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
