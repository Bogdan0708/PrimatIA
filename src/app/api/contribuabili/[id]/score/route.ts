import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateComplianceScore } from "@/lib/scoring/compliance-score";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await calculateComplianceScore(
      session.user.tenantId,
      params.id
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, "Error calculating compliance score");
    return NextResponse.json(
      { error: "Failed to calculate compliance score" },
      { status: 500 }
    );
  }
}
