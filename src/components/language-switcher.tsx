"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, type Locale } from "@/lib/constants";

const localeLabels: Record<Locale, string> = {
  ro: "Română",
  en: "English",
  hu: "Magyar",
};

interface LanguageSwitcherProps {
  variant?: "ghost" | "outline";
  className?: string;
}

export function LanguageSwitcher({ variant = "ghost", className }: LanguageSwitcherProps) {
  const router = useRouter();
  const currentLocale = useLocale();
  const t = useTranslations("common");

  const switchLocale = (locale: Locale) => {
    const currentPath = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    const localePattern = new RegExp(`^/(${LOCALES.join("|")})`);
    const pathWithoutLocale = currentPath.replace(localePattern, "");
    const normalizedPath = pathWithoutLocale || "/";
    const newPath =
      normalizedPath === "/" ? `/${locale}` : `/${locale}${normalizedPath}`;
    router.push(`${newPath}${search}${hash}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="icon" className={className}>
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
            className={locale === currentLocale ? "font-bold" : ""}
          >
            {localeLabels[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
