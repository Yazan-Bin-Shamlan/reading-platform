import { ArrowLeft, ArrowRight, SearchX } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";
import { ItemActions } from "@/components/explore/item-actions";
import { BookCover } from "@/components/library/book-cover";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRecord, saveRecord } from "@/lib/sources";
import { ARXIV_THANKS } from "@/lib/sources/arxiv";
import { licenseLabel } from "@/lib/sources/license";
import { sourceIds, type SourceId } from "@/lib/sources/types";

const load = cache(async (source: string, parts: string[]) => {
  if (!(sourceIds as readonly string[]).includes(source)) return null;
  const sourceId = parts.map(decodeURIComponent).join("/");
  return getRecord(source as SourceId, sourceId).catch(() => null);
});

export async function generateMetadata({ params }: PageProps<"/[locale]/explore/[source]/[...id]">) {
  const { source, id } = await params;
  const record = await load(source, id);
  return { title: record?.title };
}

export default async function ExploreItemPage({ params }: PageProps<"/[locale]/explore/[source]/[...id]">) {
  const { source, id } = await params;
  const record = await load(source, id);
  const t = await getTranslations("explore");
  if (!record) {
    return (
      <EmptyState icon={SearchX} title={t("notFoundTitle")} body={t("notFoundBody")}>
        <Button asChild>
          <Link href="/explore">{t("title")}</Link>
        </Button>
      </EmptyState>
    );
  }
  const Back = (await getLocale()) === "ar" ? ArrowRight : ArrowLeft;

  // Keep the metadata of what people look at (files are still only fetched on Read).
  const item = await saveRecord(record);
  const user = await getUser();
  const doc = user
    ? await db.document.findFirst({ where: { userId: user.id, catalogItemId: item.id }, select: { id: true } })
    : null;
  const readable = Boolean(record.pdfUrl || record.htmlUrl);
  const typeLabel = t(`types.${record.type === "book" ? "book" : "paper"}`);

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-8 py-2">
      <Link href="/explore" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Back aria-hidden className="size-4" />
        {t("title")}
      </Link>
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <BookCover title={record.title} coverUrl={record.coverUrl} sizes="large" className="w-40 shrink-0 self-start sm:w-48" />
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {[typeLabel, t(`languages.${record.language}`), record.year].filter(Boolean).join(" · ")}
          </p>
          <h1 dir="auto" className="font-serif text-3xl leading-tight font-semibold text-balance">
            {record.title}
          </h1>
          {record.altTitle && (
            <p dir="auto" className="-mt-1 text-muted-foreground">
              {record.altTitle}
            </p>
          )}
          {record.authors.length > 0 && (
            <p dir="auto" className="text-lg">
              {record.authors.join("، ")}
            </p>
          )}
          <div className="pt-2">
            <ItemActions
              source={record.source}
              sourceId={record.sourceId}
              readable={readable}
              docId={doc?.id ?? null}
              sourceUrl={record.sourceUrl}
              signedIn={Boolean(user)}
            />
          </div>
          {record.source === "aco" && <p className="text-sm text-muted-foreground">{t("scannedNote")}</p>}
          {record.source === "gutenberg" && <p className="text-sm text-muted-foreground">{t("textOnlyNote")}</p>}
          {!readable && <p className="text-sm text-muted-foreground">{t("linkOutNote")}</p>}
        </div>
      </div>

      {record.abstract && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl font-semibold">{t("about")}</h2>
          <p dir="auto" className="leading-relaxed text-pretty whitespace-pre-line">
            {record.abstract}
          </p>
        </section>
      )}

      {record.subjects.length > 0 && (
        <section className="flex flex-wrap gap-2">
          {record.subjects.map((s) => (
            <Link
              key={s}
              href={`/explore?q=${encodeURIComponent(s)}`}
              dir="auto"
              className="rounded-full border px-3 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {s}
            </Link>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-sm">
        <p>
          <span className="font-medium">{t("license")}: </span>
          {record.licenseUrl ? (
            <a href={record.licenseUrl} target="_blank" rel="noreferrer" className="text-brand underline-offset-2 hover:underline">
              {licenseLabel(record.license, record.licenseUrl)}
            </a>
          ) : record.license === "public-domain" ? (
            t("publicDomain")
          ) : (
            licenseLabel(record.license)
          )}
        </p>
        <p dir="auto" className="text-muted-foreground">
          <span className="font-medium text-foreground">{t("source")}: </span>
          {record.attribution}
        </p>
        {record.source === "arxiv" && !record.attribution.includes(ARXIV_THANKS) && (
          <p className="text-muted-foreground">{ARXIV_THANKS}</p>
        )}
      </section>
    </article>
  );
}
