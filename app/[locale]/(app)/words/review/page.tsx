import { CalendarCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ReviewSession } from "@/components/words/review-session";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { reviewQueue } from "@/lib/words/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/words/review">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "review" });
  return { title: t("title") };
}

export default async function ReviewPage({ searchParams }: PageProps<"/[locale]/words/review">) {
  const t = await getTranslations("review");
  const user = await getUser();
  // ?all=1: practise even when nothing is due.
  const practise = (await searchParams).all === "1";
  const due = user ? await reviewQueue(user.id, false) : [];
  const cards = due.length || !practise ? due : user ? await reviewQueue(user.id, true) : [];

  return (
    <>
      <PageHeader title={t("title")} />
      {cards.length ? (
        <ReviewSession cards={cards} />
      ) : practise ? (
        // Nothing saved at all yet.
        <EmptyState icon={CalendarCheck} title={t("noWordsTitle")} body={t("noWordsBody")}>
          <Button asChild size="lg">
            <Link href="/library">{t("openLibrary")}</Link>
          </Button>
        </EmptyState>
      ) : (
        <EmptyState icon={CalendarCheck} title={t("nothingDueTitle")} body={t("nothingDueBody")}>
          <Button asChild size="lg">
            <Link href="/words/review?all=1">{t("practiseAnyway")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/words">{t("backToWords")}</Link>
          </Button>
        </EmptyState>
      )}
    </>
  );
}
