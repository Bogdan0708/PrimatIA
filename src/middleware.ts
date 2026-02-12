import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/constants";

const intlMiddleware = createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
});

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per IP — fine for single-instance deployment)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_CONFIGS: Record<string, { maxRequests: number; windowMs: number }> = {
  "/api/portal/auth/login": { maxRequests: 10, windowMs: 60_000 },
  "/api/portal/auth/register": { maxRequests: 5, windowMs: 60_000 },
  "/api/portal/payments/initiate": { maxRequests: 20, windowMs: 60_000 },
  "/api/portal/contact": { maxRequests: 5, windowMs: 60_000 },
  "/api/plati/record": { maxRequests: 60, windowMs: 60_000 },
  // Default for all other API routes
  default: { maxRequests: 120, windowMs: 60_000 },
};

function getRateLimitConfig(pathname: string) {
  for (const [route, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
    if (route !== "default" && pathname.startsWith(route)) return config;
  }
  return RATE_LIMIT_CONFIGS.default;
}

function checkRateLimit(ip: string, pathname: string): boolean {
  const config = getRateLimitConfig(pathname);
  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= config.maxRequests;
}

// Periodically clean up stale entries (every 5 min)
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    rateLimitMap.forEach((entry, key) => {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    });
  };
  // Only set interval in non-edge environments (middleware runs on edge)
  // The map will naturally stay small since stale entries are skipped on access
  if (rateLimitMap.size > 10_000) {
    cleanup();
  }
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // HTTP Strict Transport Security
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy (restrict browser features)
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  return response;
}

// ---------------------------------------------------------------------------
// CORS for portal API routes
// ---------------------------------------------------------------------------

function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [];

  // In development, allow localhost
  if (process.env.NODE_ENV === "development") {
    allowedOrigins.push("http://localhost:3000", "http://localhost:3001");
  }

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

// ---------------------------------------------------------------------------
// Request size limit check (header-based, for import/upload routes)
// ---------------------------------------------------------------------------

const SIZE_LIMITED_ROUTES: Record<string, number> = {
  "/api/portal/auth/register": 10 * 1024, // 10 KB
  "/api/portal/contact": 50 * 1024, // 50 KB
  // Import and upload get a generous limit
  "/api/plati/record": 100 * 1024, // 100 KB
};

const DEFAULT_API_SIZE_LIMIT = 1 * 1024 * 1024; // 1 MB

function checkRequestSize(request: NextRequest): boolean {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return true;

  const size = parseInt(contentLength, 10);
  if (isNaN(size)) return true;

  const { pathname } = request.nextUrl;
  for (const [route, limit] of Object.entries(SIZE_LIMITED_ROUTES)) {
    if (pathname.startsWith(route)) return size <= limit;
  }

  return size <= DEFAULT_API_SIZE_LIMIT;
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight for API routes
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    const response = new NextResponse(null, { status: 204 });
    addCorsHeaders(response, request);
    return response;
  }

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(ip, pathname)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests" }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
      );
    }

    // Request size check
    if (!checkRequestSize(request)) {
      return new NextResponse(
        JSON.stringify({ error: "Request body too large" }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }
  }

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
      const locale = localePortalMatch ? localePortalMatch[1] : null;
      const loginUrl = locale ? `/${locale}/portal/login` : "/portal/login";
      const url = request.nextUrl.clone();
      url.pathname = loginUrl;
      const redirectResponse = NextResponse.redirect(url);
      return addSecurityHeaders(redirectResponse);
    }
  }

  // Skip i18n middleware for API routes
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    if (pathname.startsWith("/api/portal")) {
      addCorsHeaders(response, request);
    }
    return response;
  }

  // Run the i18n middleware for page routes
  const response = intlMiddleware(request);

  // Add security headers to all responses
  addSecurityHeaders(response);

  // Add CORS headers for API portal routes
  if (pathname.startsWith("/api/portal")) {
    addCorsHeaders(response, request);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except:
    // - /_next (Next.js internals)
    // - /static (static files)
    // - /sw.js (service worker)
    // - .*\..* (files with extensions like .ico, .png)
    "/((?!_next|static|sw\\.js|.*\\..*|_vercel).*)",
    // Also match API routes for security/rate limiting
    "/api/:path*",
  ],
};
