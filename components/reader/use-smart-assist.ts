"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAssist } from "@/hooks/use-assist";
import { isEntity, type Term } from "@/lib/ai/schemas";
import { knownKey, visibleTerms, type AssistSettings } from "@/lib/assist/filter";
import { sentenceAround } from "@/lib/assist/locate";
import { paint } from "@/lib/reader/paint";
import type { CardTarget } from "./assist-card";
import type { ViewHandle } from "./types";

export type AssistInitial = {
  settings: AssistSettings;
  docEnabled: boolean;
  /** Keys (see knownKey) of words this reader knows, per language. */
  known: { ar: string[]; en: string[] };
  saved: { ar: string[]; en: string[] };
  /** "gemini", "demo", or null when Smart Assist isn't set up. */
  provider: string | null;
};

export type Card = { target: CardTarget; anchor: () => DOMRect | null; pinned: boolean };

const MARK_GROUPS = ["as-word", "as-person", "as-other"] as const;
const groupOf = (t: Term) =>
  t.kind === "person" ? "as-person" : isEntity(t.kind) || t.kind === "concept" ? "as-other" : "as-word";
const langOf = (text: string): "ar" | "en" => (/[؀-ۿ]/.test(text) ? "ar" : "en");
const HOVER_OPEN_MS = 250;
const HOVER_CLOSE_MS = 350;

/** Where the caret would go at a point. */
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

const unionRect = (rects: DOMRect[]) => {
  const r = rects.filter((x) => x.width || x.height);
  if (!r.length) return null;
  const left = Math.min(...r.map((x) => x.left));
  const top = Math.min(...r.map((x) => x.top));
  return new DOMRect(left, top, Math.max(...r.map((x) => x.right)) - left, Math.max(...r.map((x) => x.bottom)) - top);
};

/**
 * Smart Reading Assist in the reader: which terms to mark, painting them,
 * opening cards on hover/tap/selection, and the reader's settings and words.
 */
