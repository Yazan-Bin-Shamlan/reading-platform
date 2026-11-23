import { useTranslations } from "next-intl";
import { AccountMenu } from "@/components/shell/account-menu";
import { BottomTabs } from "@/components/shell/nav-links";
import { SiteHeader } from "@/components/shell/site-header";

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  const t = useTranslations("nav");
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        {t("skip")}
      </a>
      <SiteHeader account={<AccountMenu />} />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 md:pb-16">
        {children}
      </main>
      <BottomTabs />
    </>
  );
}
