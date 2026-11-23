"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePageText } from "@/hooks/use-page-text";
import { openPdf, type PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { anchorAt, computeLayout, pageAt, positionOf, visibleRange, type Size } from "@/lib/reader/layout";
import { isProgrammaticScroll, scrollWindowTo, TOP_INSET } from "@/lib/reader/scroll";
import { itemToText, textToItems } from "@/lib/reader/text-map";
import { PdfPage } from "./pdf-page";
import type { Anchor, ViewProps } from "./types";
import "./pdf-layers.css";

const GAP = 16;
const MAX_FIT_WIDTH = 880;

type Props = ViewProps & {
  fileUrl: string;
  pageCount: number | null;
  zoom: number;
  /** Whether the document has text to map (not a scan). */
  hasText: boolean;
};

/** The Original view: the PDF's own pages, drawn only near the screen. */
export const PdfView = memo(function PdfView({ docId, fileUrl, pageCount, zoom, hasText, initial, ref, onPosition, onRendered }: Props) {
  const t = useTranslations("reader");

  // ── Load the document ──────────────────────────────────────────────
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [base, setBase] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let loaded: PDFDocumentProxy | null = null;
    openPdf({ url: fileUrl })
      .then(async (doc) => {
        loaded = doc;
        const first = await doc.getPage(1);
        const v = first.getViewport({ scale: 1 });
        if (!alive) return;
        setBase({ w: v.width, h: v.height });
        setPdf(doc);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      void loaded?.loadingTask.destroy();
    };
  }, [fileUrl, attempt]);

  const numPages = pdf?.numPages ?? pageCount ?? 0;

  // ── Layout ─────────────────────────────────────────────────────────
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Sizes of pages that differ from page 1, learned as pages load.
  const [sizes, setSizes] = useState<ReadonlyMap<number, Size>>(() => new Map());

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    // Measure now too: ResizeObserver only reports on the next rendered frame.
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!base || !width) return 0;
    const pad = width < 640 ? 8 : 32;
    return (Math.min(width - pad * 2, MAX_FIT_WIDTH) / base.w) * zoom;
  }, [base, width, zoom]);

  const layout = useMemo(
    () => (base && scale ? computeLayout(numPages, base, sizes, scale, GAP) : null),
    [numPages, base, scale, sizes],
  );
  const layoutRef = useRef(layout);
  useLayoutEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const pendingSizes = useRef<Map<number, Size> | null>(null);
  const onSize = useCallback(
    (index: number, w: number, h: number) => {
      if (!base || (Math.abs(w - base.w) < 1 && Math.abs(h - base.h) < 1)) return;
      if (pendingSizes.current) {
        pendingSizes.current.set(index, { w, h });
        return;
      }
      pendingSizes.current = new Map([[index, { w, h }]]);
      requestAnimationFrame(() => {
        const batch = pendingSizes.current!;
        pendingSizes.current = null;
        setSizes((prev) => {
          if ([...batch].every(([i]) => prev.has(i))) return prev;
          return new Map([...prev, ...batch]);
        });
      });
    },
    [base],
  );

  // ── Scroll tracking (the window scrolls; pages are absolutely placed) ─
  const docTop = () => (container.current ? container.current.getBoundingClientRect().top + window.scrollY : 0);
  const anchor = useRef<Anchor | null>(initial);
  const [view, setView] = useState({ top: 0, bottom: 0 });
  // Also kept in a ref so quick repeated key presses build on each other.
  const currentRef = useRef(initial?.page ?? 0);
  const onPositionRef = useRef(onPosition);
  useLayoutEffect(() => {
    onPositionRef.current = onPosition;
  }, [onPosition]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const l = layoutRef.current;
      if (!l) return;
      const y = window.scrollY + TOP_INSET - docTop();
      setView({ top: y, bottom: y + window.innerHeight - TOP_INSET });
      const a = anchorAt(l, Math.max(0, y));
      // A jump sets the anchor exactly; don't round it off before the page settles.
      if (!isProgrammaticScroll() || !anchor.current) anchor.current = a;
      currentRef.current = pageAt(l, y + (window.innerHeight - TOP_INSET) * 0.3);
      const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      onPositionRef.current({
        pageIndex: a.page,
        offset: Math.round(a.offset * 1000) / 1000,
        percent: atEnd ? 1 : Math.min(1, (a.page + a.offset) / Math.max(1, l.tops.length)),
        current: currentRef.current,
      });
    };
    const onScroll = () => (frame ||= requestAnimationFrame(update));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update(); // now, not next frame: layout just changed (and frames pause in background tabs)
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [layout]);

  // Keep the same spot in view across zoom, resize and late page sizes; resume on first layout.
  useLayoutEffect(() => {
    if (!layout || !anchor.current) return;
    const target = docTop() + positionOf(layout, anchor.current) - TOP_INSET;
    if (Math.abs(window.scrollY - target) > 1) scrollWindowTo(target);
  }, [layout]);

  // ── Text layer ↔ page text ─────────────────────────────────────────
  const [first, last] = layout ? visibleRange(layout, view.top, view.bottom) : [0, -1];
  const { pages } = usePageText(docId, first, last, { map: true, enabled: hasText && last >= first });
  const pagesRef = useRef(pages);
  const spans = useRef(new Map<number, HTMLElement[]>());
  const spanIndex = useRef(new WeakMap<HTMLElement, { page: number; item: number }>());
  const [layerVersion, setLayerVersion] = useState(0);

  const onTextLayer = useCallback((index: number, divs: HTMLElement[] | null) => {
    if (divs) {
      spans.current.set(index, divs);
      divs.forEach((el, item) => spanIndex.current.set(el, { page: index, item }));
    } else {
      spans.current.delete(index);
    }
    setLayerVersion((v) => v + 1);
  }, []);

  useLayoutEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  useEffect(() => onRendered(), [pages, layerVersion, onRendered]);

  // A jump to a text offset waits until that page's text layer and map are ready.
  const pendingTarget = useRef<{ page: number; start: number } | null>(null);
  useEffect(() => {
    const target = pendingTarget.current;
    if (!target) return;
    const range = rangesOn(target.page, target.start, target.start + 1)[0];
    if (!range) return;
    pendingTarget.current = null;
    const rect = range.getBoundingClientRect();
    scrollWindowTo(window.scrollY + rect.top - TOP_INSET - (window.innerHeight - TOP_INSET) * 0.3);
  }, [pages, layerVersion]);

  function rangesOn(page: number, start: number, end: number): Range[] {
    const divs = spans.current.get(page);
    const map = pagesRef.current.get(page)?.map;
    if (!divs || !map) return [];
    const out: Range[] = [];
    for (const part of textToItems(map, start, end)) {
      const node = divs[part.item]?.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) continue;
      const len = node.textContent?.length ?? 0;
      const r = document.createRange();
      r.setStart(node, Math.min(part.start, len));
      r.setEnd(node, Math.min(part.end, len));
      out.push(r);
    }
    return out;
  }

  // ── Navigation ─────────────────────────────────────────────────────
  const goToPage = useCallback((page: number, offset = 0) => {
    const l = layoutRef.current;
    if (!l) return;
    const p = Math.min(Math.max(0, page), l.tops.length - 1);
    anchor.current = { page: p, offset };
    currentRef.current = p;
    scrollWindowTo(docTop() + positionOf(l, anchor.current) - TOP_INSET);
  }, []);

  useImperativeHandle(ref, () => ({
    goTo(page, target) {
      goToPage(page, target?.offset ?? 0);
      if (target?.start !== undefined) {
        pendingTarget.current = { page, start: target.start };
        setLayerVersion((v) => v + 1);
      }
    },
    step: (dir) => goToPage(currentRef.current + dir),
    locate(node, offset) {
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
      let span = el?.closest<HTMLElement>(".textLayer span:not(.markedContent)") ?? null;
      let ci = node.nodeType === Node.TEXT_NODE ? offset : 0;
      if (!span && el) {
        // A selection can end on the layer itself or its end marker: use the span just before.
        const layer = el.closest(".textLayer");
        const before = node.childNodes[offset - 1] ?? el.previousElementSibling;
        span = before instanceof HTMLElement ? (layer ? lastSpan(before) : null) : null;
        ci = span?.textContent?.length ?? 0;
      }
      const at = span && spanIndex.current.get(span);
      const map = at && pagesRef.current.get(at.page)?.map;
      if (!at || !map) return null;
      const off = itemToText(map, at.item, ci);
      return off === null ? null : { page: at.page, offset: off };
    },
    ranges: rangesOn,
    pageText: (page) => pagesRef.current.get(page)?.text ?? null,
    root: () => container.current,
  }));

  const maxWidth = layout ? Math.max(...layout.widths.slice(first, last + 1), 0) : 0;

  return (
    <>
      <div style={{ height: TOP_INSET + GAP }} />
      <div
        ref={container}
        className="relative"
        style={{
          height: layout?.total ?? "calc(100dvh - 6rem)",
          minWidth: maxWidth ? maxWidth + 16 : undefined,
        }}
      >
        {failed ? (
          <div className="grid h-[60dvh] place-items-center text-center">
            <div>
              <p className="text-muted-foreground">{t("loadError")}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setFailed(false);
                  setAttempt((a) => a + 1);
                }}
              >
                <RotateCcw aria-hidden />
                {t("retry")}
              </Button>
            </div>
          </div>
        ) : !pdf || !layout ? (
          <div role="status" className="flex flex-col items-center gap-4 px-4">
            <span className="sr-only">{t("loading")}</span>
            <div className="aspect-[3/4] w-full max-w-[880px] animate-pulse rounded-sm bg-muted" />
          </div>
        ) : (
          Array.from({ length: last - first + 1 }, (_, k) => first + k).map((i) => (
            <PdfPage
              key={i}
              pdf={pdf}
              index={i}
              scale={scale}
              top={layout.tops[i]}
              width={layout.widths[i]}
              height={layout.heights[i]}
              label={`${t("page")} ${i + 1}`}
              onSize={onSize}
              onTextLayer={onTextLayer}
            />
          ))
        )}
      </div>
      <div style={{ height: GAP * 3 }} />
    </>
  );
});

function lastSpan(el: HTMLElement): HTMLElement | null {
  if (el.matches(".textLayer span:not(.markedContent)")) return el;
  const inner = el.querySelectorAll<HTMLElement>("span:not(.markedContent)");
  return inner[inner.length - 1] ?? null;
}
