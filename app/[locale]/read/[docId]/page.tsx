import { BookX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { Reader } from "@/components/reader/reader";
import { getProvider } from "@/lib/ai/provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TocEntry } from "@/lib/library/schemas";
import { readPrefs } from "@/lib/reader/prefs";
import { listAnnotations } from "@/lib/reader/queries";
import { storage } from "@/lib/storage";
import { textReady } from "@/lib/text/extract";

const loadDoc = cache(async (docId: string, userId: string) =>
  db.document.findFirst({
    where: { id: docId, userId },
    include: {
      content: true,
      progress: true,
      user: { select: { preferences: true, englishLevel: true, assistEnabled: true, assistDensity: true, explainLang: true } },
    },
  }),
);

export async function generateMetadata({ params }: PageProps<"/[locale]/read/[docId]">) {
  const { docId } = await params;
  const user = await getUser();
  const doc = user ? await loadDoc(docId, user.id) : null;
  return { title: doc?.title };
}

export default async function ReadPage({ params, searchParams }: PageProps<"/[locale]/read/[docId]">) {
  const { locale, docId } = await params;
  // ?p=page&s=start&e=end: open at that text (links from My Words).
  const q = await searchParams;
  const num = (v: string | string[] | undefined) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
  const [jp, js, je] = [num(q.p), num(q.s), num(q.e)];
  const jump = jp !== null && js !== null && je !== null && je > js ? { page: jp, start: js, end: je } : null;
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

  const [fileUrl, annotations, known, saved, provider] = await Promise.all([
    // HTML books have no file to show, only their text; very large ones come through the proxy.
    content.format !== "pdf"
      ? null
      : content.storageKey.startsWith("remote:")
        ? `/api/proxy/${content.id}`
        : storage().readUrl(content.storageKey, 6 * 3600),
    listAnnotations(doc.id, user!.id),
    db.knownWord.findMany({ where: { userId: user!.id }, select: { lang: true, lemma: true } }),
    db.savedWord.findMany({ where: { userId: user!.id }, select: { lang: true, lemma: true } }),
    getProvider(),
    db.document.update({ where: { id: doc.id }, data: { lastOpenedAt: new Date() } }),
  ]);
  const byLang = (rows: { lang: "ar" | "en"; lemma: string }[]) => ({
    ar: rows.filter((r) => r.lang === "ar").map((r) => r.lemma),
    en: rows.filter((r) => r.lang === "en").map((r) => r.lemma),
  });
  const profile = doc.user;
  const extracted = textReady(content);

  return (
    <Reader
      docId={doc.id}
      title={doc.title}
      authors={doc.authors}
      fileUrl={fileUrl}
      fileSize={content.byteSize}
      pageCount={content.pageCount}
      toc={(content.toc as TocEntry[] | null) ?? []}
      direction={(content.direction as "rtl" | "ltr" | "mixed" | null) ?? null}
      language={content.language}
      textStatus={content.textStatus}
      pageWords={extracted && content.pageWords.length ? content.pageWords : null}
      initial={doc.progress ? { page: doc.progress.pageIndex, offset: (doc.progress.charOffset ?? 0) / 1000 } : null}
      initialPrefs={readPrefs(doc.user.preferences)}
      initialAnnotations={annotations}
      jump={jump}
      assist={{
        settings: {
          enabled: profile.assistEnabled,
          level: profile.englishLevel,
          density: profile.assistDensity,
          explainLang: profile.explainLang,
        },
        docEnabled: doc.assistEnabled,
        known: byLang(known),
        saved: byLang(saved),
        provider: provider?.name ?? null,
      }}
    />
  );
}
