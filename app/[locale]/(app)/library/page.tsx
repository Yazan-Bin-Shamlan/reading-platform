import { LibraryBig } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export async function generateMetadata({ params }: PageProps<"/[locale]/library">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "library" });
  return { title: t("title") };
}

export default async function LibraryPage() {
  const t = await getTranslations("library");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={LibraryBig} title={t("emptyTitle")} body={t("emptyBody")} />
    </>
  );
}
