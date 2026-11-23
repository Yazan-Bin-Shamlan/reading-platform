import { BookMarked, Compass, House, LibraryBig, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: "/" | "/library" | "/explore" | "/words";
  key: "home" | "library" | "explore" | "words";
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/", key: "home", icon: House },
  { href: "/library", key: "library", icon: LibraryBig },
  { href: "/explore", key: "explore", icon: Compass },
  { href: "/words", key: "words", icon: BookMarked },
];

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
