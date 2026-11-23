"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpenText,
  FileText,
  ListTree,
  NotebookTabs,
  Search,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAnnotations } from "@/hooks/use-annotations";
import { useProgressSaver } from "@/hooks/use-progress-saver";
import { useTheme } from "@/hooks/use-theme";
import { Link } from "@/i18n/navigation";
import type { TocEntry } from "@/lib/library/schemas";
import { themes } from "@/lib/preferences/themes";
import {
  covers,
  highlightColors,
  onPage,
  rangeOf,
  type Annotation,
  type HighlightColor,
  type TextRange,
} from "@/lib/reader/annotations";
import { fileSlug, notesToMarkdown } from "@/lib/reader/export";
import { paint } from "@/lib/reader/paint";
import type { ReaderPrefs } from "@/lib/reader/prefs";
import { isProgrammaticScroll } from "@/lib/reader/scroll";
import { chapterEnd, minutesLeft, WPM } from "@/lib/reader/time-left";
import type { Hit } from "@/lib/text/search";
import { cn } from "@/lib/utils";
import { AnnotationActions, Floating, NoteEditor } from "./annotation-menu";
import { AssistCard } from "./assist-card";
import { AssistMenu, LevelPrompt } from "./assist-menu";
import { NotesPanel } from "./notes-panel";
import { PdfView } from "./pdf-view";
import { ReaderSettings, ZOOMS } from "./reader-settings";
import { ReflowView } from "./reflow-view";
import { SearchPanel } from "./search-panel";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { TocPanel } from "./toc-panel";
import type { Anchor, Position, ViewHandle } from "./types";
import { useSmartAssist, type AssistInitial } from "./use-smart-assist";
import "./reader.css";

export type ReaderProps = {
  docId: string;
  title: string;
  authors: string[];
  /** The PDF; null for books that are text only (Project Gutenberg's HTML editions). */
  fileUrl: string | null;
  fileSize?: number | null;
  pageCount: number | null;
  toc: TocEntry[];
  direction: "rtl" | "ltr" | "mixed" | null;
  language: "ar" | "en" | null;
  textStatus: "pending" | "ok" | "scanned" | "garbled";
  pageWords: number[] | null;
  initial: Anchor | null;
  initialPrefs: ReaderPrefs;
  initialAnnotations: Annotation[];
  assist: AssistInitial;
  /** Open at this text and flash it (links from My Words). */
  jump?: { page: number; start: number; end: number } | null;
};

type Panel = "toc" | "notes" | "search" | "help" | null;
type Menu = { mode: "actions" | "note"; annotation: Annotation } | null;

const TERMINAL_CHROME_Y = 72;

/** Where the caret would go at a point: the text node and offset under the pointer. */
function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (pos) return { node: pos.offsetNode, offset: pos.offset };
  const range = doc.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

/**
 * The shortcut a key press means. Arabic and other layouts type different
 * characters on these keys ("ظ" on "/", "ب" on "f"), so fall back to the
 * physical key when the character isn't plain ASCII.
 */
function shortcutKey(e: KeyboardEvent) {
  if (e.key.length !== 1 || /^[\x20-\x7e]$/.test(e.key)) return e.key;
  if (e.code === "Slash") return e.shiftKey ? "?" : "/";
  if (e.code === "Equal") return e.shiftKey ? "+" : "=";
  if (e.code === "Minus") return "-";
  if (e.code === "Digit0") return "0";
  return /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key;
}

const unionRect = (rects: DOMRect[]) => {
  const r = rects.filter((x) => x.width || x.height);
  if (!r.length) return null;
  const left = Math.min(...r.map((x) => x.left));
  const top = Math.min(...r.map((x) => x.top));
  return new DOMRect(left, top, Math.max(...r.map((x) => x.right)) - left, Math.max(...r.map((x) => x.bottom)) - top);
};

