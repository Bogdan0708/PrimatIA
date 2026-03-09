import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateMonthlyReport } from "@/lib/reports/monthly-report";
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
        message: "Monthly report generation rejected because staff session was missing",
        ...logContext,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkSharedRateLimit({
      request,
      bucket: "staff-monthly-report",
      limit: 20,
      windowMs: 60_000,
      keySuffix: session.user.id,
    });
    if (!rateLimit.allowed) {
      return createRateLimitExceededResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return withRateLimitHeaders(
        NextResponse.json(
          { error: "Invalid year or month parameter" },
          { status: 400 }
        ),
        rateLimit
      );
    }

    const report = await generateMonthlyReport({
      tenantId: session.user.tenantId,
      year,
      month,
    });

    return withRateLimitHeaders(
      NextResponse.json({ success: true, data: report }),
      rateLimit
    );
  } catch (error) {
    logError(
      {
        message: "Monthly report generation failed unexpectedly",
        ...logContext,
      },
      error
    );
    return NextResponse.json({ error: "Failed to generate monthly report" }, { status: 500 });
  }
}
