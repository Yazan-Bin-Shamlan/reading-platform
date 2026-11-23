import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{t("title")}</h1>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">{t("back")}</Link>
        </Button>
      </div>
    </main>
  );
}
