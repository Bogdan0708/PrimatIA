import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import { attachRequestId, ensureRequestId } from "@/lib/logger";

const intlMiddleware = createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  const isDev = process.env.NODE_ENV === "development";

  // Enforced policy: 'unsafe-inline' is required until nonce propagation is
  // wired through Next.js script rendering (layout.tsx + Script components).
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' https://js.stripe.com${isDev ? " 'unsafe-inline' 'unsafe-eval'" : " 'unsafe-inline'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
  ];

  response.headers.set("Content-Security-Policy", cspDirectives.join("; "));

  // Report-Only with strict policy to surface violations without breaking anything.
  // Monitor browser console for CSP violations before removing unsafe-inline.
  if (!isDev) {
    response.headers.set(
      "Content-Security-Policy-Report-Only",
      [
        "default-src 'self'",
        "script-src 'self' https://js.stripe.com 'strict-dynamic'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://api.stripe.com",
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self' https://checkout.stripe.com",
      ].join("; ")
    );
  }

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
    "camera=(), microphone=(), geolocation=()"
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
// CSRF / Origin validation for state-changing API requests
// ---------------------------------------------------------------------------

export function rejectCrossOriginMutation(request: NextRequest): NextResponse | null {
  // Only check state-changing methods
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return null;
  }

  const { pathname } = request.nextUrl;

  // Only enforce on API routes (skip Stripe webhook — it has its own signature verification)
  if (!pathname.startsWith("/api/") || pathname === "/api/payments/webhook") {
    return null;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // If no Origin AND no Referer: require X-Requested-With header for API mutations.
  // Browsers always send Origin on cross-origin and same-origin POST/PUT/DELETE.
  // Missing both headers means non-browser client (curl, server-to-server).
  if (!origin && !referer) {
    // Allow health checks and internal API calls with explicit header
    const xrw = request.headers.get("x-requested-with");
    if (xrw === "XMLHttpRequest" || xrw === "fetch") return null;
    // Allow Stripe webhook (already filtered above) and health endpoints
    if (pathname === "/api/health" || pathname === "/api/health/deep") return null;
    return new NextResponse(
      JSON.stringify({ error: "Missing origin header" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const host = request.headers.get("host") || request.nextUrl.host;
  const expectedOrigin = `${request.nextUrl.protocol}//${host}`;

  // Check Origin header first, then Referer
  if (origin) {
    if (origin === expectedOrigin || origin === `https://${host}` || origin === `http://${host}`) {
      return null;
    }
    // Check CORS_ALLOWED_ORIGINS for legitimate cross-origin clients
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [];
    if (process.env.NODE_ENV === "development") {
      allowedOrigins.push("http://localhost:3000", "http://localhost:3001");
    }
    if (allowedOrigins.includes(origin)) return null;

    return new NextResponse(
      JSON.stringify({ error: "Cross-origin request blocked" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fallback: check Referer
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host) return null;
    } catch {
      // Malformed referer — block
    }
    return new NextResponse(
      JSON.stringify({ error: "Cross-origin request blocked" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = ensureRequestId(request);

  // Handle CORS preflight for API routes
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    const response = new NextResponse(null, { status: 204 });
    addCorsHeaders(response, request);
    return attachRequestId(response, requestId);
  }

  // CSRF: Block cross-origin state-changing requests
  const csrfBlock = rejectCrossOriginMutation(request);
  if (csrfBlock) {
    return attachRequestId(csrfBlock, requestId);
  }

  // Skip middleware for Stripe webhook (needs raw body, no rate limiting)
  if (pathname === "/api/payments/webhook") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-request-id", requestId);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    return attachRequestId(response, requestId);
  }

  // Request size checks are kept in middleware because they are cheap and do
  // not depend on shared state. Route-level rate limiting now uses Redis.
  if (pathname.startsWith("/api/")) {
    if (!checkRequestSize(request)) {
      return attachRequestId(new NextResponse(
        JSON.stringify({ error: "Request body too large" }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      ), requestId);
    }
  }

  // Check if this is a protected portal route (not login/register/verify)
  const isProtectedPortalRoute =
    pathname.startsWith("/portal") &&
    !pathname.startsWith("/portal/login") &&
    !pathname.startsWith("/portal/register") &&
    !pathname.startsWith("/portal/verify") &&
    !pathname.startsWith("/portal/forgot-password") &&
    !pathname.startsWith("/portal/reset-password") &&
    !pathname.startsWith("/portal/confidentialitate");

  // Also check for locale-prefixed portal routes (e.g., /ro/portal/dashboard)
  const localePattern = LOCALES.join("|");
  const localePortalMatch = pathname.match(new RegExp(`^/(${localePattern})/portal`));
  const isLocaleProtectedPortalRoute =
    localePortalMatch &&
    !pathname.match(
      new RegExp(`^/(${localePattern})/portal/(login|register|verify|forgot-password|reset-password|confidentialitate)`)
    );

  if (isProtectedPortalRoute || isLocaleProtectedPortalRoute) {
    const citizenToken = request.cookies.get("citizen-token");

    if (!citizenToken) {
      const locale = localePortalMatch ? localePortalMatch[1] : DEFAULT_LOCALE;
      const loginUrl = `/${locale}/portal/login`;
      const url = request.nextUrl.clone();
      url.pathname = loginUrl;
      const redirectResponse = NextResponse.redirect(url);
      return attachRequestId(addSecurityHeaders(redirectResponse), requestId);
    }
  }

  // Skip i18n middleware for API routes
  if (pathname.startsWith("/api/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-request-id", requestId);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    addSecurityHeaders(response);
    if (pathname.startsWith("/api/portal")) {
      addCorsHeaders(response, request);
    }
    return attachRequestId(response, requestId);
  }

  // Run the i18n middleware for page routes
  const response = intlMiddleware(request);

  // Add security headers to all responses
  addSecurityHeaders(response);

  // Add CORS headers for API portal routes
  if (pathname.startsWith("/api/portal")) {
    addCorsHeaders(response, request);
  }

  return attachRequestId(response, requestId);
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
