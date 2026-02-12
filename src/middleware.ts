import createMiddleware from "next-intl/middleware";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/constants";

export default createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
});

export const config = {
  matcher: [
    // Match all pathnames except:
    // - /api (API routes)
    // - /_next (Next.js internals)
    // - /static (static files)
    // - .*\\..* (files with extensions like .ico, .png)
    "/((?!api|_next|static|.*\\..*|_vercel).*)",
  ],
};
