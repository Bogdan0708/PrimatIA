import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { generateBatch } from "@/lib/documents/auto-generator";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  const tenantId = session.user.tenantId;

  try {
    const body = await request.json();
    const { type, filters } = body;

    if (!type || !["decizie", "somatie"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'decizie' or 'somatie'" },
        { status: 400 }
      );
    }

    const result = await generateBatch({ type, tenantId, filters });

    return NextResponse.json({ ...result, success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Batch generation error:");
    const message = error instanceof Error ? error.message : "Batch generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
