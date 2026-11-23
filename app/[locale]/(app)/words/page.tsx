import { BookMarked } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { WordsView } from "@/components/words/words-view";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { countDue, listWords } from "@/lib/words/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/words">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "words" });
  return { title: t("title") };
}

export default async function WordsPage() {
  const t = await getTranslations("words");
  const user = await getUser();
  const [words, due] = user ? await Promise.all([listWords(user.id), countDue(user.id)]) : [[], 0];

  return (
    <>
      <PageHeader title={t("title")}>
        {words.length > 0 && <p className="text-sm text-muted-foreground">{t("count", { count: words.length })}</p>}
      </PageHeader>
      {words.length ? (
        <WordsView words={words} due={due} />
      ) : (
        <EmptyState icon={BookMarked} title={t("emptyTitle")} body={t("emptyBody")}>
          <Button asChild size="lg">
            <Link href="/library">{t("openLibrary")}</Link>
          </Button>
        </EmptyState>
      )}
    </>
  );
}
