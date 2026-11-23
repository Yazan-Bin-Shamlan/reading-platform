"use client";

import { Check, Copy, NotebookPen, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { highlightColors, type HighlightColor } from "@/lib/reader/annotations";
import { TOP_INSET } from "@/lib/reader/scroll";
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef(anchor);
  useLayoutEffect(() => {
    anchorRef.current = anchor;
  });

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current();
      const box = el.current;
      if (!rect || !box) return;
      const { width, height } = box.getBoundingClientRect();
      const roomAbove = rect.top - TOP_INSET - MARGIN >= height;
      const roomBelow = window.innerHeight - rect.bottom - MARGIN >= height;
      const below = (preferBelow && roomBelow) || !roomAbove;
      const top = below ? rect.bottom + MARGIN : rect.top - height - MARGIN;
      const left = Math.min(
        Math.max(MARGIN, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - MARGIN,
      );
      setPos({ top: Math.max(MARGIN, top), left });
    };
    place();
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
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
        "fixed z-50 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg transition-opacity duration-150",
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

/** Colours, note, copy (and delete for an existing highlight). */
export function AnnotationActions({
  current,
  onColor,
  onNote,
  onCopy,
  onDelete,
}: {
  current?: HighlightColor | null;
  onColor: (c: HighlightColor) => void;
  onNote: () => void;
  onCopy: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("notes");
  return (
    <div className="flex items-center gap-0.5">
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
