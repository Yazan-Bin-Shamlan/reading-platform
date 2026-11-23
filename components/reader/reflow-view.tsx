"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePageText, type PageData } from "@/hooks/use-page-text";
import { fontStacks, marginPx, type ReaderPrefs } from "@/lib/reader/prefs";
import { isProgrammaticScroll, scrollWindowTo, TOP_INSET } from "@/lib/reader/scroll";
import { cn } from "@/lib/utils";
import type { Anchor, ViewProps } from "./types";

const BEFORE = 1;
const AFTER = 4;
const GROW = 4;
const MAX_MOUNTED = 24;
const TERMINAL = /[.!?؟…:;"”»)\]'’؛]$/;

type Props = ViewProps & {
  pageCount: number;
  prefs: ReaderPrefs;
  lang: "ar" | "en" | null;
  direction: "rtl" | "ltr" | "mixed" | null;
};

type Seg = { page: number; s: number; text: string; mark: boolean };
type Para = { key: string; kind: "p" | "h" | "empty" | "loading"; segs: Seg[] };

/** Paragraphs for the mounted pages, joining one that runs on across a page break. */
function paragraphs(lo: number, hi: number, pages: ReadonlyMap<number, PageData>): Para[] {
  const out: Para[] = [];
  for (let p = lo; p <= hi; p++) {
    const data = pages.get(p);
    const mark: Seg = { page: p, s: 0, text: "", mark: true };
    if (!data) {
      out.push({ key: `l${p}`, kind: "loading", segs: [mark] });
      continue;
    }
    if (!data.blocks.length) {
      out.push({ key: `e${p}`, kind: "empty", segs: [mark] });
      continue;
    }
    data.blocks.forEach((b, j) => {
      const seg: Seg = { page: p, s: b.s, text: data.text.slice(b.s, b.e), mark: j === 0 };
      const prev = out.at(-1);
      const continues =
        j === 0 && b.k === "p" && prev?.kind === "p" && !TERMINAL.test(prev.segs.at(-1)!.text.trimEnd());
      if (continues) prev!.segs.push(seg);
      else out.push({ key: `${p}-${j}`, kind: b.k, segs: [seg] });
    });
  }
  return out;
}

/** Reading mode: the document's text, reflowed and typeset with the reader's settings. */
export const ReflowView = memo(function ReflowView({ docId, pageCount, prefs, lang, direction, initial, ref, onPosition, onRendered }: Props) {
  const t = useTranslations("reader");
  const qc = useQueryClient();
  const n = Math.max(1, pageCount);
  const clamp = (p: number) => Math.min(n - 1, Math.max(0, p));

  const startPage = clamp(initial?.page ?? 0);
  const [win, setWin] = useState({ lo: clamp(startPage - BEFORE), hi: clamp(startPage + AFTER) });
  const { pages, pending, failed } = usePageText(docId, win.lo, win.hi);
  const paras = useMemo(() => paragraphs(win.lo, win.hi, pages), [win, pages]);

  const root = useRef<HTMLDivElement>(null);
  const winRef = useRef(win);
  const pagesRef = useRef(pages);
  const anchor = useRef<Anchor>(initial ?? { page: 0, offset: 0 });
  const textTarget = useRef<{ page: number; start: number } | null>(null);
  const onPositionRef = useRef(onPosition);
  useLayoutEffect(() => {
    winRef.current = win;
    pagesRef.current = pages;
    onPositionRef.current = onPosition;
  });

  // ── Geometry: each page starts at its marker; pages run marker to marker ─
  const markerTop = (p: number) => {
    const el = root.current?.querySelector<HTMLElement>(`[data-page-mark="${p}"]`);
    return el ? el.getBoundingClientRect().top + window.scrollY : null;
  };
  const pageBox = (p: number) => {
    const top = markerTop(p);
    if (top === null) return null;
    const next = markerTop(p + 1) ?? (root.current ? root.current.getBoundingClientRect().bottom + window.scrollY : top);
    return { top, height: Math.max(1, next - top) };
  };

  /** Puts the anchored spot back under the toolbar after anything above it changed size. */
  const restore = useCallback(() => {
    const box = pageBox(anchor.current.page);
    if (!box) return;
    const y = box.top + anchor.current.offset * box.height - TOP_INSET;
    if (Math.abs(window.scrollY - y) > 1) scrollWindowTo(y);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads refs and the DOM only
  }, []);

  const scrollToText = (page: number, start: number) => {
    const r = rangesOn(page, start, start + 1)[0];
    if (!r) return false;
    const rect = r.getBoundingClientRect();
    scrollWindowTo(window.scrollY + rect.top - TOP_INSET - (window.innerHeight - TOP_INSET) * 0.3);
    return true;
  };

  // After the window, text or typography changes, keep the reader's place.
  useLayoutEffect(() => {
    const target = textTarget.current;
    if (target && pages.has(target.page) && scrollToText(target.page, target.start)) textTarget.current = null;
    else restore();
    onRendered();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-anchor whenever layout inputs change
  }, [win, pages, prefs, restore, onRendered]);

  // Web fonts arriving late also reflow the text.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() => !isProgrammaticScroll() && restore());
    ro.observe(el);
    return () => ro.disconnect();
  }, [restore]);

  // ── Scroll: track the place, load more text near the edges ─────────
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = root.current;
      if (!el) return;
      const { lo, hi } = winRef.current;
      const y = window.scrollY + TOP_INSET;
      let page = lo;
      for (let p = lo; p <= hi; p++) {
        const top = markerTop(p);
        if (top !== null && top <= y + 1) page = p;
      }
      const box = pageBox(page);
      const offset = box ? Math.min(1, Math.max(0, (y - box.top) / box.height)) : 0;
      if (!isProgrammaticScroll()) anchor.current = { page, offset };
      const atEnd = hi === n - 1 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      onPositionRef.current({
        pageIndex: page,
        offset: Math.round(offset * 1000) / 1000,
        percent: atEnd ? 1 : Math.min(1, (page + offset) / n),
        current: page,
      });

      // Grow the window toward whichever edge is near; trim the far side.
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const loaded = pagesRef.current;
      let next = { lo, hi };
      if (rect.bottom - vh < vh * 1.5 && hi < n - 1 && loaded.has(hi)) next = { lo, hi: Math.min(n - 1, hi + GROW) };
      else if (rect.top > -vh && lo > 0 && loaded.has(lo)) next = { lo: Math.max(0, lo - GROW), hi };
      if (next.hi - next.lo + 1 > MAX_MOUNTED) {
        if (page - next.lo > next.hi - page) next.lo = next.hi - MAX_MOUNTED + 1;
        else next.hi = next.lo + MAX_MOUNTED - 1;
      }
      if (next.lo !== lo || next.hi !== hi) setWin(next);
    };
    const onScroll = () => (frame ||= requestAnimationFrame(update));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads refs; re-run when content changes
  }, [paras, n]);

  // ── DOM ↔ text positions ────────────────────────────────────────────
  function rangesOn(page: number, start: number, end: number): Range[] {
    const out: Range[] = [];
    root.current?.querySelectorAll<HTMLElement>(`[data-p="${page}"]`).forEach((span) => {
      const node = span.firstChild;
      if (!node) return;
      const o = Number(span.dataset.o);
      const len = node.textContent?.length ?? 0;
      const s = Math.max(start, o);
      const e = Math.min(end, o + len);
      if (s >= e) return;
      const r = document.createRange();
      r.setStart(node, s - o);
      r.setEnd(node, e - o);
      out.push(r);
    });
    return out;
  }

  const goTo = (page: number, target?: { offset?: number; start?: number }) => {
    const p = clamp(page);
    anchor.current = { page: p, offset: target?.offset ?? 0 };
    textTarget.current = target?.start !== undefined ? { page: p, start: target.start } : null;
    const { lo, hi } = winRef.current;
    if (p >= lo && p <= hi && pagesRef.current.has(p)) {
      if (!(textTarget.current && scrollToText(p, textTarget.current.start))) restore();
      else textTarget.current = null;
    } else {
      setWin({ lo: clamp(p - BEFORE), hi: clamp(p + AFTER) });
    }
  };

  useImperativeHandle(ref, () => ({
    goTo,
    // A "page" here is a screenful, keeping two lines of overlap.
    step: (dir) =>
      scrollWindowTo(window.scrollY + dir * (window.innerHeight - TOP_INSET - prefs.size * prefs.lineHeight * 2)),
    locate(node, offset) {
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
      const span = el?.closest<HTMLElement>("[data-o]");
      if (span) {
        return { page: Number(span.dataset.p), offset: Number(span.dataset.o) + (node.nodeType === Node.TEXT_NODE ? offset : 0) };
      }
      // An element boundary: use the nearest text span before it.
      const before = node.childNodes[offset - 1] ?? el;
      const spans = before instanceof Element ? before.querySelectorAll<HTMLElement>("[data-o]") : null;
      const last = spans?.[spans.length - 1];
      return last ? { page: Number(last.dataset.p), offset: Number(last.dataset.o) + (last.textContent?.length ?? 0) } : null;
    },
    ranges: rangesOn,
    pageText: (page) => pagesRef.current.get(page)?.text ?? null,
    root: () => root.current,
  }));

  // ── Render ──────────────────────────────────────────────────────────
  const docDir = direction === "rtl" || direction === "ltr" ? direction : undefined;
  const paraDir = docDir ? undefined : "auto";

  if (failed && !pages.size) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-muted-foreground">{t("textError")}</p>
          <Button variant="outline" className="mt-4" onClick={() => qc.invalidateQueries({ queryKey: ["pages", docId] })}>
            <RotateCcw aria-hidden />
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }
  if (pending && !pages.size) {
    return (
      <div role="status" className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 aria-hidden className="size-5 animate-spin" />
          <p>{t("preparingText")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-[40vh]" style={{ paddingTop: TOP_INSET + 32 }}>
      <div
        ref={root}
        lang={lang ?? undefined}
        dir={docDir}
        className={cn("reflow mx-auto [overflow-anchor:none]", prefs.justify && "reflow-justify")}
        style={{
          fontFamily: fontStacks[prefs.font],
          fontSize: prefs.size,
          lineHeight: prefs.lineHeight,
          maxWidth: `calc(${prefs.width}em + ${marginPx[prefs.margin] * 2}px)`,
          paddingInline: marginPx[prefs.margin],
        }}
      >
        {paras.map((para) => {
          const marks = para.segs.map((seg, i) => (
            <Fragment key={`${seg.page}:${seg.s}`}>
              {i > 0 && " "}
              {seg.mark && <span data-page-mark={seg.page} />}
              {seg.text && (
                <span data-p={seg.page} data-o={seg.s}>
                  {seg.text}
                </span>
              )}
            </Fragment>
          ));
          if (para.kind === "loading") {
            return (
              <div key={para.key} aria-hidden className="reflow-loading">
                {marks}
                {[92, 100, 96, 88, 60].map((w, i) => (
                  <div key={i} className="mb-[0.6em] h-[0.9em] rounded bg-muted" style={{ width: `${w}%` }} />
                ))}
              </div>
            );
          }
          if (para.kind === "empty") {
            return (
              <p key={para.key} className="reflow-empty">
                {marks}
                {t("noTextOnPage", { page: para.segs[0].page + 1 })}
              </p>
            );
          }
          return para.kind === "h" ? (
            <h2 key={para.key} dir={paraDir}>
              {marks}
            </h2>
          ) : (
            <p key={para.key} dir={paraDir}>
              {marks}
            </p>
          );
        })}
      </div>
    </div>
  );
});
