import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { getPaymentGateway } from "@/lib/payments/payment-gateway";
import { prisma, setTenantContext } from "@/lib/db";
import {
  SelectedDebtValidationError,
  validateSelectedDebtsForContribuabil,
} from "@/lib/payments/selected-debts";
import { logger, getRequestLogContext } from "@/lib/logger";
import { checkSharedRateLimit, createRateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  
  // Add rate limiting
  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "payments-create-checkout",
    limit: 10,
    windowMs: 60 * 1000, // 10 requests per minute
  });

  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    logger.warn({
      ...logContext,
    }, "Checkout creation rejected because citizen was not authenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { contribuabilId, items } = body;

    if (!contribuabilId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "contribuabilId and items are required" },
        { status: 400 }
      );
    }

    await setTenantContext(citizen.tenantId);

    // Verify citizen has access to this contribuabil
    const link = await prisma.citizenContribuabilLink.findFirst({
      where: {
        citizenUserId: citizen.sub,
        contribuabilId,
        isActive: true,
      },
    });

    if (!link) {
      logger.warn({
        ...logContext,
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
        contribuabilId,
      }, "Checkout creation rejected because citizen lacks contribuabil access");
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const validatedSelection = await validateSelectedDebtsForContribuabil({
      tenantId: citizen.tenantId,
      contribuabilId,
      items,
    });

    const gateway = getPaymentGateway();
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const locale = "ro"; // Default locale for payment redirects

    const result = await gateway.initiatePayment({
      tenantId: citizen.tenantId,
      contribuabilId,
      citizenUserId: citizen.sub,
      items: validatedSelection.items,
      returnUrl: `${baseUrl}/${locale}/portal/plati/confirmare`,
      cancelUrl: `${baseUrl}/${locale}/portal/plati`,
    });

    // Store payment in DB
    await prisma.onlinePayment.create({
      data: {
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
        contribuabilId,
        suma: validatedSelection.totalAmount,
        status: "initiated",
        modalitate: "card",
        gatewayRef: result.gatewayRef,
        selectedDebts: validatedSelection.items as unknown as Prisma.InputJsonValue,
        expiresAt: result.expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      gatewayRef: result.gatewayRef,
    });
  } catch (error) {
    if (error instanceof SelectedDebtValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error({
      err: error,
      ...logContext,
      tenantId: citizen.tenantId,
      citizenUserId: citizen.sub,
    }, "Stripe checkout creation failed unexpectedly");
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
