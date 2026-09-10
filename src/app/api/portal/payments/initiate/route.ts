import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { getPaymentGateway } from "@/lib/payments/payment-gateway";
import { prisma, withTenantScope } from "@/lib/db";
import { checkSharedRateLimit, createRateLimitExceededResponse, withRateLimitHeaders } from "@/lib/rate-limit";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";
import { paymentInitiateSchema } from "@/lib/validations/portal";

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "portal-payments-initiate",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    logWarn({
      message: "Portal payment initiation rejected because citizen was not authenticated",
      ...logContext,
    });
    return withRateLimitHeaders(NextResponse.json({ error: "Not authenticated" }, { status: 401 }), rateLimit);
  }

  try {
    const body = await request.json();
    const parsed = paymentInitiateSchema.safeParse(body);
    if (!parsed.success) {
      return withRateLimitHeaders(NextResponse.json(
        { error: "Date invalide", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      ), rateLimit);
    }
    const { contribuabilId, items } = parsed.data;

    // DB check: verify citizen access (scoped transaction, released quickly)
    const link = await withTenantScope(citizen.tenantId, () =>
      prisma.citizenContribuabilLink.findFirst({
        where: {
          citizenUserId: citizen.sub,
          contribuabilId,
          isActive: true,
        },
      })
    );

    if (!link) {
      logWarn({
        message: "Portal payment initiation rejected because citizen lacks contribuabil access",
        ...logContext,
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
        contribuabilId,
      });
      return withRateLimitHeaders(NextResponse.json({ error: "Access denied" }, { status: 403 }), rateLimit);
    }

    // External call: gateway (network I/O, outside DB transaction)
    const gateway = getPaymentGateway();
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const result = await gateway.initiatePayment({
      tenantId: citizen.tenantId,
      contribuabilId,
      citizenUserId: citizen.sub,
      items,
      returnUrl: `${baseUrl}/portal/plati/confirmare`,
      cancelUrl: `${baseUrl}/portal/plati`,
    });

    // DB write: store payment record (scoped transaction)
    const totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);

    await withTenantScope(citizen.tenantId, () =>
      prisma.onlinePayment.create({
        data: {
          tenantId: citizen.tenantId,
          citizenUserId: citizen.sub,
          contribuabilId,
          suma: totalAmount,
          status: "initiated",
          gatewayRef: result.gatewayRef,
          selectedDebts: items,
          expiresAt: result.expiresAt,
        },
      })
    );

    return withRateLimitHeaders(NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      gatewayRef: result.gatewayRef,
    }), rateLimit);
  } catch (error) {
    logError(
      {
        message: "Portal payment initiation failed unexpectedly",
        ...logContext,
        tenantId: citizen?.tenantId,
        citizenUserId: citizen?.sub,
      },
      error
    );
    return withRateLimitHeaders(NextResponse.json(
      { error: "Failed to initiate payment" },
      { status: 500 }
    ), rateLimit);
  }
}
