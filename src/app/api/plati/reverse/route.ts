import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setTenantContext } from "@/lib/db";
import { reversePayment } from "@/lib/payments/reversal";
import { logger, getRequestLogContext } from "@/lib/logger";
import { checkSharedRateLimit, createRateLimitExceededResponse } from "@/lib/rate-limit";
import type { Role } from "@/lib/constants";

const PAYMENT_ROLES: Role[] = ["super_admin", "primaria_admin", "operator", "contabil"];

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  
  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "payments-reverse",
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  const session = await auth();

  if (!session?.user?.tenantId || !session?.user?.id) {
    logger.warn({ ...logContext }, "Payment reversal rejected: unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!PAYMENT_ROLES.includes(session.user.role as Role)) {
    logger.warn({ 
        ...logContext,
        tenantId: session.user.tenantId,
        userId: session.user.id,
        role: session.user.role
    }, "Payment reversal rejected: insufficient permissions");
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { plataId, reason } = body;

    if (!plataId || !reason) {
      return NextResponse.json(
        { error: "Payment ID and reason are required" },
        { status: 400 }
      );
    }

    await setTenantContext(session.user.tenantId);

    const result = await reversePayment({
      plataId,
      tenantId: session.user.tenantId,
      reversedById: session.user.id,
      reason,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      stornoPlataId: result.stornoPlataId,
    });
  } catch (error) {
    logger.error({ err: error, ...logContext }, "Payment reversal failed unexpectedly");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
