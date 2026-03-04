import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { detectAnomalies } from "@/lib/ai/anomaly-detection";
import { setTenantContext } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "super_admin" && role !== "primaria_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await setTenantContext(session.user.tenantId);
    const anomalies = await detectAnomalies(session.user.tenantId);

    return NextResponse.json({ success: true, data: anomalies });
  } catch (error) {
    logger.error({ err: error }, "Error detecting anomalies");
    return NextResponse.json(
      { error: "Failed to detect anomalies" },
      { status: 500 }
    );
  }
}
