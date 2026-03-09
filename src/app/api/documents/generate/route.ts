import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { generateDocument, type GeneratableDocType } from "@/lib/documents/auto-generator";
import { logger, getRequestLogContext } from "@/lib/logger";
import {
  checkSharedRateLimit,
  createRateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/rate-limit";

const VALID_TYPES: GeneratableDocType[] = [
  "decizie", "chitanta", "certificat", "somatie", "titlu_executoriu",
];

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  const tenantId = session.user.tenantId;
  const logContext = getRequestLogContext(request, {
    tenantId,
    userId: session.user.id,
  });
  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "staff-document-generate",
    limit: 20,
    windowMs: 60_000,
    keySuffix: session.user.id,
  });
  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const { type, entityId, options } = body;

    if (!type || !entityId) {
      return withRateLimitHeaders(
        NextResponse.json(
          { error: "type and entityId are required" },
          { status: 400 }
        ),
        rateLimit
      );
    }

    if (!VALID_TYPES.includes(type)) {
      return withRateLimitHeaders(
        NextResponse.json(
          { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
          { status: 400 }
        ),
        rateLimit
      );
    }

    const documentId = await generateDocument({
      type,
      entityId,
      tenantId,
      options,
    });

    return withRateLimitHeaders(
      NextResponse.json({ success: true, documentId }),
      rateLimit
    );
  } catch (error: unknown) {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Document generation failed unexpectedly"
    );
    const message = error instanceof Error ? error.message : "Generation failed";
    return withRateLimitHeaders(NextResponse.json({ error: message }, { status: 500 }), rateLimit);
  }
}
