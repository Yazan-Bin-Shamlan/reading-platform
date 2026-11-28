import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("privacy.title") };
}

export default function Page() {
  return <LegalPage page="privacy" />;
}
