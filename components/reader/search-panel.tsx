"use client";

import { ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAllText } from "@/hooks/use-page-text";
import { searchPages, type Hit } from "@/lib/text/search";
import { cn } from "@/lib/utils";

const CONTEXT = 48;

/** Find in the document: every match listed with its context; Enter steps through them. */
export function SearchPanel({
  docId,
  enabled,
  query,
  onQuery,
  active,
  onActive,
  onHits,
  onClose,
}: {
  docId: string;
  /** False for scanned documents: there's no text to search. */
  enabled: boolean;
  query: string;
  onQuery: (q: string) => void;
  active: number;
  onActive: (index: number, hit: Hit) => void;
  onHits: (hits: Hit[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations("search");
  const { pages, pending } = useAllText(docId, enabled);
  const deferred = useDeferredValue(query);
  const hits = useMemo(() => (pages ? searchPages(pages, deferred) : []), [pages, deferred]);
  const texts = useMemo(() => new Map(pages?.map((p) => [p.i, p.text])), [pages]);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => onHits(hits), [hits, onHits]);
  useEffect(() => {
    list.current?.querySelector(`[data-hit="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (i: number) => {
    if (!hits.length) return;
    const k = (i + hits.length) % hits.length;
    onActive(k, hits[k]);
  };

  return (
    <div
      role="search"
      className="fixed end-2 top-[4.5rem] z-50 flex max-h-[min(70dvh,36rem)] w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
    >
      <form
        className="flex items-center gap-1 border-b p-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          go(active + 1);
        }}
      >
        <Search aria-hidden className="ms-1.5 size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          dir="auto"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              go(active - 1);
            }
          }}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          className="h-9 min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <span className="shrink-0 px-1 text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {query.trim().length >= 2 && pages ? (hits.length ? `${active + 1}/${hits.length}` : t("none")) : ""}
        </span>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t("previous")} onClick={() => go(active - 1)} disabled={!hits.length}>
          <ChevronUp aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t("next")} onClick={() => go(active + 1)} disabled={!hits.length}>
          <ChevronDown aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t("close")} onClick={onClose}>
          <X aria-hidden />
        </Button>
      </form>

      {!enabled ? (
        <p className="p-4 text-sm text-muted-foreground">{t("noText")}</p>
      ) : pending ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          {t("preparing")}
        </p>
      ) : hits.length > 0 ? (
        <ol ref={list} className="overflow-y-auto py-1">
          {hits.map((h, i) => {
            const text = texts.get(h.page) ?? "";
            const before = text.slice(Math.max(0, h.start - CONTEXT), h.start).replace(/^\S*\s/, "");
            const after = text.slice(h.end, h.end + CONTEXT * 1.5).replace(/\s\S*$/, "");
            return (
              <li key={`${h.page}:${h.start}`}>
                <button
                  type="button"
                  data-hit={i}
                  onClick={() => onActive(i, h)}
                  className={cn(
                    "flex w-full items-baseline gap-3 px-3 py-2 text-start text-sm transition-colors hover:bg-accent",
                    i === active && "bg-accent",
                  )}
                >
                  <span dir="auto" className="line-clamp-2 flex-1 text-muted-foreground">
                    {before}
                    <mark className="rounded-sm bg-[var(--hl-search-current)] px-0.5 text-foreground">{text.slice(h.start, h.end)}</mark>
                    {after}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{h.page + 1}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
