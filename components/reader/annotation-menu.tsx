"use client";

import { Check, Copy, Loader2, NotebookPen, Sparkles, Square, Trash2, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { highlightColors, type HighlightColor } from "@/lib/reader/annotations";
import { TOP_INSET } from "@/lib/reader/scroll";
import { canSpeak, speak, stopSpeaking, useSpeaking, useSpeechLoading } from "@/lib/speech";
import { cn } from "@/lib/utils";

const MARGIN = 8;

/**
 * A small panel placed next to a piece of text: above it when there's room,
 * otherwise below. Touch devices put it below, clear of the system's own menu.
 */
export function Floating({
  anchor,
  preferBelow = false,
  onDismiss,
  className,
  children,
}: {
  /** Where the text is; read again on scroll so the panel follows it. */
  anchor: () => DOMRect | null;
  preferBelow?: boolean;
  onDismiss?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const anchorRef = useRef(anchor);
  useLayoutEffect(() => {
    anchorRef.current = anchor;
  });

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current();
      const box = el.current;
      if (!rect || !box) return;
      const { width } = box.getBoundingClientRect();
      // Natural height, ignoring any cap applied last time.
      const height = box.scrollHeight;
      const spaceAbove = rect.top - TOP_INSET - MARGIN * 2;
      const spaceBelow = window.innerHeight - rect.bottom - MARGIN * 2;
      // Never cover the text itself: go where it fits (or where there's more room) and scroll inside if needed.
      const below = preferBelow ? spaceBelow >= height || spaceBelow >= spaceAbove : spaceAbove < height && spaceBelow > spaceAbove;
      const maxHeight = Math.max(120, below ? spaceBelow : spaceAbove);
      const shown = Math.min(height, maxHeight);
      const top = below ? rect.bottom + MARGIN : rect.top - shown - MARGIN;
      const left = Math.min(
        Math.max(MARGIN, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - MARGIN,
      );
      // A selection taller than the screen leaves no room either side: keep the panel on screen anyway.
      const lowest = window.innerHeight - shown - MARGIN;
      setPos({ top: Math.max(MARGIN, Math.min(top, lowest)), left, maxHeight });
    };
    place();
    // Content that loads in (a card's details) changes the size: place it again.
    const ro = new ResizeObserver(place);
    if (el.current?.firstElementChild) ro.observe(el.current.firstElementChild);
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [preferBelow, children]);

  useEffect(() => {
    if (!onDismiss) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    const onDown = (e: PointerEvent) => !el.current?.contains(e.target as Node) && onDismiss();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onDismiss]);

  return (
    <div
      ref={el}
      role="toolbar"
      className={cn(
        "fixed z-50 overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg transition-opacity duration-150",
        !pos && "opacity-0",
        className,
      )}
      style={pos ?? { top: 0, left: 0 }}
      // Keep the text selection while clicking the menu.
      onPointerDown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()}
    >
      {children}
    </div>
  );
}

const swatch: Record<HighlightColor, string> = {
  yellow: "bg-[rgb(250_204_21)]",
  green: "bg-[rgb(74_222_128)]",
  blue: "bg-[rgb(96_165_250)]",
  pink: "bg-[rgb(244_114_182)]",
  purple: "bg-[rgb(167_139_250)]",
};
export const swatchClass = (c: HighlightColor | null) => swatch[c ?? "yellow"];

function MenuButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Colours, note, listen, copy (and delete for an existing highlight). */
export function AnnotationActions({
  current,
  onColor,
  onNote,
  onCopy,
  onDelete,
  onExplain,
  listen,
}: {
  current?: HighlightColor | null;
  onColor: (c: HighlightColor) => void;
  onNote: () => void;
  onCopy: () => void;
  onDelete?: () => void;
  /** Smart Assist: explain the selected word or passage. */
  onExplain?: () => void;
  /** Read the text aloud; `key` names it, so the button turns into Stop while it plays. */
  listen?: { key: string; text: () => string };
}) {
  const t = useTranslations("notes");
  const speaking = useSpeaking();
  const playing = listen && speaking === listen.key;
  const preparing = useSpeechLoading(listen?.key ?? "");
  return (
    <div className="flex items-center gap-0.5">
      {onExplain && (
        <>
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5 text-brand" onClick={onExplain}>
            <Sparkles aria-hidden />
            {t("explain")}
          </Button>
          <div className="mx-0.5 h-6 w-px bg-border" />
        </>
      )}
      <div className="flex items-center gap-1 px-1.5">
        {highlightColors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={t("highlightIn", { color: t(`colors.${c}`) })}
            aria-pressed={current === c}
            onClick={() => onColor(c)}
            className={cn(
              "grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-popover transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              swatch[c],
            )}
          >
            {current === c && <Check aria-hidden className="size-3.5 text-black/70" />}
          </button>
        ))}
      </div>
      <div className="mx-0.5 h-6 w-px bg-border" />
      <MenuButton label={t("addNote")} onClick={onNote}>
        <NotebookPen aria-hidden />
      </MenuButton>
      {listen && canSpeak() && (
        <MenuButton
          label={preparing ? t("preparingVoice") : playing ? t("stopListening") : t("listen")}
          onClick={() => (playing ? stopSpeaking() : speak(listen.text(), { key: listen.key }))}
        >
          {preparing ? <Loader2 aria-hidden className="animate-spin" /> : playing ? <Square aria-hidden /> : <Volume2 aria-hidden />}
        </MenuButton>
      )}
      <MenuButton label={t("copy")} onClick={onCopy}>
        <Copy aria-hidden />
      </MenuButton>
      {onDelete && (
        <MenuButton label={t("deleteHighlight")} onClick={onDelete}>
          <Trash2 aria-hidden />
        </MenuButton>
      )}
    </div>
  );
}

/** Writing or editing the note on a highlight. ⌘/Ctrl+Enter saves. */
export function NoteEditor({
  quote,
  initial,
  onSave,
  onCancel,
}: {
  quote: string | null;
  initial: string;
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("notes");
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      {quote && (
        <blockquote dir="auto" className="line-clamp-3 border-s-2 ps-2 text-sm text-muted-foreground">
          {quote}
        </blockquote>
      )}
      <Textarea
        autoFocus
        dir="auto"
        value={value}
        placeholder={t("notePlaceholder")}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSave(value);
          }
          if (e.key === "Escape") onCancel();
        }}
        className="min-h-24 resize-none"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" size="sm">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
