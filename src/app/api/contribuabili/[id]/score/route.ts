import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateComplianceScore } from "@/lib/scoring/compliance-score";
import { logger, getRequestLogContext } from "@/lib/logger";
import {
  checkSharedRateLimit,
  createRateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const logContext = getRequestLogContext(request);
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      logger.warn(
        { ...logContext, entityId: params.id },
        "Compliance score calculation rejected because staff session was missing"
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkSharedRateLimit({
      request,
      bucket: "staff-compliance-score",
      limit: 20,
      windowMs: 60_000,
      keySuffix: session.user.id,
    });
    if (!rateLimit.allowed) {
      return createRateLimitExceededResponse(rateLimit);
    }

    const result = await calculateComplianceScore(
      session.user.tenantId,
      params.id
    );

    return withRateLimitHeaders(
      NextResponse.json({ success: true, data: result }),
      rateLimit
    );
  } catch (error) {
    logger.error(
      {
        ...logContext,
        entityId: params.id,
        err: error,
      },
      "Compliance score calculation failed unexpectedly"
    );
    return NextResponse.json(
      { error: "Failed to calculate compliance score" },
      { status: 500 }
    );
  }
}
