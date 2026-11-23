import { getTranslations } from "next-intl/server";
import { ExploreView, type ExploreFilters } from "@/components/explore/explore-view";
import { PageHeader } from "@/components/shell/page-header";
import { shelves } from "@/lib/sources/explore";
import { sourceIds, type SourceId } from "@/lib/sources/types";

export async function generateMetadata({ params }: PageProps<"/[locale]/explore">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "explore" });
  return { title: t("title") };
}

export default async function ExplorePage({ searchParams }: PageProps<"/[locale]/explore">) {
  const t = await getTranslations("explore");
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const filters: ExploreFilters = {
    q: one(q.q).slice(0, 200),
    lang: one(q.lang) === "ar" || one(q.lang) === "en" ? (one(q.lang) as "ar" | "en") : "",
    type: one(q.type) === "book" || one(q.type) === "paper" ? (one(q.type) as "book" | "paper") : "",
    source: (sourceIds as readonly string[]).includes(one(q.source)) ? (one(q.source) as SourceId) : "",
  };
  // Shelves only on the Explore home; they're cached for a day.
  const searching = Boolean(filters.q || filters.lang || filters.type || filters.source);
  const rows = searching ? [] : await shelves();

  return (
    <>
      <PageHeader title={t("title")}>
        <p className="max-w-md text-sm text-muted-foreground">{t("subtitle")}</p>
      </PageHeader>
      <ExploreView filters={filters} shelves={rows} />
    </>
  );
}
