import { LibraryBig } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LibraryView } from "@/components/library/library-view";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { UploadButton } from "@/components/upload/upload-button";
import { getUser } from "@/lib/auth";
import { listLibrary } from "@/lib/library/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/library">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "library" });
  return { title: t("title") };
}

export default async function LibraryPage() {
  const t = await getTranslations();
  const user = await getUser();
  const docs = user ? await listLibrary(user.id) : [];

  return (
    <>
      <PageHeader title={t("library.title")}>
        {docs.length > 0 && <p className="text-sm text-muted-foreground">{t("library.count", { count: docs.length })}</p>}
      </PageHeader>
      {docs.length ? (
        <LibraryView docs={docs} />
      ) : (
        <EmptyState icon={LibraryBig} title={t("library.emptyTitle")} body={t("library.emptyBody")}>
          <UploadButton size="lg">{t("home.uploadCta")}</UploadButton>
        </EmptyState>
      )}
    </>
  );
}
