import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateComplianceScore } from "@/lib/scoring/compliance-score";
import { logger, getRequestLogContext } from "@/lib/logger";

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

    const result = await calculateComplianceScore(
      session.user.tenantId,
      params.id
    );

    return NextResponse.json({ success: true, data: result });
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
    return NextResponse.json(
      { error: "Failed to calculate compliance score" },
      { status: 500 }
    );
  }
}
