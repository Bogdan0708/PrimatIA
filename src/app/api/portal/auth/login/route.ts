import { NextRequest, NextResponse } from "next/server";
import { authenticateCitizen } from "@/lib/citizen-auth";
import { SignJWT } from "jose";
import { resolvePortalTenant } from "@/lib/portal-auth";
import { checkSharedRateLimit, createRateLimitExceededResponse, withRateLimitHeaders } from "@/lib/rate-limit";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";

/** Lazily resolved at request time so the module can be imported during build. */
function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    process.env.CITIZEN_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET (or CITIZEN_JWT_SECRET/NEXTAUTH_SECRET) must be configured"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "portal-auth-login",
    limit: 10,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return withRateLimitHeaders(NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      ), rateLimit);
    }

    const tenantId = await resolvePortalTenant(request);
    if (!tenantId) {
      logWarn({
        message: "Portal login rejected because tenant resolution failed",
        ...logContext,
      });
      return withRateLimitHeaders(NextResponse.json(
        { error: "Tenant identification required" },
        { status: 400 }
      ), rateLimit);
    }

    const citizen = await authenticateCitizen(email, password, tenantId);

    if (!citizen) {
      logWarn({
        message: "Portal login rejected because credentials were invalid",
        ...logContext,
        tenantId,
      });
      return withRateLimitHeaders(NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      ), rateLimit);
    }

    // Create JWT token
    const token = await new SignJWT({
      sub: citizen.id,
      email: citizen.email,
      tenantId: citizen.tenantId,
      firstName: citizen.firstName,
      lastName: citizen.lastName,
      role: "cetatean",
      isCitizen: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("4h")
      .sign(getJwtSecret());

    const response = NextResponse.json({
      success: true,
      user: {
        id: citizen.id,
        email: citizen.email,
        firstName: citizen.firstName,
        lastName: citizen.lastName,
      },
    });

    // Set the citizen session cookie
    response.cookies.set("citizen-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 4 * 60 * 60, // 4 hours
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error) {
    logError(
      {
        message: "Portal login failed unexpectedly",
        ...logContext,
      },
      error
    );
    return withRateLimitHeaders(NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ), rateLimit);
  }
}
