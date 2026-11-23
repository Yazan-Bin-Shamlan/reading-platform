"use client";

import { ArrowUpRight, Download, GraduationCap, Search, Trash2, Volume2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link } from "@/i18n/navigation";
import { fold } from "@/lib/text/search";
import type { WordItem } from "@/lib/words/queries";
import { cn } from "@/lib/utils";
import { speak } from "./speak";

const UNDO_MS = 5000;

/** The sentence with the saved word in bold. */
export function Sentence({ sentence, word, className }: { sentence: string; word: string; className?: string }) {
  const f = fold(sentence);
  const at = f.text.indexOf(fold(word).text);
  if (at < 0) return <span dir="auto" className={className}>{sentence}</span>;
  const s = f.index[at];
  const e = f.index[at + fold(word).text.length - 1] + 1;
  return (
    <span dir="auto" className={className}>
      {sentence.slice(0, s)}
      <b className="font-semibold text-foreground">{sentence.slice(s, e)}</b>
      {sentence.slice(e)}
    </span>
  );
}

export const sourceHref = (w: WordItem) =>
  w.documentId
    ? w.pageIndex !== null && w.start !== null && w.end !== null
      ? `/read/${w.documentId}?p=${w.pageIndex}&s=${w.start}&e=${w.end}`
      : `/read/${w.documentId}`
    : null;

export function WordsView({ words: initial, due }: { words: WordItem[]; due: number }) {
  const t = useTranslations("words");
  const format = useFormatter();
  const [words, setWords] = useState(initial);
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<"all" | "ar" | "en">("all");
  const [now] = useState(() => Date.now());
  const both = initial.some((w) => w.lang === "ar") && initial.some((w) => w.lang === "en");

  const shown = useMemo(() => {
    const q = fold(query.trim()).text;
    return words.filter(
      (w) =>
        (lang === "all" || w.lang === lang) &&
        (!q || [w.surface, w.lemma, w.translation ?? "", w.meaning ?? ""].some((x) => fold(x).text.includes(q))),
    );
  }, [words, query, lang]);

  // Removing waits a few seconds, so Undo can simply cancel it.
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const commit = (id: string) => {
    pending.current.delete(id);
    void fetch(`/api/words/${id}`, { method: "DELETE", keepalive: true });
  };
  useEffect(() => {
    const timers = pending.current;
    return () => {
      for (const [id, timer] of timers) {
        clearTimeout(timer);
        commit(id);
      }
    };
  }, []);

  const remove = (w: WordItem) => {
    setWords((list) => list.filter((x) => x.id !== w.id));
    pending.current.set(w.id, setTimeout(() => commit(w.id), UNDO_MS));
    toast(t("removed", { word: w.surface }), {
      duration: UNDO_MS,
      action: {
        label: t("undo"),
        onClick: () => {
          clearTimeout(pending.current.get(w.id));
          pending.current.delete(w.id);
          setWords((list) => [...list, w].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        },
      },
    });
  };

  const when = (w: WordItem) => {
    const ms = new Date(w.dueAt).getTime() - now;
    if (w.reps === 0 && ms <= 0) return t("new");
    if (ms <= 0) return t("dueNow");
    return t("nextReview", { when: format.relativeTime(new Date(w.dueAt), now) });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="lg" className="gap-2">
          <Link href="/words/review">
            <GraduationCap aria-hidden />
            {due > 0 ? t("reviewDue", { count: due }) : t("practise")}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="lg" className="gap-2">
              <Download aria-hidden />
              {t("export")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuItem asChild>
              <a href="/api/words/export?format=csv" download>
                <span className="flex flex-col">
                  <span>{t("exportCsv")}</span>
                  <span className="text-xs text-muted-foreground">{t("exportCsvHint")}</span>
                </span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/api/words/export?format=anki" download>
                <span className="flex flex-col">
                  <span>{t("exportAnki")}</span>
                  <span className="text-xs text-muted-foreground">{t("exportAnkiHint")}</span>
                </span>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="relative ms-auto w-full sm:w-64">
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-10 w-full rounded-lg border bg-background ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {both && (
        <ToggleGroup type="single" variant="outline" size="sm" value={lang} onValueChange={(v) => v && setLang(v as typeof lang)} className="w-fit">
          <ToggleGroupItem value="all">{t("all")}</ToggleGroupItem>
          <ToggleGroupItem value="en">{t("english")}</ToggleGroupItem>
          <ToggleGroupItem value="ar">{t("arabic")}</ToggleGroupItem>
        </ToggleGroup>
      )}

      {shown.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{t("noMatches")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((w) => {
            const href = sourceHref(w);
            return (
              <li key={w.id} className="group relative flex flex-col gap-2 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
                <div className="flex items-start gap-2 pe-8">
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="flex items-center gap-1.5 font-serif text-xl font-semibold">
                      {w.surface}
                      <button
                        type="button"
                        onClick={() => speak(w.surface)}
                        aria-label={t("listen")}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Volume2 aria-hidden className="size-4" />
                      </button>
                    </p>
                    {w.translation && (
                      <p dir="auto" className={cn("text-lg leading-snug text-brand", w.lang === "en" && "font-[family-name:var(--stack-ui)]")}>
                        {w.translation}
                      </p>
                    )}
                  </div>
                </div>
                {w.meaning && (
                  <p dir="auto" className="text-sm text-muted-foreground">
                    {w.meaning}
                  </p>
                )}
                <blockquote dir="auto" className="border-s-2 ps-3 font-serif text-[0.95rem] leading-relaxed text-muted-foreground">
                  <Sentence sentence={w.sentence} word={w.surface} />
                </blockquote>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                  {href ? (
                    <Link href={href} className="inline-flex min-w-0 items-center gap-1 font-medium text-foreground hover:underline">
                      <span dir="auto" className="truncate">
                        {w.documentTitle}
                      </span>
                      {w.pageIndex !== null && <span className="shrink-0">· {t("page", { page: w.pageIndex + 1 })}</span>}
                      <ArrowUpRight aria-hidden className="size-3.5 shrink-0 rtl:-scale-x-100" />
                    </Link>
                  ) : (
                    <span>{t("noSource")}</span>
                  )}
                  <span className="ms-auto">{when(w)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute end-2 top-2 size-8 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={t("remove", { word: w.surface })}
                  onClick={() => remove(w)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
