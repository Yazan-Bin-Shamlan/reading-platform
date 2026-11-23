import { notFound } from "next/navigation";
import { cache } from "react";
import { PdfReader } from "@/components/reader/pdf-reader";
import { redirect } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TocEntry } from "@/lib/library/schemas";
import { storage } from "@/lib/storage";

const loadDoc = cache(async (docId: string, userId: string) =>
  db.document.findFirst({
    where: { id: docId, userId },
    include: { content: true, progress: true },
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
  if (!doc?.content) notFound();

  const [fileUrl] = await Promise.all([
    storage().readUrl(doc.content.storageKey, 6 * 3600),
    db.document.update({ where: { id: doc.id }, data: { lastOpenedAt: new Date() } }),
  ]);

  return (
    <PdfReader
      docId={doc.id}
      title={doc.title}
      fileUrl={fileUrl}
      pageCount={doc.content.pageCount}
      toc={(doc.content.toc as TocEntry[] | null) ?? []}
      direction={(doc.content.direction as "rtl" | "ltr" | "mixed" | null) ?? null}
      initial={
        doc.progress ? { page: doc.progress.pageIndex, offset: (doc.progress.charOffset ?? 0) / 1000 } : null
      }
    />
  );
}
