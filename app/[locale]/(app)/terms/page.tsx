import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("terms.title") };
}

export default function Page() {
  return <LegalPage page="terms" />;
}
