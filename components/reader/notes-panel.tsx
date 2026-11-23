"use client";

import { Bookmark, Download, Highlighter, MoreHorizontal, NotebookPen, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Annotation } from "@/lib/reader/annotations";
import { cn } from "@/lib/utils";
import { NoteEditor, swatchClass } from "./annotation-menu";

type Filter = "all" | "highlight" | "note" | "bookmark";

export function NotesPanel({
  open,
  onOpenChange,
  side,
  annotations,
  onSelect,
  onSaveNote,
  onDelete,
  onExport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "left" | "right";
  annotations: Annotation[];
  onSelect: (a: Annotation) => void;
  onSaveNote: (a: Annotation, note: string) => void;
  onDelete: (a: Annotation) => void;
  onExport: () => void;
}) {
  const t = useTranslations("notes");
  const format = useFormatter();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const shown = filter === "all" ? annotations : annotations.filter((a) => a.kind === filter);
  const counts = {
    highlight: annotations.filter((a) => a.kind === "highlight").length,
    note: annotations.filter((a) => a.kind === "note").length,
    bookmark: annotations.filter((a) => a.kind === "bookmark").length,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="w-[min(24rem,92vw)] gap-0 p-0 sm:max-w-none">
        <SheetHeader className="gap-3 border-b pe-12">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>{t("title")}</SheetTitle>
            <Button variant="ghost" size="sm" onClick={onExport} disabled={!annotations.length}>
              <Download aria-hidden />
              {t("export")}
            </Button>
          </div>
          <SheetDescription className="sr-only">{t("description")}</SheetDescription>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={filter}
            onValueChange={(v) => v && setFilter(v as Filter)}
            className="w-full"
          >
            <ToggleGroupItem value="all" className="flex-1">
              {t("all")}
            </ToggleGroupItem>
            <ToggleGroupItem value="highlight" className="flex-1" aria-label={t("highlights")}>
              <Highlighter aria-hidden />
              <span className="tabular-nums">{counts.highlight}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="note" className="flex-1" aria-label={t("notesFilter")}>
              <NotebookPen aria-hidden />
              <span className="tabular-nums">{counts.note}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="bookmark" className="flex-1" aria-label={t("bookmarks")}>
              <Bookmark aria-hidden />
              <span className="tabular-nums">{counts.bookmark}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-8 py-16 text-center">
              <Highlighter aria-hidden className="size-6 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">{t(filter === "bookmark" ? "emptyBookmarks" : "empty")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {shown.map((a) => (
                <li key={a.id} className="group relative">
                  {editing === a.id ? (
                    <NoteEditor
                      quote={a.quote}
                      initial={a.note ?? ""}
                      onSave={(note) => {
                        onSaveNote(a, note);
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelect(a)}
                        className="flex w-full gap-3 px-4 py-3 text-start transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
                      >
                        {a.kind === "bookmark" ? (
                          <Bookmark aria-hidden className="mt-0.5 size-4 shrink-0 fill-current text-brand" />
                        ) : (
                          <span aria-hidden className={cn("mt-1 w-1 shrink-0 self-stretch rounded-full", swatchClass(a.color))} />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5 pe-6">
                          {a.kind === "bookmark" ? (
                            <span className="text-sm font-medium">{t("bookmarkOnPage", { page: a.pageIndex + 1 })}</span>
                          ) : (
                            <span dir="auto" className="line-clamp-4 font-serif text-[0.95rem] leading-relaxed">
                              {a.quote}
                            </span>
                          )}
                          {a.note && (
                            <span dir="auto" className="rounded-md bg-muted px-2 py-1.5 text-sm whitespace-pre-wrap">
                              {a.note}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {t("pageAndDate", {
                              page: a.pageIndex + 1,
                              date: format.dateTime(new Date(a.createdAt), { dateStyle: "medium" }),
                            })}
                          </span>
                        </span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute end-2 top-2 size-8 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label={t("actions")}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {a.kind !== "bookmark" && (
                            <DropdownMenuItem onSelect={() => setEditing(a.id)}>
                              <NotebookPen aria-hidden />
                              {a.note ? t("editNote") : t("addNote")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(a)}>
                            <Trash2 aria-hidden />
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
