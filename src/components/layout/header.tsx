"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, Globe, LogOut, User } from "lucide-react";
import { LOCALES, type Locale } from "@/lib/constants";

interface HeaderProps {
  userName: string;
  userRole: string;
  tenantName?: string;
  onToggleSidebar?: () => void;
}

const localeLabels: Record<Locale, string> = {
  ro: "Română",
  en: "English",
  hu: "Magyar",
};

export function Header({
  userName,
  userRole,
  tenantName,
  onToggleSidebar,
}: HeaderProps) {
  const t = useTranslations("common");
  const tRoles = useTranslations("roles");
  const router = useRouter();
  const currentLocale = useLocale();

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const switchLocale = (locale: Locale) => {
    const currentPath = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    // Remove existing locale prefix if present
    const localePattern = new RegExp(`^/(${LOCALES.join("|")})`);
    const pathWithoutLocale = currentPath.replace(localePattern, "");
    const normalizedPath = pathWithoutLocale || "/";
    const newPath =
      normalizedPath === "/" ? `/${locale}` : `/${locale}${normalizedPath}`;
    router.push(`${newPath}${search}${hash}`);
  };

  const localePrefix = `/${currentLocale}`;

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onToggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        {tenantName && (
          <span className="text-sm font-medium text-muted-foreground">
            {tenantName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Globe className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {LOCALES.map((locale) => (
              <DropdownMenuItem
                key={locale}
                onClick={() => switchLocale(locale)}
              >
                {localeLabels[locale]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {tRoles(userRole)}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              {t("details")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: `${localePrefix}/login` })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
