import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { detectAnomalies } from "@/lib/ai/anomaly-detection";
import { setTenantContext } from "@/lib/db";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";

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

    const role = session.user.role;
    if (role !== "super_admin" && role !== "primaria_admin") {
      logWarn({
        message: "Anomaly detection rejected because role lacked permission",
        ...logContext,
        tenantId: session.user.tenantId,
        userId: session.user.id,
        role,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await setTenantContext(session.user.tenantId);
    const anomalies = await detectAnomalies(session.user.tenantId);

    return NextResponse.json({ success: true, data: anomalies });
  } catch (error) {
    logError(
      {
        message: "Anomaly detection failed unexpectedly",
        ...logContext,
      },
      error
    );
    return NextResponse.json(
      { error: "Failed to detect anomalies" },
      { status: 500 }
    );
  }
}