export function Reader(props: ReaderProps) {
  const { docId, title, authors, fileUrl, pageCount, toc, direction, language, textStatus, pageWords, jump } = props;
  const initial = jump ? { page: jump.page, offset: 0 } : props.initial;
  const t = useTranslations("reader");
  const tn = useTranslations("notes");
  const locale = useLocale();
  const uiRtl = locale === "ar";
  const docRtl = direction === "rtl";
  const { theme, setTheme } = useTheme();
  const hasText = textStatus !== "scanned";
  const numPages = pageCount ?? 0;
  const view = useRef<ViewHandle>(null);
  // Bumped when the views' on-screen text changes, so highlights and marks get redrawn.
  const [paintTick, setPaintTick] = useState(0);
  const onRendered = useCallback(() => setPaintTick((n) => n + 1), []);

  // ── Preferences (saved to the profile, a moment after the last change) ─
  const [prefs, setPrefsState] = useState(props.initialPrefs);
  const unsaved = useRef<Partial<ReaderPrefs>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const setPrefs = useCallback((p: Partial<ReaderPrefs>) => {
    setPrefsState((prev) => ({ ...prev, ...p }));
    unsaved.current = { ...unsaved.current, ...p };
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const reader = unsaved.current;
      unsaved.current = {};
      void fetch("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reader }),
        keepalive: true,
      }).catch(() => {});
    }, 800);
  }, []);
  const mode = !fileUrl ? "reading" : hasText ? prefs.mode : "original";
  const [zoom, setZoom] = useState(1);

  // ── Position ───────────────────────────────────────────────────────
  const [position, setPosition] = useState<Position | null>(null);
  const [current, setCurrent] = useState(initial?.page ?? 0);
  const latest = useRef<Anchor | null>(initial);
  const [startAt, setStartAt] = useState<Anchor | null>(initial);
  const [flash, setFlash] = useState(jump ?? null);
  const onPosition = useCallback((p: Position & { current: number }) => {
    latest.current = { page: p.pageIndex, offset: p.offset };
    setPosition({ pageIndex: p.pageIndex, offset: p.offset, percent: p.percent });
    setCurrent(p.current);
  }, []);
  useProgressSaver(docId, position);

  // ── Smart Reading Assist ───────────────────────────────────────────
  const getView = useCallback(() => view.current, []);
  const smart = useSmartAssist({ docId, getView, current, language, hasText, paintTick, initial: props.assist });
  const [levelLater, setLevelLater] = useState(false);
  const [pauseSeen, setPauseSeen] = useState(false);

  useEffect(() => {
    if (jump) {
      // Scroll to the exact text once the page is there, and flash it for a moment.
      view.current?.goTo(jump.page, { start: jump.start });
      const id = setTimeout(() => setFlash(null), 6000);
      return () => clearTimeout(id);
    }
    if (initial && initial.page > 0) {
      const id = setTimeout(() => toast(t("resumed", { page: initial.page + 1 })), 300);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  const switchMode = useCallback(
    (next: ReaderPrefs["mode"]) => {
      if (next === mode || (next === "reading" && !hasText) || (next === "original" && !fileUrl)) return;
      setStartAt(latest.current);
      setPrefs({ mode: next });
    },
    [mode, hasText, fileUrl, setPrefs],
  );

  // ── Toolbar visibility and focus mode ──────────────────────────────
  const [chrome, setChrome] = useState(true);
  const [focus, setFocus] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const overToolbar = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      if (isProgrammaticScroll()) {
        lastY = window.scrollY;
        return;
      }
      const dy = window.scrollY - lastY;
      if (Math.abs(dy) < 8) return;
      // Hide while reading down; bring back on scroll up (unless in focus mode).
      setChrome(!focus && (dy < 0 || window.scrollY < 40));
      lastY = window.scrollY;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (focus) {
        setChrome(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => !overToolbar.current && setChrome(false), 2000);
      } else if (e.clientY < TERMINAL_CHROME_Y) {
        setChrome(true);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      clearTimeout(hideTimer.current);
    };
  }, [focus]);

  const toggleFocus = useCallback(() => {
    setFocus((f) => {
      setChrome(f);
      if (!f) toast(t("focusOn"));
      return !f;
    });
  }, [t]);

  // ── Annotations ────────────────────────────────────────────────────
  const { annotations, add, update, remove } = useAnnotations(docId, props.initialAnnotations);
  const [sel, setSel] = useState<{ range: TextRange; dom: Range } | null>(null);
  const [menu, setMenu] = useState<Menu>(null);

  const quoteOf = useCallback((r: TextRange) => {
    const parts: string[] = [];
    for (let p = r.page; p <= r.endPage; p++) {
      const text = view.current?.pageText(p) ?? "";
      const seg = onPage(r, p, text.length);
      if (seg) parts.push(text.slice(seg[0], seg[1]));
    }
    const before = view.current?.pageText(r.page) ?? "";
    const after = view.current?.pageText(r.endPage) ?? "";
    return {
      quote: parts.join(" ").replace(/\s+/g, " ").trim(),
      prefix: before.slice(Math.max(0, r.start - 40), r.start),
      suffix: after.slice(r.end, r.end + 40),
    };
  }, []);

  /** The line boxes a text range covers on screen. */
  const rectsOf = useCallback((r: TextRange | null) => {
    const rects: DOMRect[] = [];
    if (!r || !view.current) return rects;
    for (let p = r.page; p <= r.endPage; p++) {
      const len = view.current.pageText(p)?.length ?? 0;
      const seg = onPage(r, p, len);
      if (seg) for (const range of view.current.ranges(p, seg[0], seg[1])) rects.push(...range.getClientRects());
    }
    return rects;
  }, []);
  const rectOf = useCallback((r: TextRange | null) => unionRect(rectsOf(r)), [rectsOf]);

  // Track the text selection inside the view.
  const pointerDown = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      const s = window.getSelection();
      const v = view.current;
      if (!s || s.isCollapsed || !s.rangeCount || !v) return setSel(null);
      const r = s.getRangeAt(0);
      const root = v.root();
      if (!root?.contains(r.commonAncestorContainer)) return setSel(null);
      const a = v.locate(r.startContainer, r.startOffset);
      const b = v.locate(r.endContainer, r.endOffset);
      if (!a || !b) return setSel(null);
      const [x, y] = a.page < b.page || (a.page === b.page && a.offset <= b.offset) ? [a, b] : [b, a];
      if (x.page === y.page && x.offset === y.offset) return setSel(null);
      setSel({ range: { page: x.page, start: x.offset, endPage: y.page, end: y.offset }, dom: r.cloneRange() });
    };
    const onChange = () => {
      clearTimeout(timer);
      if (!pointerDown.current) timer = setTimeout(read, 150);
    };
    const onDown = () => (pointerDown.current = true);
    const onUp = () => {
      pointerDown.current = false;
      clearTimeout(timer);
      timer = setTimeout(read, 10);
    };
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [mode]);

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };

  const highlight = (color: HighlightColor, withNote = false) => {
    if (!sel) return;
    const r = sel.range;
    const draft = {
      kind: "highlight" as const,
      color,
      pageIndex: r.page,
      start: r.start,
      endPage: r.endPage !== r.page ? r.endPage : null,
      end: r.end,
      note: null,
      ...quoteOf(r),
    };
    const id = add(draft);
    clearSelection();
    if (withNote) setMenu({ mode: "note", annotation: { ...draft, id, createdAt: new Date().toISOString() } });
  };

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => toast(tn("copied")));
  };

  // Open the menu for a highlight when it's clicked or tapped.
  const highlightAt = useCallback(
    (x: number, y: number): Annotation | null => {
      const v = view.current;
      const caret = caretAt(x, y);
      if (!v || !caret || !v.root()?.contains(caret.node)) return null;
      const pos = v.locate(caret.node, caret.offset);
      if (!pos) return null;
      const hit = [...annotations].reverse().find((a) => covers(a, pos.page, pos.offset));
      // The caret snaps to the nearest text; only count clicks on the highlight itself.
      const inside = hit && rectsOf(rangeOf(hit)).some((b) => x >= b.left - 2 && x <= b.right + 2 && y >= b.top - 2 && y <= b.bottom + 2);
      return inside ? hit : null;
    },
    [annotations, rectsOf],
  );

  // ── Touch: tap toggles the toolbar, horizontal swipe turns the page ──
  const step = useCallback(
    (forward: boolean) => view.current?.step(forward ? 1 : -1),
    [],
  );
  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const p = e.touches[0];
      start = e.touches.length === 1 ? { x: p.clientX, y: p.clientY, t: Date.now() } : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - start.x;
      const dy = p.clientY - start.y;
      const dt = Date.now() - start.t;
      start = null;
      const target = e.target as HTMLElement;
      if (!view.current?.root()?.contains(target)) return;
      const selected = !window.getSelection()?.isCollapsed;
      if (selected) return;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 && dt < 600 && (mode === "reading" || zoom <= 1)) {
        // Swipe toward the start of the line = next page (left in English, right in Arabic).
        step(docRtl ? dx > 0 : dx < 0);
        return;
      }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 350) {
        const hit = highlightAt(p.clientX, p.clientY);
        const term = hit ? null : smart.termAt(p.clientX, p.clientY);
        if (hit) setMenu({ mode: "actions", annotation: hit });
        else if (term) smart.openTerm(term.term, term.page);
        else if (smart.card) smart.setCard(null);
        else setChrome((c) => !c);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [mode, zoom, docRtl, step, highlightAt, smart]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!window.getSelection()?.isCollapsed) return;
      const hit = highlightAt(e.clientX, e.clientY);
      if (hit) return setMenu({ mode: "actions", annotation: hit });
      // A click on a mark pins its card open.
      const term = smart.termAt(e.clientX, e.clientY);
      if (term) smart.openTerm(term.term, term.page);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [highlightAt, smart]);

  // ── Search ─────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [hitIndex, setHitIndex] = useState(0);
  const onHits = useCallback((h: Hit[]) => {
    setHits(h);
    setHitIndex(0);
  }, []);
  const closeSearch = useCallback(() => {
    setPanel(null);
    setHits([]);
  }, []);

  // ── Painting highlights and search matches ─────────────────────────
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const byColor = new Map<HighlightColor, Range[]>();
    const noted: Range[] = [];
    for (const a of annotations) {
      const r = rangeOf(a);
      if (!r) continue;
      for (let p = r.page; p <= r.endPage; p++) {
        const len = v.pageText(p)?.length;
        const seg = len && onPage(r, p, len);
        if (!seg) continue;
        const ranges = v.ranges(p, seg[0], seg[1]);
        const color = a.color ?? "yellow";
        byColor.set(color, [...(byColor.get(color) ?? []), ...ranges]);
        if (a.note) noted.push(...ranges);
      }
    }
    for (const c of highlightColors) paint(`hl-${c}`, byColor.get(c) ?? []);
    paint("hl-note", noted);
    const near = hits.filter((h) => Math.abs(h.page - current) <= 30);
    paint("search", near.flatMap((h) => v.ranges(h.page, h.start, h.end)));
    const active = hits[hitIndex];
    paint("search-current", active ? v.ranges(active.page, active.start, active.end) : []);
    paint("flash", flash ? v.ranges(flash.page, flash.start, flash.end) : []);
  }, [annotations, hits, hitIndex, current, paintTick, mode, flash]);
  useEffect(
    () => () => {
      for (const name of [...highlightColors.map((c) => `hl-${c}`), "hl-note", "search", "search-current", "flash"]) paint(name, []);
    },
    [],
  );

  // ── Bookmarks and export ───────────────────────────────────────────
  const bookmark = annotations.find((a) => a.kind === "bookmark" && a.pageIndex === current);
  const toggleBookmark = useCallback(() => {
    if (bookmark) {
      remove(bookmark, tn("bookmarkRemoved"));
    } else {
      add({ kind: "bookmark", color: null, pageIndex: current, start: null, endPage: null, end: null, quote: null, prefix: null, suffix: null, note: null });
      toast(tn("bookmarkAdded", { page: current + 1 }));
    }
  }, [bookmark, current, add, remove, tn]);

  const exportNotes = () => {
    const md = notesToMarkdown({ title, authors }, annotations, {
      by: tn("exportBy"),
      exported: tn("exportedOn"),
      page: (page) => tn("pageN", { page }),
      bookmark: tn("bookmark"),
    });
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileSlug(title)}-${tn("fileSuffix")}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ── Keyboard ───────────────────────────────────────────────────────
  const zoomBy = useCallback((dir: 1 | -1) => {
    setZoom((z) => {
      const i = ZOOMS.findIndex((v) => v >= z - 0.001);
      return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? 4 : i) + dir))];
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (document.querySelector("[role=dialog]")) return;
      switch (shortcutKey(e)) {
        case "ArrowRight":
          step(!docRtl);
          break;
        case "ArrowLeft":
          step(docRtl);
          break;
        case "/":
          setPanel("search");
          break;
        case "f":
          toggleFocus();
          break;
        case "t": {
          const i = themes.indexOf(theme as (typeof themes)[number]);
          setTheme(themes[(i + 1) % themes.length]);
          break;
        }
        case "c":
          setPanel((p) => (p === "toc" ? null : "toc"));
          break;
        case "n":
          setPanel((p) => (p === "notes" ? null : "notes"));
          break;
        case "b":
          toggleBookmark();
          break;
        case "m":
          switchMode(mode === "reading" ? "original" : "reading");
          break;
        case "+":
        case "=":
          if (mode === "reading") setPrefs({ size: Math.min(32, prefs.size + 1) });
          else zoomBy(1);
          break;
        case "-":
          if (mode === "reading") setPrefs({ size: Math.max(14, prefs.size - 1) });
          else zoomBy(-1);
          break;
        case "0":
          if (mode === "original") setZoom(1);
          break;
        case "?":
          setPanel("help");
          break;
        case "a":
          smart.toggle();
          break;
        case "Escape":
          if (smart.card) smart.setCard(null);
          else if (sel) clearSelection();
          else if (focus) toggleFocus();
          else return;
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [docRtl, step, toggleFocus, theme, setTheme, toggleBookmark, switchMode, mode, setPrefs, prefs.size, zoomBy, sel, focus, smart]);

  // ── Time left ──────────────────────────────────────────────────────
  const wpm = language === "ar" ? WPM.ar : WPM.en;
  const at = position ?? { pageIndex: initial?.page ?? 0, offset: initial?.offset ?? 0, percent: 0 };
  const timeLeft = useMemo(() => {
    if (!hasText || !numPages) return null;
    const words = pageWords?.length === numPages ? pageWords : null;
    const book = minutesLeft(words, at.pageIndex, at.offset, numPages, wpm);
    const end = chapterEnd(toc, at.pageIndex, numPages);
    const chapter = toc.length && end < numPages ? minutesLeft(words, at.pageIndex, at.offset, end, wpm) : null;
    return { book, chapter };
  }, [hasText, numPages, pageWords, at.pageIndex, at.offset, toc, wpm]);
  const fmt = (min: number) =>
    min < 1
      ? t("underMinute")
      : min < 60
        ? t("minutes", { count: Math.round(min) })
        : t("hours", { hours: Math.floor(min / 60), minutes: Math.round(min % 60) });

  const showChrome = chrome || panel !== null;
  const Back = uiRtl ? ArrowRight : ArrowLeft;
  const percent = position?.percent ?? 0;
  const side = uiRtl ? "left" : "right";
  const menuAnnotation = menu && (annotations.find((a) => a.id === menu.annotation.id) ?? menu.annotation);

  return (
    <div className="min-h-dvh">
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b bg-background/90 backdrop-blur-md transition-transform duration-300",
          !showChrome && "-translate-y-full",
        )}
        onFocusCapture={() => setChrome(true)}
        onPointerEnter={() => (overToolbar.current = true)}
        onPointerLeave={() => (overToolbar.current = false)}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-0.5 px-1.5 sm:gap-1 sm:px-4">
          <IconButton label={t("back")} asChild>
            <Link href="/library">
              <Back aria-hidden />
            </Link>
          </IconButton>
          <IconButton label={`${t("contents")} (C)`} onClick={() => setPanel("toc")}>
            <ListTree aria-hidden />
          </IconButton>
          <h1 dir="auto" className="min-w-0 flex-1 truncate px-1 text-sm font-medium sm:text-center">
            {title}
          </h1>
          <IconButton label={`${t("search")} (/)`} onClick={() => setPanel(panel === "search" ? null : "search")}>
            <Search aria-hidden />
          </IconButton>
          <IconButton label={`${tn("title")} (N)`} onClick={() => setPanel("notes")}>
            <NotebookTabs aria-hidden />
          </IconButton>
          <IconButton
            label={`${bookmark ? tn("removeBookmark") : tn("addBookmark")} (B)`}
            onClick={toggleBookmark}
            aria-pressed={!!bookmark}
          >
            <Bookmark aria-hidden className={cn(bookmark && "fill-current text-brand")} />
          </IconButton>
          {smart.available && (
            <AssistMenu
              settings={smart.settings}
              onSettings={smart.setSettings}
              docEnabled={smart.docEnabled}
              onDocEnabled={smart.setDocEnabled}
              status={hasText ? smart.status : "no-text"}
              analyzing={smart.analyzing}
              demo={smart.demo}
              english={language !== "ar"}
            />
          )}
          {fileUrl && <ModeSwitch mode={mode} hasText={hasText} onChange={switchMode} />}
          <ReaderSettings mode={mode} prefs={prefs} onPrefs={setPrefs} zoom={zoom} onZoom={setZoom} />
        </div>
        {mode === "reading" && textStatus === "garbled" && (
          <div className="border-t bg-muted/60 px-4 py-2 text-center text-xs text-muted-foreground">
            {t("garbledNote")}{" "}
            <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => switchMode("original")}>
              {t("showOriginal")}
            </button>
          </div>
        )}
      </header>

      {mode === "reading" ? (
        <ReflowView
          key="reading"
          ref={view}
          docId={docId}
          pageCount={numPages}
          prefs={prefs}
          lang={language}
          direction={direction}
          initial={startAt}
          onPosition={onPosition}
          onRendered={onRendered}
        />
      ) : (
        <PdfView
          key="original"
          ref={view}
          docId={docId}
          fileUrl={fileUrl!}
          fileSize={props.fileSize}
          pageCount={pageCount}
          zoom={zoom}
          hasText={hasText}
          initial={startAt}
          onPosition={onPosition}
          onRendered={onRendered}
        />
      )}

      {/* Page, time left and progress along the bottom. */}
      <footer
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur-md transition-transform duration-300",
          !showChrome && "translate-y-full",
        )}
      >
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-3 px-3 text-xs text-muted-foreground sm:px-5">
          {numPages > 0 && <PageField current={current} total={numPages} onGo={(p) => view.current?.goTo(p)} />}
          {timeLeft && (
            <span className="truncate">
              {timeLeft.chapter !== null && (
                <span>{t("leftInChapter", { time: fmt(timeLeft.chapter) })}</span>
              )}
              <span className={cn(timeLeft.chapter !== null && "hidden sm:inline")}>
                {timeLeft.chapter !== null && " · "}
                {t("leftInBook", { time: fmt(timeLeft.book) })}
              </span>
            </span>
          )}
          <span className="ms-auto tabular-nums">{Math.round(percent * 100)}%</span>
        </div>
      </footer>
      <div className="fixed inset-x-0 bottom-0 z-30 h-0.5" aria-hidden>
        <div className="h-full bg-brand/70 transition-[width] duration-300" style={{ width: `${percent * 100}%` }} />
      </div>

      {sel && !menu && (
        <Floating anchor={() => sel.dom.getBoundingClientRect()} preferBelow={matchMedia("(pointer: coarse)").matches}>
          <AnnotationActions
            onColor={(c) => highlight(c)}
            onNote={() => highlight("yellow", true)}
            onExplain={
              smart.available && smart.docEnabled && hasText
                ? () => {
                    const range = sel.range;
                    smart.explainSelection(range, quoteOf(range).quote, () => rectOf(range));
                    clearSelection();
                  }
                : undefined
            }
            onCopy={() => {
              copy(quoteOf(sel.range).quote);
              clearSelection();
            }}
          />
        </Floating>
      )}
      {menuAnnotation && (
        <Floating
          anchor={() => rectOf(rangeOf(menuAnnotation))}
          onDismiss={() => setMenu(null)}
          className={menu.mode === "note" ? "p-0" : undefined}
        >
          {menu.mode === "note" ? (
            <NoteEditor
              quote={menuAnnotation.quote}
              initial={menuAnnotation.note ?? ""}
              onSave={(note) => {
                update({ id: menuAnnotation.id, note });
                setMenu(null);
              }}
              onCancel={() => setMenu(null)}
            />
          ) : (
            <AnnotationActions
              current={menuAnnotation.color}
              onColor={(color) => {
                update({ id: menuAnnotation.id, color });
                setMenu(null);
              }}
              onNote={() => setMenu({ mode: "note", annotation: menuAnnotation })}
              onCopy={() => {
                copy(menuAnnotation.quote ?? "");
                setMenu(null);
              }}
              onDelete={() => {
                remove(menuAnnotation, tn("highlightDeleted"));
                setMenu(null);
              }}
            />
          )}
        </Floating>
      )}

      {smart.card && (
        <Floating
          anchor={smart.card.anchor}
          onDismiss={smart.card.pinned ? () => smart.setCard(null) : undefined}
          className="p-0"
        >
          <div data-assist-card>
            <AssistCard
              key={JSON.stringify(smart.card.target).slice(0, 200)}
              docId={docId}
              target={smart.card.target}
              explainLang={smart.settings.explainLang}
              demo={smart.demo}
              actions={smart.actions}
            />
          </div>
        </Floating>
      )}
      <AnimatePresence>
        {smart.active && smart.settings.level === null && language !== "ar" && !levelLater && smart.status === "ok" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <LevelPrompt onPick={(level) => smart.setSettings({ level })} onLater={() => setLevelLater(true)} />
          </motion.div>
        )}
        {smart.active && (smart.status === "paused" || smart.status === "limit") && !pauseSeen && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed inset-x-3 bottom-14 z-30 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg"
          >
            <span>{smart.status === "paused" ? t("assistPaused") : t("assistLimit")}</span>
            <button type="button" onClick={() => setPauseSeen(true)} aria-label={t("dismiss")} className="text-muted-foreground hover:text-foreground">
              <X aria-hidden className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {panel === "search" && (
        <SearchPanel
          docId={docId}
          enabled={hasText}
          query={query}
          onQuery={setQuery}
          active={hitIndex}
          onActive={(i, h) => {
            setHitIndex(i);
            view.current?.goTo(h.page, { start: h.start });
          }}
          onHits={onHits}
          onClose={closeSearch}
        />
      )}
      <TocPanel
        open={panel === "toc"}
        onOpenChange={(o) => setPanel(o ? "toc" : null)}
        toc={toc}
        currentPage={current}
        side={uiRtl ? "right" : "left"}
        onSelect={(page) => {
          setPanel(null);
          view.current?.goTo(page);
        }}
      />
      <NotesPanel
        open={panel === "notes"}
        onOpenChange={(o) => setPanel(o ? "notes" : null)}
        side={side}
        annotations={annotations}
        onSelect={(a) => {
          setPanel(null);
          view.current?.goTo(a.pageIndex, a.start !== null ? { start: a.start } : undefined);
        }}
        onSaveNote={(a, note) => update({ id: a.id, note })}
        onDelete={(a) => remove(a, a.kind === "bookmark" ? tn("bookmarkRemoved") : tn("highlightDeleted"))}
        onExport={exportNotes}
      />
      <ShortcutsDialog open={panel === "help"} onOpenChange={(o) => setPanel(o ? "help" : null)} />

      {focus && !showChrome && (
        <button
          type="button"
          onClick={toggleFocus}
          className="fixed end-3 top-3 z-40 rounded-full border bg-background/80 p-2 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100"
          aria-label={t("exitFocus")}
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

function ModeSwitch({
  mode,
  hasText,
  onChange,
}: {
  mode: ReaderPrefs["mode"];
  hasText: boolean;
  onChange: (m: ReaderPrefs["mode"]) => void;
}) {
  const t = useTranslations("reader");
  const reading = (
    <ToggleGroupItem value="reading" aria-label={`${t("readingMode")} (M)`} disabled={!hasText} className="gap-1.5 px-2.5">
      <BookOpenText aria-hidden />
      <span className="hidden lg:inline">{t("readingMode")}</span>
    </ToggleGroupItem>
  );
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={mode}
      onValueChange={(v) => v && onChange(v as ReaderPrefs["mode"])}
      className="mx-0.5"
    >
      <ToggleGroupItem value="original" aria-label={`${t("originalMode")} (M)`} className="gap-1.5 px-2.5">
        <FileText aria-hidden />
        <span className="hidden lg:inline">{t("originalMode")}</span>
      </ToggleGroupItem>
      {hasText ? (
        reading
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>{reading}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-56 text-center">{t("readingNeedsText")}</TooltipContent>
        </Tooltip>
      )}
    </ToggleGroup>
  );
}

function IconButton({ label, children, ...props }: { label: string } & React.ComponentProps<typeof Button>) {
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
      className="flex shrink-0 items-center gap-1.5 tabular-nums"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number.parseInt(draft ?? "", 10);
        if (Number.isFinite(n)) onGo(Math.min(Math.max(1, n), total) - 1);
        setDraft(null);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <span className="hidden sm:inline">{t("page")}</span>
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
        className="h-7 rounded-md border bg-background text-center text-foreground"
        style={{ width: `${Math.max(3, String(total).length + 1.5)}ch` }}
      />
      <span className="whitespace-nowrap">{t("pageOf", { total })}</span>
    </form>
  );
}
