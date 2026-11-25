"use client";

import { ArrowDownUp, Check, LayoutGrid, List, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link, useRouter } from "@/i18n/navigation";
import type { LibraryDoc } from "@/lib/library/queries";
import { itemTypes, type ItemType } from "@/lib/library/schemas";
import { cn, joinNames } from "@/lib/utils";
import { BookCover } from "./book-cover";
import { ReadingProgress } from "./progress-label";
import { patchDocument } from "./type-select";

type Sort = "opened" | "added" | "title" | "progress";
type Prefs = { view: "grid" | "list"; sort: Sort; type: ItemType | "all"; lang: "ar" | "en" | "all" };
const DEFAULT: Prefs = { view: "grid", sort: "opened", type: "all", lang: "all" };
const KEY = "library-view";

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore after hydration
      if (saved) setPrefs({ ...DEFAULT, ...JSON.parse(saved) });
    } catch {}
  }, []);
  const update = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  return [prefs, update] as const;
}

const time = (s: string | null) => (s ? Date.parse(s) : 0);

export function LibraryView({ docs }: { docs: LibraryDoc[] }) {
  const t = useTranslations("library");
  const tt = useTranslations("types");
  const tl = useTranslations("languages");
  const [prefs, setPrefs] = usePrefs();

  const shown = useMemo(() => {
    const list = docs.filter(
      (d) => (prefs.type === "all" || d.type === prefs.type) && (prefs.lang === "all" || d.language === prefs.lang),
    );
    const by: Record<Sort, (a: LibraryDoc, b: LibraryDoc) => number> = {
      opened: (a, b) => time(b.lastOpenedAt) - time(a.lastOpenedAt) || time(b.createdAt) - time(a.createdAt),
      added: (a, b) => time(b.createdAt) - time(a.createdAt),
      title: (a, b) => a.title.localeCompare(b.title),
      progress: (a, b) => b.percent - a.percent,
    };
    return list.sort(by[prefs.sort]);
  }, [docs, prefs]);

  const types = itemTypes.filter((ty) => docs.some((d) => d.type === ty));
  const langs = (["ar", "en"] as const).filter((l) => docs.some((d) => d.language === l));
  const sortLabels: Record<Sort, string> = {
    opened: t("sortOpened"),
    added: t("sortAdded"),
    title: t("sortTitle"),
    progress: t("sortProgress"),
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={tt("all")}>
          <Chip active={prefs.type === "all"} onClick={() => setPrefs({ type: "all" })}>
            {tt("all")}
          </Chip>
          {types.map((ty) => (
            <Chip key={ty} active={prefs.type === ty} onClick={() => setPrefs({ type: ty })}>
              {tt(ty)}
            </Chip>
          ))}
          {langs.length > 1 &&
            langs.map((l) => (
              <Chip key={l} active={prefs.lang === l} onClick={() => setPrefs({ lang: prefs.lang === l ? "all" : l })}>
                {tl(l)}
              </Chip>
            ))}
        </div>
        <div className="ms-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <ArrowDownUp aria-hidden />
                <span className="hidden sm:inline">{sortLabels[prefs.sort]}</span>
                <span className="sr-only sm:hidden">{t("sort")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("sort")}</DropdownMenuLabel>
              {(Object.keys(sortLabels) as Sort[]).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => setPrefs({ sort: s })}>
                  <span className="flex-1">{sortLabels[s]}</span>
                  {prefs.sort === s && <Check aria-hidden className="text-brand" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ToggleGroup
            type="single"
            size="sm"
            value={prefs.view}
            onValueChange={(v) => v && setPrefs({ view: v as Prefs["view"] })}
          >
            <ToggleGroupItem value="grid" aria-label={t("grid")}>
              <LayoutGrid aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label={t("list")}>
              <List aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p>{t("noMatches")}</p>
          <Button variant="link" onClick={() => setPrefs({ type: "all", lang: "all" })}>
            {t("clearFilters")}
          </Button>
        </div>
      ) : prefs.view === "grid" ? (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shown.map((d) => (
            <li key={d.id} className="group relative">
              <Link href={`/read/${d.id}`} className="block rounded-lg">
                <BookCover
                  title={d.title}
                  coverUrl={d.coverUrl}
                  backupUrl={d.backupCoverUrl}
                  className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md"
                />
                <p className="mt-3 line-clamp-2 text-sm leading-snug font-medium">
                  <bdi>{d.title}</bdi>
                </p>
                {d.authors[0] && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <bdi>{joinNames(d.authors)}</bdi>
                  </p>
                )}
                <div className="mt-2">
                  <ReadingProgress percent={d.percent} />
                </div>
              </Link>
              <DocMenu doc={d} className="absolute end-1.5 top-1.5" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {shown.map((d) => (
            <li key={d.id} className="relative flex items-center gap-4 p-3 pe-12">
              <Link href={`/read/${d.id}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-md">
                <BookCover title={d.title} coverUrl={d.coverUrl} backupUrl={d.backupCoverUrl} className="w-12 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    <bdi>{d.title}</bdi>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {tt(d.type)}
                    {d.pageCount ? ` · ${t("pages", { count: d.pageCount })}` : ""}
                    {d.authors[0] ? ` · ${joinNames(d.authors)}` : ""}
                  </p>
                  <div className="mt-2 max-w-xs">
                    <ReadingProgress percent={d.percent} />
                  </div>
                </div>
              </Link>
              <DocMenu doc={d} className="absolute end-2 top-1/2 -translate-y-1/2" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-transparent bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function DocMenu({ doc, className }: { doc: LibraryDoc; className?: string }) {
  const t = useTranslations("library");
  const tt = useTranslations("types");
  const tu = useTranslations("upload");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast.success(done);
      router.refresh();
    } catch {
      toast.error(tu("errors.generic"));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={t("options", { title: doc.title })}
            className={cn("opacity-90 shadow-sm md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100", className)}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel>{t("changeType")}</DropdownMenuLabel>
          {itemTypes.map((ty) => (
            <DropdownMenuItem key={ty} onSelect={() => act(() => patchDocument(doc.id, { type: ty }))}>
              <span className="flex-1">{tt(ty)}</span>
              {doc.type === ty && <Check aria-hidden className="text-brand" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            {t("remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTitle", { title: doc.title })}</AlertDialogTitle>
            <AlertDialogDescription>
              {doc.annotations > 0 ? t("removeBodyNotes", { count: doc.annotations }) : t("removeBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                act(async () => {
                  const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
                  if (!res.ok) throw new Error();
                }, t("removed"))
              }
            >
              {t("removeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
