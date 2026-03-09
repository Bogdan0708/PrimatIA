import { NextRequest, NextResponse } from "next/server";
import { requestCitizenPasswordReset } from "@/lib/password-reset";
import { resolvePortalTenant } from "@/lib/portal-auth";
import { logError, getRequestLogContext } from "@/lib/logger";
import { checkSharedRateLimit, createRateLimitExceededResponse, withRateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  
  // Strict rate limit for password resets
  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "portal-forgot-password",
    limit: 5,
    windowMs: 15 * 60 * 1000, // 5 requests per 15 minutes
  });

  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email : "";

    const tenantId = await resolvePortalTenant(request);

    if (email && tenantId) {
      try {
        await requestCitizenPasswordReset(tenantId, email);
      } catch (error) {
        logError({ 
            message: "Citizen forgot-password request failed while sending reset email",
            ...logContext,
            tenantId,
        }, error);
      }
    }

    // Always return success to prevent email enumeration
    return withRateLimitHeaders(NextResponse.json({ success: true }), rateLimit);
  } catch (error) {
    // If it's just a JSON parse error, we still want to return success to avoid leaking info,
    // but other unexpected errors should be logged.
    if (!(error instanceof SyntaxError)) {
      logError({ message: "Unexpected error in forgot-password", ...logContext }, error);
    }
    return withRateLimitHeaders(NextResponse.json({ success: true }), rateLimit);
  }
}
