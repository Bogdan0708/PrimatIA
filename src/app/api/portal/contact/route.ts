import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest, resolvePortalTenant } from "@/lib/portal-auth";
import { prisma, withTenantScope } from "@/lib/db";
import { checkSharedRateLimit, createRateLimitExceededResponse, withRateLimitHeaders } from "@/lib/rate-limit";
import { getRequestLogContext, logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  try {
    const rateLimit = await checkSharedRateLimit({
      request,
      bucket: "portal-contact",
      limit: 5,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitExceededResponse(rateLimit);
    }

    const citizen = await getCitizenFromRequest(request);
    const body = await request.json();
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return withRateLimitHeaders(NextResponse.json(
        { error: "Name, email, subject, and message are required" },
        { status: 400 }
      ), rateLimit);
    }

    // Authenticated tenant is read from JWT; anonymous requests derive tenant from domain/env.
    const tenantId = citizen?.tenantId ?? await resolvePortalTenant(request);
    if (!tenantId) {
      return withRateLimitHeaders(NextResponse.json(
        { error: "Tenant identification required" },
        { status: 400 }
      ), rateLimit);
    }

    await withTenantScope(tenantId, async () => {
      await prisma.contactMessage.create({
        data: {
          tenantId,
          citizenUserId: citizen?.sub || null,
          name,
          email,
          phone: phone || null,
          subject,
          message,
        },
      });
    });

    return withRateLimitHeaders(NextResponse.json({ success: true }), rateLimit);
  } catch (error) {
    logError(
      {
        message: "Portal contact message failed",
        ...logContext,
      },
      error
    );
    return withRateLimitHeaders(NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    ), rateLimit);
  }
}
