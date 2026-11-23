import { BookMarked } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export async function generateMetadata({ params }: PageProps<"/[locale]/words">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "words" });
  return { title: t("title") };
}

export default async function WordsPage() {
  const t = await getTranslations("words");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={BookMarked} title={t("emptyTitle")} body={t("emptyBody")} />
    </>
  );
}
