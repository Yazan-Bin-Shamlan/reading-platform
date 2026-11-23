"use client";

import { ArrowLeft, ArrowRight, ListTree, Minus, Plus, RotateCcw, Scan } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ThemeMenu } from "@/components/shell/theme-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProgressSaver } from "@/hooks/use-progress-saver";
import { useTheme } from "@/hooks/use-theme";
import { Link } from "@/i18n/navigation";
import type { TocEntry } from "@/lib/library/schemas";
import { openPdf, type PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { themes } from "@/lib/preferences/themes";
import { anchorAt, computeLayout, pageAt, positionOf, visibleRange, type Size } from "@/lib/reader/layout";
import { cn } from "@/lib/utils";
import { PdfPage } from "./pdf-page";
import { TocPanel } from "./toc-panel";
import "./pdf-layers.css";

const GAP = 16;
const TOP_INSET = 64; // toolbar height: the reading area starts below it
const MAX_FIT_WIDTH = 880;
const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

type Anchor = { page: number; offset: number };

export type PdfReaderProps = {
  docId: string;
  title: string;
  fileUrl: string;
  pageCount: number | null;
  toc: TocEntry[];
  direction: "rtl" | "ltr" | "mixed" | null;
  initial: Anchor | null;
};

export function PdfReader({ docId, title, fileUrl, pageCount, toc, direction, initial }: PdfReaderProps) {
  const t = useTranslations("reader");
  const locale = useLocale();
  const uiRtl = locale === "ar";
  const docRtl = direction === "rtl";
  const { theme, setTheme } = useTheme();

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
  const [zoom, setZoom] = useState(1);
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
  const [current, setCurrent] = useState(initial?.page ?? 0);
  // Also kept in a ref so quick repeated key presses build on each other.
  const currentRef = useRef(initial?.page ?? 0);
  const [position, setPosition] = useState<{ pageIndex: number; offset: number; percent: number } | null>(null);
  const [chrome, setChrome] = useState(true);
  const lastY = useRef(0);
  // Jumps, resume and zoom move the page; they shouldn't hide the toolbar like reading down does.
  const programmatic = useRef(false);
  const scrollToY = (top: number) => {
    programmatic.current = true;
    window.scrollTo({ top, behavior: "instant" });
  };

  // We restore the position ourselves; the browser's own restoration would fight it.
  useEffect(() => {
    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = prev;
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const l = layoutRef.current;
      if (!l) return;
      const y = window.scrollY + TOP_INSET - docTop();
      const bottom = y + window.innerHeight - TOP_INSET;
      setView({ top: y, bottom });
      const a = anchorAt(l, Math.max(0, y));
      anchor.current = a;
      currentRef.current = pageAt(l, y + (window.innerHeight - TOP_INSET) * 0.3);
      setCurrent(currentRef.current);
      const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      setPosition({
        pageIndex: a.page,
        offset: Math.round(a.offset * 1000) / 1000,
        percent: atEnd ? 1 : Math.min(1, (a.page + a.offset) / Math.max(1, l.tops.length)),
      });
      // Hide the toolbar while reading down; bring it back on any scroll up.
      const dy = window.scrollY - lastY.current;
      if (programmatic.current) {
        programmatic.current = false;
        lastY.current = window.scrollY;
      } else if (Math.abs(dy) > 8) {
        setChrome(dy < 0 || window.scrollY < 40);
        lastY.current = window.scrollY;
      }
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
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!layout || !anchor.current) return;
    const target = docTop() + positionOf(layout, anchor.current) - TOP_INSET;
    if (Math.abs(window.scrollY - target) > 1) scrollToY(target);
    if (!restored.current) {
      restored.current = true;
      // Deferred: on a fresh load this runs before the Toaster has subscribed.
      if (initial && initial.page > 0) setTimeout(() => toast(t("resumed", { page: initial.page + 1 })), 300);
    }
  }, [layout, initial, t]);

  useProgressSaver(docId, position);

  // ── Navigation ─────────────────────────────────────────────────────
  const goToPage = useCallback((page: number) => {
    const l = layoutRef.current;
    if (!l) return;
    const p = Math.min(Math.max(0, page), l.tops.length - 1);
    anchor.current = { page: p, offset: 0 };
    currentRef.current = p;
    setCurrent(p);
    scrollToY(docTop() + l.tops[p] - TOP_INSET);
    setChrome(true);
  }, []);

  const zoomBy = useCallback((dir: 1 | -1) => {
    setZoom((z) => {
      const i = ZOOMS.findIndex((v) => v >= z - 0.001);
      return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? 4 : i) + dir))];
    });
  }, []);

  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      const next = () => goToPage(currentRef.current + 1);
      const prev = () => goToPage(currentRef.current - 1);
      switch (e.key) {
        case "ArrowRight":
          (docRtl ? prev : next)();
          break;
        case "ArrowLeft":
          (docRtl ? next : prev)();
          break;
        case "+":
        case "=":
          zoomBy(1);
          break;
        case "-":
          zoomBy(-1);
          break;
        case "0":
          setZoom(1);
          break;
        case "t": {
          const i = themes.indexOf(theme as (typeof themes)[number]);
          setTheme(themes[(i + 1) % themes.length]);
          break;
        }
        case "c":
          setTocOpen((o) => !o);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [docRtl, goToPage, zoomBy, theme, setTheme]);

  // Bring the toolbar back when the pointer nears the top edge.
  useEffect(() => {
    const onMove = (e: PointerEvent) => e.pointerType === "mouse" && e.clientY < 72 && setChrome(true);
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const [first, last] = layout ? visibleRange(layout, view.top, view.bottom) : [0, -1];
  const maxWidth = layout ? Math.max(...layout.widths.slice(first, last + 1), 0) : 0;
  const percent = position?.percent ?? 0;
  const Back = uiRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-dvh">
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b bg-background/90 backdrop-blur-md transition-transform duration-300",
          !chrome && !tocOpen && "-translate-y-full",
        )}
        onFocusCapture={() => setChrome(true)}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-2 sm:gap-2 sm:px-4">
          <IconButton label={t("back")} asChild>
            <Link href="/library">
              <Back aria-hidden />
            </Link>
          </IconButton>
          <IconButton label={`${t("contents")} (C)`} onClick={() => setTocOpen(true)}>
            <ListTree aria-hidden />
          </IconButton>
          <h1 dir="auto" className="min-w-0 flex-1 truncate px-1 text-sm font-medium sm:text-center">
            {title}
          </h1>
          {numPages > 0 && <PageField current={current} total={numPages} onGo={goToPage} />}
          <div className="hidden items-center sm:flex">
            <IconButton label={`${t("zoomOut")} (−)`} onClick={() => zoomBy(-1)} disabled={zoom <= ZOOMS[0]}>
              <Minus aria-hidden />
            </IconButton>
            <IconButton label={`${t("fitWidth")} (0)`} onClick={() => setZoom(1)} disabled={zoom === 1}>
              <Scan aria-hidden />
            </IconButton>
            <IconButton label={`${t("zoomIn")} (+)`} onClick={() => zoomBy(1)} disabled={zoom >= ZOOMS.at(-1)!}>
              <Plus aria-hidden />
            </IconButton>
          </div>
          <ThemeMenu />
        </div>
      </header>

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
            />
          ))
        )}
      </div>
      <div style={{ height: GAP * 3 }} />

      {/* Reading progress along the bottom edge. */}
      <div className="fixed inset-x-0 bottom-0 z-30 h-0.5 bg-transparent" aria-hidden>
        <div className="h-full bg-brand/70 transition-[width] duration-300" style={{ width: `${percent * 100}%` }} />
      </div>

      <TocPanel
        open={tocOpen}
        onOpenChange={setTocOpen}
        toc={toc}
        currentPage={current}
        side={uiRtl ? "right" : "left"}
        onSelect={(page) => {
          setTocOpen(false);
          goToPage(page);
        }}
      />
    </div>
  );
}

function IconButton({
  label,
  children,
  ...props
}: { label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** "12 / 340": type a number and press Enter to jump. */
function PageField({ current, total, onGo }: { current: number; total: number; onGo: (page: number) => void }) {
  const t = useTranslations("reader");
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <form
      className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number.parseInt(draft ?? "", 10);
        if (Number.isFinite(n)) onGo(Math.min(Math.max(1, n), total) - 1);
        setDraft(null);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <input
        aria-label={t("goToPage")}
        inputMode="numeric"
        value={draft ?? String(current + 1)}
        onFocus={(e) => {
          setDraft(String(current + 1));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={() => setDraft(null)}
        className="h-8 w-12 rounded-md border bg-background text-center text-foreground"
        style={{ width: `${Math.max(3, String(total).length + 1.5)}ch` }}
      />
      <span className="whitespace-nowrap">{t("pageOf", { total })}</span>
    </form>
  );
}
