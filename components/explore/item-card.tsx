import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { BookCover } from "@/components/library/book-cover";
import { Link } from "@/i18n/navigation";
import { backupCoverUrl } from "@/lib/sources/covers";
import { licenseLabel } from "@/lib/sources/license";
import type { CatalogRecord } from "@/lib/sources/types";
import { cn, joinNames } from "@/lib/utils";

export type ExploreItem = CatalogRecord & { docId?: string | null };

export const itemHref = (r: Pick<CatalogRecord, "source" | "sourceId">) =>
  `/explore/${r.source}/${r.sourceId.split("/").map(encodeURIComponent).join("/")}`;

/** A small source + license line: "arXiv · CC BY 4.0". */
export function SourceLine({ item, className }: { item: CatalogRecord; className?: string }) {
  const t = useTranslations("explore");
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground", className)}>
      <span>{t(`sources.${item.source}`)}</span>
      <span aria-hidden>·</span>
      <span className="rounded border px-1 py-px text-[0.65rem] tracking-wide">
        {item.license === "public-domain" ? t("publicDomain") : licenseLabel(item.license, item.licenseUrl)}
      </span>
    </p>
  );
}

export function ItemCard({ item, layout = "grid" }: { item: ExploreItem; layout?: "grid" | "shelf" }) {
  const t = useTranslations("explore");
  const meta = [joinNames(item.authors.slice(0, 2)), item.year].filter(Boolean).join(" · ");
  return (
    <Link
      href={itemHref(item)}
      className={cn(
        "group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
        layout === "shelf" && "w-36 shrink-0 sm:w-40",
      )}
    >
      <div className="relative">
        <BookCover title={item.title} coverUrl={item.coverUrl} backupUrl={backupCoverUrl(item)} className="transition-transform group-hover:-translate-y-0.5" />
        {item.docId && (
          <span className="absolute end-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[0.7rem] font-medium shadow-sm">
            <Check aria-hidden className="size-3 text-brand" />
            {t("inLibrary")}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-sm leading-snug font-medium">
          <bdi>{item.title}</bdi>
        </p>
        {meta && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            <bdi>{meta}</bdi>
          </p>
        )}
        <SourceLine item={item} />
      </div>
    </Link>
  );
}

export function Shelf({ title, items }: { title: string; items: ExploreItem[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {items.map((item) => (
          <div key={`${item.source}:${item.sourceId}`} className="snap-start">
            <ItemCard item={item} layout="shelf" />
          </div>
        ))}
      </div>
    </section>
  );
}
