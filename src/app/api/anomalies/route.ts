import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { detectAnomalies } from "@/lib/ai/anomaly-detection";
import { withTenantScope } from "@/lib/db";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";
import {
  checkSharedRateLimit,
  createRateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      logWarn({
        message: "Anomaly detection rejected because staff session was missing",
        ...logContext,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkSharedRateLimit({
      request,
      bucket: "staff-anomalies",
      limit: 10,
      windowMs: 60_000,
      keySuffix: session.user.id,
    });
    if (!rateLimit.allowed) {
      return createRateLimitExceededResponse(rateLimit);
    }

    const role = session.user.role;
    if (role !== "super_admin" && role !== "primaria_admin") {
      logWarn({
        message: "Anomaly detection rejected because role lacked permission",
        ...logContext,
        tenantId: session.user.tenantId,
        userId: session.user.id,
        role,
      });
      return withRateLimitHeaders(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        rateLimit
      );
    }

    return await withTenantScope(session.user.tenantId, async () => {
      const anomalies = await detectAnomalies(session.user.tenantId);

      return withRateLimitHeaders(
        NextResponse.json({ success: true, data: anomalies }),
        rateLimit
      );
    });
  } catch (error) {
    logError(
      {
        message: "Anomaly detection failed unexpectedly",
        ...logContext,
      },
      error
    );
    return NextResponse.json({ error: "Failed to detect anomalies" }, { status: 500 });
  }
}
