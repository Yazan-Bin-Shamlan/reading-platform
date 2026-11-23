"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { SourceStatus } from "@/lib/sources/explore";
import { sourceIds, type SourceId } from "@/lib/sources/types";
import { ItemCard, Shelf, type ExploreItem } from "./item-card";

export type ExploreFilters = { q: string; lang: "" | "ar" | "en"; type: "" | "book" | "paper"; source: "" | SourceId };

type Page = { items: ExploreItem[]; status: SourceStatus[]; more: boolean };

// The Hindawi Foundation's books aren't fetched or listed here (its terms
// couldn't be confirmed to allow it), so people are pointed to its own site,
// Safahat, where hindawi.org now redirects.
const HINDAWI_URL = "https://www.safahat.org/books/";

function HindawiCard() {
  const t = useTranslations("explore.hindawi");
  return (
    <a
      href={HINDAWI_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex max-w-2xl items-center gap-4 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="font-serif text-lg font-semibold">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand group-hover:underline">
        {t("action")}
        <ArrowUpRight aria-hidden className="size-4 rtl:-scale-x-100" />
      </span>
    </a>
  );
}

export function ExploreView({ filters, shelves }: { filters: ExploreFilters; shelves: { id: string; items: ExploreItem[] }[] }) {
  const t = useTranslations("explore");
  const router = useRouter();
  const pathname = usePathname();
  const uiAr = useLocale() === "ar";
  const [draft, setDraft] = useState(filters.q);
  const searching = Boolean(filters.q || filters.lang || filters.type || filters.source);
  const arabicBooks = filters.lang !== "en" && filters.type !== "paper" && !filters.source;

  const go = (next: Partial<ExploreFilters>) => {
    const f = { ...filters, ...next };
    const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  const results = useInfiniteQuery({
    queryKey: ["explore", filters],
    enabled: searching,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam) });
      if (filters.q) params.set("q", filters.q);
      if (filters.lang) params.set("lang", filters.lang);
      if (filters.type) params.set("type", filters.type);
      if (filters.source) params.set("source", filters.source);
      const res = await fetch(`/api/explore/search?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Page;
    },
    getNextPageParam: (last, all) => (last.more ? all.length + 1 : undefined),
    staleTime: 5 * 60_000,
  });

  const items = results.data?.pages.flatMap((p) => p.items) ?? [];
  const down = (results.data?.pages[0]?.status ?? []).filter((s) => !s.ok).map((s) => t(`sources.${s.source}`));

  return (
    <div className="flex flex-col gap-6">
      <form
        role="search"
        className="relative max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: draft.trim() });
        }}
      >
        <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          dir="auto"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-12 w-full rounded-full border bg-background ps-11 pe-12 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
        />
        {draft && (
          <button
            type="button"
            aria-label={t("clear")}
            onClick={() => {
              setDraft("");
              go({ q: "" });
            }}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={filters.lang || "all"} onValueChange={(v) => v && go({ lang: v === "all" ? "" : (v as "ar" | "en") })}>
          <ToggleGroupItem value="all">{t("allLanguages")}</ToggleGroupItem>
          <ToggleGroupItem value="ar">{t("arabic")}</ToggleGroupItem>
          <ToggleGroupItem value="en">{t("english")}</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" variant="outline" size="sm" value={filters.type || "all"} onValueChange={(v) => v && go({ type: v === "all" ? "" : (v as "book" | "paper") })}>
          <ToggleGroupItem value="all">{t("allTypes")}</ToggleGroupItem>
          <ToggleGroupItem value="book">{t("books")}</ToggleGroupItem>
          <ToggleGroupItem value="paper">{t("papers")}</ToggleGroupItem>
        </ToggleGroup>
        <select
          value={filters.source}
          onChange={(e) => go({ source: e.target.value as ExploreFilters["source"] })}
          aria-label={t("source")}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">{t("allSources")}</option>
          {sourceIds.map((s) => (
            <option key={s} value={s}>
              {t(`sources.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {!searching ? (
        <div className="flex flex-col gap-10">
          {(uiAr ? shelves : [...shelves].sort((a, b) => Number(a.id.startsWith("arabic")) - Number(b.id.startsWith("arabic")))).map((s) => (
            <Shelf key={s.id} title={t(`shelves.${s.id}`)} items={s.items} />
          ))}
          {shelves.length === 0 && <p className="text-muted-foreground">{t("shelvesUnavailable")}</p>}
          <HindawiCard />
        </div>
      ) : results.isLoading ? (
        <div role="status" className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <span className="sr-only">{t("searching")}</span>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : results.isError ? (
        <p className="text-muted-foreground">{t("error")}</p>
      ) : (
        <>
          {down.length > 0 && <p className="text-sm text-muted-foreground">{t("sourcesDown", { sources: down.join(uiAr ? "، " : ", ") })}</p>}
          {items.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">{t("noResults")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((item) => (
                <ItemCard key={`${item.source}:${item.sourceId}`} item={item} />
              ))}
            </div>
          )}
          {results.hasNextPage && (
            <Button variant="outline" className="self-center" onClick={() => results.fetchNextPage()} disabled={results.isFetchingNextPage}>
              {results.isFetchingNextPage && <Loader2 aria-hidden className="animate-spin" />}
              {t("more")}
            </Button>
          )}
          {arabicBooks && !results.hasNextPage && <HindawiCard />}
        </>
      )}
    </div>
  );
}
