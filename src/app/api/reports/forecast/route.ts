import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateRevenueForecast } from "@/lib/ai/revenue-forecast";
import { setTenantContext } from "@/lib/db";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";

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

    const role = session.user.role;
    if (role !== "super_admin" && role !== "primaria_admin") {
      logWarn({
        message: "Revenue forecast generation rejected because role lacked permission",
        ...logContext,
        tenantId: session.user.tenantId,
        userId: session.user.id,
        role,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam) : undefined;

    if (yearParam && (isNaN(year!) || year! < 2000 || year! > 2100)) {
      return NextResponse.json({ error: "Invalid year parameter" }, { status: 400 });
    }

    await setTenantContext(session.user.tenantId);
    const forecast = await generateRevenueForecast(session.user.tenantId, year);

    return NextResponse.json({ success: true, data: forecast });
  } catch (error) {
    logError(
      {
        message: "Revenue forecast generation failed unexpectedly",
        ...logContext,
      },
      error
    );
    return NextResponse.json(
      { error: "Failed to generate forecast" },
      { status: 500 }
    );
  }
}
