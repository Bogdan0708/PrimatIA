import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantScope } from "@/lib/db";
import { reversePayment } from "@/lib/payments/reversal";
import { logger, getRequestLogContext } from "@/lib/logger";
import { checkSharedRateLimit, createRateLimitExceededResponse } from "@/lib/rate-limit";
import type { Role } from "@/lib/constants";
import { paymentReversalSchema } from "@/lib/validations/portal";

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
    const parsed = paymentReversalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { plataId, reason } = parsed.data;

    return await withTenantScope(session.user.tenantId, async () => {
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
    });
  } catch (error) {
    logger.error({ err: error, ...logContext }, "Payment reversal failed unexpectedly");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
