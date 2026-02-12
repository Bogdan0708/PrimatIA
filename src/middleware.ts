import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/constants";

const intlMiddleware = createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected portal route (not login/register/verify)
  const isProtectedPortalRoute =
    pathname.startsWith("/portal") &&
    !pathname.startsWith("/portal/login") &&
    !pathname.startsWith("/portal/register") &&
    !pathname.startsWith("/portal/verify");

  // Also check for locale-prefixed portal routes (e.g., /ro/portal/dashboard)
  const localePortalMatch = pathname.match(/^\/(ro|en|hu)\/portal/);
  const isLocaleProtectedPortalRoute =
    localePortalMatch &&
    !pathname.match(/^\/(ro|en|hu)\/portal\/(login|register|verify)/);

  if (isProtectedPortalRoute || isLocaleProtectedPortalRoute) {
    const citizenToken = request.cookies.get("citizen-token");

    if (!citizenToken) {
      // Redirect to portal login, preserving the locale if present
      const locale = localePortalMatch ? localePortalMatch[1] : null;
      const loginUrl = locale ? `/${locale}/portal/login` : "/portal/login";
      const url = request.nextUrl.clone();
      url.pathname = loginUrl;
      return NextResponse.redirect(url);
    }
  }

  // Run the i18n middleware for all routes
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all pathnames except:
    // - /api (API routes)
    // - /_next (Next.js internals)
    // - /static (static files)
    // - /sw.js (service worker)
    // - .*\\..* (files with extensions like .ico, .png)
    "/((?!api|_next|static|sw\\.js|.*\\..*|_vercel).*)",
  ],
};