export function useSmartAssist({
  docId,
  getView,
  current,
  language,
  hasText,
  paintTick,
  initial,
}: {
  docId: string;
  /** The current view (Original or Reading); a getter so mode switches are picked up. */
  getView: () => ViewHandle | null;
  current: number;
  language: "ar" | "en" | null;
  hasText: boolean;
  paintTick: number;
  initial: AssistInitial;
}) {
  const t = useTranslations("assist");
  const qc = useQueryClient();

  // ── Settings (saved to the profile a moment after the last change) ──
  const [settings, setSettingsState] = useState(initial.settings);
  const unsaved = useRef<Partial<AssistSettings>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const setSettings = useCallback((s: Partial<AssistSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...s }));
    unsaved.current = { ...unsaved.current, ...s };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const body = unsaved.current;
      unsaved.current = {};
      void fetch("/api/assist/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    }, 600);
  }, []);

  const [docEnabled, setDocEnabledState] = useState(initial.docEnabled);
  const setDocEnabled = useCallback(
    (on: boolean) => {
      setDocEnabledState(on);
      void fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assistEnabled: on }),
      }).then(() => qc.invalidateQueries({ queryKey: ["assist", docId] }));
    },
    [docId, qc],
  );

  const toggle = useCallback(() => {
    const enabled = !settings.enabled;
    setSettings({ enabled });
    toast(enabled ? t("turnedOn") : t("turnedOff"));
  }, [settings.enabled, setSettings, t]);

  // ── Words the reader knows or saved ────────────────────────────────
  const [known, setKnown] = useState(() => new Set([...initial.known.ar, ...initial.known.en]));
  const [saved, setSaved] = useState(() => new Set([...initial.saved.ar, ...initial.saved.en]));

  // ── Marks ──────────────────────────────────────────────────────────
  const active = settings.enabled && docEnabled && hasText && initial.provider !== null;
  const assist = useAssist(docId, current, active);
  const docLang = language ?? "en";
  const visible = useMemo(() => {
    const out = new Map<number, Term[]>();
    for (const [page, terms] of assist.pages) out.set(page, visibleTerms(terms, settings, known, docLang));
    return out;
  }, [assist.pages, settings, known, docLang]);

  useEffect(() => {
    const v = getView();
    const groups = new Map<string, Range[]>(MARK_GROUPS.map((g) => [g, []]));
    if (v && active) {
      for (const [page, terms] of visible) {
        if (Math.abs(page - current) > 6) continue;
        for (const term of terms) groups.get(groupOf(term))!.push(...v.ranges(page, term.s, term.e));
      }
    }
    for (const [name, ranges] of groups) paint(name, ranges);
  }, [visible, active, current, paintTick, getView]);
  useEffect(() => () => MARK_GROUPS.forEach((g) => paint(g, [])), []);

  /** The marked term under a point, if the point is really on it. */
  const termAt = useCallback(
    (x: number, y: number): { term: Term; page: number } | null => {
      const v = getView();
      if (!v || !active) return null;
      const caret = caretAt(x, y);
      if (!caret || !v.root()?.contains(caret.node)) return null;
      const pos = v.locate(caret.node, caret.offset);
      const term = pos && visible.get(pos.page)?.find((t) => pos.offset >= t.s && pos.offset <= t.e);
      if (!pos || !term) return null;
      const inside = v
        .ranges(pos.page, term.s, term.e)
        .flatMap((r) => [...r.getClientRects()])
        .some((b) => x >= b.left - 1 && x <= b.right + 1 && y >= b.top - 1 && y <= b.bottom + 1);
      return inside ? { term, page: pos.page } : null;
    },
    [active, visible, getView],
  );

  // ── Cards ──────────────────────────────────────────────────────────
  const [card, setCard] = useState<Card | null>(null);
  const termCard = useCallback(
    (term: Term, page: number, pinned: boolean): Card => {
      const text = getView()?.pageText(page) ?? "";
      return {
        target: { mode: "term", term, page, sentence: sentenceAround(text, term.s, term.e) },
        anchor: () => unionRect(getView()?.ranges(page, term.s, term.e).flatMap((r) => [...r.getClientRects()]) ?? []),
        pinned,
      };
    },
    [getView],
  );
  const openTerm = useCallback(
    (term: Term, page: number) => setCard(termCard(term, page, true)),
    [termCard],
  );

  // Desktop: hovering a mark opens its card; leaving both closes it.
  const cardRef = useRef(card);
  useEffect(() => {
    cardRef.current = card;
  }, [card]);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let hovered: Term | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons) return;
      const { clientX: x, clientY: y } = e;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const open = cardRef.current;
        // Moving onto the card keeps it open.
        if (document.elementFromPoint(x, y)?.closest("[data-assist-card]")) {
          clearTimeout(closeTimer);
          return;
        }
        const hit = termAt(x, y);
        if (hit && hit.term !== hovered) {
          hovered = hit.term;
          clearTimeout(openTimer);
          clearTimeout(closeTimer);
          openTimer = setTimeout(() => setCard(termCard(hit.term, hit.page, false)), open ? 80 : HOVER_OPEN_MS);
        } else if (!hit) {
          hovered = null;
          clearTimeout(openTimer);
          if (open && !open.pinned) {
            clearTimeout(closeTimer);
            closeTimer = setTimeout(() => setCard((c) => (c && !c.pinned ? null : c)), HOVER_CLOSE_MS);
          }
        } else {
          clearTimeout(closeTimer);
        }
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
    };
  }, [active, termAt, termCard]);

  // ── Actions on a word ───────────────────────────────────────────────
  const know = useCallback(
    (term: Term) => {
      const lang = langOf(term.text);
      const key = knownKey(term);
      const body = JSON.stringify({ lang, lemma: key });
      setKnown((s) => new Set(s).add(key));
      setCard(null);
      void fetch("/api/words/known", { method: "POST", headers: { "content-type": "application/json" }, body });
      toast(t("knowDone", { word: term.lemma || term.text }), {
        action: {
          label: t("undo"),
          onClick: () => {
            setKnown((s) => {
              const next = new Set(s);
              next.delete(key);
              return next;
            });
            void fetch("/api/words/known", { method: "DELETE", headers: { "content-type": "application/json" }, body });
          },
        },
      });
    },
    [t],
  );

  const save = useCallback(
    (term: Term, page: number, sentence: string) => {
      const key = knownKey(term);
      setSaved((s) => new Set(s).add(key));
      void fetch("/api/words", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lang: langOf(term.text),
          lemma: key,
          surface: term.text,
          translation: term.translation || null,
          meaning: term.simple || term.simpleAr || null,
          sentence: sentence || term.text,
          documentId: docId,
          pageIndex: page,
          start: term.s,
          end: term.e,
        }),
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          toast(t("savedToast", { word: term.text }));
        })
        .catch(() => {
          setSaved((s) => {
            const next = new Set(s);
            next.delete(key);
            return next;
          });
          toast.error(t("saveFailed"));
        });
    },
    [docId, t],
  );

  const actions = useCallback(
    (term: Term, page: number, sentence: string) => ({
      saved: saved.has(knownKey(term)),
      onSave: () => save(term, page, sentence),
      onKnow: () => know(term),
    }),
    [saved, save, know],
  );

  /** "Explain" on a selection: a word card for a few words, a passage explanation for more. */
  const explainSelection = useCallback(
    (range: { page: number; start: number; endPage: number; end: number }, text: string, anchor: () => DOMRect | null) => {
      const words = text.trim().split(/\s+/).length;
      const pageText = getView()?.pageText(range.page) ?? text;
      const target: CardTarget =
        words <= 6 && text.length <= 60 && range.page === range.endPage
          ? { mode: "lookup", text: text.trim(), sentence: sentenceAround(pageText, range.start, range.end), page: range.page, s: range.start, e: range.end }
          : { mode: "paragraph", text: text.slice(0, 4000) };
      setCard({ target, anchor, pinned: true });
    },
    [getView],
  );

  return {
    settings,
    setSettings,
    docEnabled,
    setDocEnabled,
    toggle,
    active,
    status: assist.status,
    until: assist.until,
    analyzing: assist.analyzing,
    demo: (assist.provider ?? initial.provider) === "demo",
    available: initial.provider !== null,
    card,
    setCard,
    termAt,
    openTerm,
    actions,
    explainSelection,
  };
}
