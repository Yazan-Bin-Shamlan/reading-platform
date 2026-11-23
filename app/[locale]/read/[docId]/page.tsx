import { BookX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { Reader } from "@/components/reader/reader";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TocEntry } from "@/lib/library/schemas";
import { readPrefs } from "@/lib/reader/prefs";
import { listAnnotations } from "@/lib/reader/queries";
import { storage } from "@/lib/storage";
import { TEXT_VERSION } from "@/lib/text/extract";

const loadDoc = cache(async (docId: string, userId: string) =>
  db.document.findFirst({
    where: { id: docId, userId },
    include: { content: true, progress: true, user: { select: { preferences: true } } },
  }),
);

export async function generateMetadata({ params }: PageProps<"/[locale]/read/[docId]">) {
  const { docId } = await params;
  const user = await getUser();
  const doc = user ? await loadDoc(docId, user.id) : null;
  return { title: doc?.title };
}

export default async function ReadPage({ params }: PageProps<"/[locale]/read/[docId]">) {
  const { locale, docId } = await params;
  const user = await getUser();
  if (!user) redirect({ href: `/sign-in?next=/${locale}/read/${docId}`, locale });

  const doc = await loadDoc(docId, user!.id);
  const content = doc?.content;
  if (!doc || !content) {
    // Removed, or someone else's link: say so and point back to the library.
    const t = await getTranslations("reader");
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <EmptyState icon={BookX} title={t("missingTitle")} body={t("missingBody")}>
          <Button asChild>
            <Link href="/library">{t("back")}</Link>
          </Button>
        </EmptyState>
      </main>
    );
  }

  const [fileUrl, annotations] = await Promise.all([
    storage().readUrl(content.storageKey, 6 * 3600),
    listAnnotations(doc.id, user!.id),
    db.document.update({ where: { id: doc.id }, data: { lastOpenedAt: new Date() } }),
  ]);
  const extracted = content.textVersion >= TEXT_VERSION;

  return (
    <Reader
      docId={doc.id}
      title={doc.title}
      authors={doc.authors}
      fileUrl={fileUrl}
      pageCount={content.pageCount}
      toc={(content.toc as TocEntry[] | null) ?? []}
      direction={(content.direction as "rtl" | "ltr" | "mixed" | null) ?? null}
      language={content.language}
      textStatus={content.textStatus}
      pageWords={extracted && content.pageWords.length ? content.pageWords : null}
      initial={doc.progress ? { page: doc.progress.pageIndex, offset: (doc.progress.charOffset ?? 0) / 1000 } : null}
      initialPrefs={readPrefs(doc.user.preferences)}
      initialAnnotations={annotations}
    />
  );
}
