"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";

/** One tap switches between Arabic and English. */
export function LanguageSwitch() {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const next = locale === "ar" ? "en" : "ar";

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      lang={next}
      aria-label={`${t("label")}: ${t(next)}`}
      onClick={() =>
        startTransition(() => {
          router.replace(pathname, { locale: next });
        })
      }
    >
      <Languages aria-hidden />
      <span className="hidden sm:inline">{t(next)}</span>
    </Button>
  );
}
