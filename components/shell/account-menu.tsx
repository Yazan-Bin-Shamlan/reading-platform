import { LogOut, Settings, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";

export async function AccountMenu() {
  const t = await getTranslations();
  const user = await getUser();

  if (!user) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/sign-in">{t("auth.signIn")}</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("settings.account")}>
          <UserRound aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden />
            {t("nav.settings")}
          </Link>
        </DropdownMenuItem>
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              {t("auth.signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
