import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { brand } from "@/lib/brand";

export function BrandMark() {
  const locale = useLocale();
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md font-serif text-lg font-semibold tracking-tight">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-brand text-sm text-background">
        {locale === "ar" ? "ق" : "Q"}
      </span>
      {locale === "ar" ? brand.name.ar : brand.name.en}
    </Link>
  );
}
