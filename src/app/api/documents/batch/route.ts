import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { generateBatch } from "@/lib/documents/auto-generator";
import { logger, getRequestLogContext } from "@/lib/logger";
import {
  checkSharedRateLimit,
  createRateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  const tenantId = session.user.tenantId;
  const logContext = getRequestLogContext(request, {
    tenantId,
    userId: session.user.id,
  });
  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "staff-document-batch",
    limit: 10,
    windowMs: 60_000,
    keySuffix: session.user.id,
  });
  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const { type, filters } = body;

    if (!type || !["decizie", "somatie"].includes(type)) {
      return withRateLimitHeaders(
        NextResponse.json(
          { error: "type must be 'decizie' or 'somatie'" },
          { status: 400 }
        ),
        rateLimit
      );
    }

    const result = await generateBatch({ type, tenantId, filters });

    return withRateLimitHeaders(
      NextResponse.json({ ...result, success: true }),
      rateLimit
    );
  } catch (error: unknown) {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Batch document generation failed unexpectedly"
    );
    const message = error instanceof Error ? error.message : "Batch generation failed";
    return withRateLimitHeaders(
      NextResponse.json({ error: message }, { status: 500 }),
      rateLimit
    );
  }
}
