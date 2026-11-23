import { ArrowLeft, ArrowRight, Compass, LibraryBig } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BookCover } from "@/components/library/book-cover";
import { ReadingProgress } from "@/components/library/progress-label";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { UploadButton } from "@/components/upload/upload-button";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { listLibrary, type LibraryDoc } from "@/lib/library/queries";
import { joinNames } from "@/lib/utils";

export default async function HomePage() {
  const t = await getTranslations();
  const locale = await getLocale();
  const user = await getUser();
  const docs = user ? await listLibrary(user.id, 13) : [];

  if (!docs.length) {
    return (
      <section aria-labelledby="home-title">
        <h1 id="home-title" className="sr-only">
          {t("home.greeting")}
        </h1>
        <EmptyState icon={LibraryBig} title={t("home.emptyTitle")} body={t("home.emptyBody")}>
          <UploadButton size="lg">{t("home.uploadCta")}</UploadButton>
          <Button size="lg" variant="outline" asChild>
            <Link href="/explore">
              <Compass aria-hidden />
              {t("home.exploreCta")}
            </Link>
          </Button>
        </EmptyState>
        {user && <p className="-mt-8 text-center text-sm text-muted-foreground">{t("home.dropHint")}</p>}
      </section>
    );
  }

  // One click to keep reading: the most recent unfinished book.
  const current = docs.find((d) => d.lastOpenedAt && d.percent < 0.99) ?? docs[0];
  const rest = docs.filter((d) => d.id !== current.id).slice(0, 12);
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-12">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">{t("home.greeting")}</h1>
      <ContinueCard doc={current} label={current.lastOpenedAt ? t("home.continue") : t("home.recent")} />
      {rest.length > 0 && (
        <section aria-labelledby="recent">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="recent" className="text-lg font-semibold">
              {t("home.recent")}
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/library">
                {t("nav.library")}
                <Arrow aria-hidden />
              </Link>
            </Button>
          </div>
          <ul className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {rest.map((d) => (
              <li key={d.id} className="w-32 shrink-0 snap-start sm:w-36">
                <Link href={`/read/${d.id}`} className="group block rounded-lg">
                  <BookCover title={d.title} coverUrl={d.coverUrl} className="transition-transform group-hover:-translate-y-0.5" />
                  <p className="mt-2 line-clamp-2 text-sm leading-snug font-medium">
                    <bdi>{d.title}</bdi>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

async function ContinueCard({ doc, label }: { doc: LibraryDoc; label: string }) {
  const t = await getTranslations();
  return (
    <Link
      href={`/read/${doc.id}`}
      className="group flex items-center gap-5 rounded-3xl border bg-card p-4 transition-shadow hover:shadow-md sm:gap-8 sm:p-6"
    >
      <BookCover title={doc.title} coverUrl={doc.coverUrl} sizes="large" className="w-24 shrink-0 sm:w-32" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide text-brand uppercase">{label}</p>
        <p className="mt-1.5 line-clamp-2 font-serif text-xl leading-snug font-semibold sm:text-2xl">
          <bdi>{doc.title}</bdi>
        </p>
        {doc.authors[0] && (
          <p className="mt-1 truncate text-sm text-muted-foreground">
            <bdi>{joinNames(doc.authors)}</bdi>
          </p>
        )}
        <div className="mt-4 max-w-sm">
          <ReadingProgress percent={doc.percent} />
        </div>
        <span className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors group-hover:bg-primary/85">
          {doc.lastOpenedAt ? t("home.continue") : t("upload.readNow")}
        </span>
      </div>
    </Link>
  );
}
