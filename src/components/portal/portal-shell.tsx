"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { signOut, useSession } from "next-auth/react";
import {
  Building2,
  LayoutDashboard,
  Home,
  Receipt,
  CreditCard,
  FileCheck,
  FileText,
  User,
  Globe,
  LogOut,
  Menu,
  X,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LOCALES, type Locale } from "@/lib/constants";
import { NotificationBell } from "@/components/portal/notification-bell";

const localeLabels: Record<Locale, string> = {
  ro: "Română",
  en: "English",
  hu: "Magyar",
};

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const portalNavItems: NavItem[] = [
  { href: "/portal/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/portal/proprietati", labelKey: "properties", icon: Home },
  { href: "/portal/impozite", labelKey: "taxes", icon: Receipt },
  { href: "/portal/plati", labelKey: "payments", icon: CreditCard },
  { href: "/portal/certificate", labelKey: "certificates", icon: FileCheck },
  { href: "/portal/documente", labelKey: "documents", icon: FileText },
  { href: "/portal/contact", labelKey: "contact", icon: Phone },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("portal");
  const tCommon = useTranslations("common");
  const { data: session } = useSession();

  const isLoggedIn = !!session?.user;

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

  const localePattern = new RegExp(`^/(${LOCALES.join("|")})`);
  const pathWithoutLocale = pathname.replace(localePattern, "");
  const localePrefix = `/${locale}`;
  const toLocalePath = (path: string) => `${localePrefix}${path}`;

  const initials = session?.user
    ? `${session.user.firstName?.[0] || ""}${session.user.lastName?.[0] || ""}`
        .toUpperCase()
    : "";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href={toLocalePath("/portal")} className="flex items-center gap-2">
              <Building2 className="h-7 w-7 text-portal-primary" />
              <div className="flex flex-col">
                <span className="text-lg font-bold text-gray-900">
                  PrimărIA
                </span>
                <span className="text-xs text-portal-primary -mt-1 hidden sm:block">
                  {t("title")}
                </span>
              </div>
            </Link>

            {/* Desktop nav */}
            {isLoggedIn && (
              <nav className="hidden lg:flex items-center gap-1">
                {portalNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathWithoutLocale.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={toLocalePath(item.href)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        isActive
                          ? "bg-portal-primary-subtle text-portal-primary"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Language switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-600">
                    <Globe className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{tCommon("language")}</DropdownMenuLabel>
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

              {isLoggedIn ? (
                <>
                  {/* Notification bell */}
                  <NotificationBell
                    translations={{
                      notifications: t("notifications"),
                      noNotifications: t("noNotifications"),
                      markAllRead: t("markAllRead"),
                    }}
                  />

                  {/* User menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="relative h-8 w-8 rounded-full"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-portal-primary-subtle text-portal-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">
                            {session.user.firstName} {session.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.user.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={toLocalePath("/portal/profil")}>
                          <User className="mr-2 h-4 w-4" />
                          {t("profile")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          signOut({ callbackUrl: toLocalePath("/portal/login") })
                        }
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        {tCommon("logout")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Mobile menu button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    {mobileMenuOpen ? (
                      <X className="h-5 w-5" />
                    ) : (
                      <Menu className="h-5 w-5" />
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  asChild
                  variant="default"
                  className="bg-portal-primary hover:bg-portal-primary-hover"
                >
                  <Link href={toLocalePath("/portal/login")}>
                    {tCommon("login")}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {isLoggedIn && mobileMenuOpen && (
          <div className="lg:hidden border-t bg-white">
            <nav className="max-w-7xl mx-auto px-4 py-2 space-y-1">
              {portalNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathWithoutLocale.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={toLocalePath(item.href)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                      isActive
                        ? "bg-portal-primary-subtle text-portal-primary"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-portal-primary" />
              <span className="font-semibold text-white">PrimărIA</span>
            </div>
            <p className="text-sm text-center">
              {t("footerText")}
            </p>
            <div className="text-sm">
              © {new Date().getFullYear()} PrimărIA
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
