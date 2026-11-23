"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isActive, navItems } from "./nav-items";

/** Desktop/tablet navigation in the header. */
export function NavLinks() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("menu")} className="hidden items-center gap-1 md:flex">
      {navItems.map(({ href, key }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone navigation: a quiet tab bar at the bottom. */
export function BottomTabs() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("menu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {navItems.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
