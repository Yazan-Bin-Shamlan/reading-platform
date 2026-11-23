import { Compass, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { Input } from "@/components/ui/input";

export async function generateMetadata({ params }: PageProps<"/[locale]/explore">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "explore" });
  return { title: t("title") };
}

export default async function ExplorePage() {
  const t = await getTranslations("explore");
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="relative max-w-2xl">
        <Search aria-hidden className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          disabled
          aria-label={t("searchPlaceholder")}
          placeholder={t("searchPlaceholder")}
          className="h-12 rounded-full ps-10 text-base"
        />
      </div>
      <EmptyState icon={Compass} title={t("soonTitle")} body={t("soonBody")} />
    </>
  );
}
