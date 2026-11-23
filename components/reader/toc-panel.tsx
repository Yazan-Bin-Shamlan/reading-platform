"use client";

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { TocEntry } from "@/lib/library/schemas";
import { cn } from "@/lib/utils";

/** The entry the reader is currently inside: the last one starting at or before the page. */
function currentEntry(toc: TocEntry[], page: number): TocEntry | null {
  let found: TocEntry | null = null;
  const walk = (list: TocEntry[]) => {
    for (const e of list) {
      if (e.page <= page) found = e;
      if (e.children) walk(e.children);
    }
  };
  walk(toc);
  return found;
}

export function TocPanel({
  open,
  onOpenChange,
  toc,
  currentPage,
  side,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toc: TocEntry[];
  currentPage: number;
  side: "left" | "right";
  onSelect: (page: number) => void;
}) {
  const t = useTranslations("reader");
  const active = currentEntry(toc, currentPage);

  const render = (list: TocEntry[], depth: number) => (
    <ul className={cn(depth > 0 && "ms-3 border-s ps-2")}>
      {list.map((e, i) => (
        <li key={`${e.page}-${i}`}>
          <button
            type="button"
            onClick={() => onSelect(e.page)}
            aria-current={e === active ? "location" : undefined}
            className={cn(
              "flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent",
              e === active ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
              depth === 0 && "text-foreground",
            )}
          >
            <span dir="auto" className="flex-1 leading-snug">
              {e.title}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{e.page + 1}</span>
          </button>
          {e.children && render(e.children, depth + 1)}
        </li>
      ))}
    </ul>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="w-[min(22rem,88vw)] gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{t("contents")}</SheetTitle>
          <SheetDescription className="sr-only">{t("contents")}</SheetDescription>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-2">
          {toc.length ? render(toc, 0) : <p className="p-4 text-sm text-muted-foreground">{t("noContents")}</p>}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
