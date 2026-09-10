import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateRevenueForecast } from "@/lib/ai/revenue-forecast";
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
        message: "Revenue forecast generation rejected because staff session was missing",
        ...logContext,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkSharedRateLimit({
      request,
      bucket: "staff-revenue-forecast",
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
        message: "Revenue forecast generation rejected because role lacked permission",
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

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam) : undefined;

    if (yearParam && (isNaN(year!) || year! < 2000 || year! > 2100)) {
      return withRateLimitHeaders(
        NextResponse.json({ error: "Invalid year parameter" }, { status: 400 }),
        rateLimit
      );
    }

    return await withTenantScope(session.user.tenantId, async () => {
      const forecast = await generateRevenueForecast(session.user.tenantId, year);

      return withRateLimitHeaders(
        NextResponse.json({ success: true, data: forecast }),
        rateLimit
      );
    });
  } catch (error) {
    logError(
      {
        message: "Revenue forecast generation failed unexpectedly",
        ...logContext,
      },
      error
    );
    return NextResponse.json({ error: "Failed to generate forecast" }, { status: 500 });
  }
}
