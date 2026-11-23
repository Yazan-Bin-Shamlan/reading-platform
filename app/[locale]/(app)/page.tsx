import { Compass, LibraryBig, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function HomePage() {
  const t = useTranslations("home");

  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title" className="sr-only">
        {t("greeting")}
      </h1>
      <EmptyState icon={LibraryBig} title={t("emptyTitle")} body={t("emptyBody")}>
        <Button size="lg" data-action="upload">
          <Upload aria-hidden />
          {t("uploadCta")}
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/explore">
            <Compass aria-hidden />
            {t("exploreCta")}
          </Link>
        </Button>
      </EmptyState>
      <p className="-mt-8 text-center text-sm text-muted-foreground">{t("dropHint")}</p>
    </section>
  );
}
