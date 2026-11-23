import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./brand-mark";
import { LanguageSwitch } from "./language-switch";
import { NavLinks } from "./nav-links";
import { ThemeMenu } from "./theme-menu";

export function SiteHeader({ account }: { account?: ReactNode }) {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <BrandMark />
        <div className="flex flex-1 justify-center">
          <NavLinks />
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" className="hidden sm:inline-flex" data-action="upload">
            <Upload aria-hidden />
            {t("upload")}
          </Button>
          <LanguageSwitch />
          <ThemeMenu />
          {account}
        </div>
      </div>
    </header>
  );
}
