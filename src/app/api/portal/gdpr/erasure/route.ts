import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { prisma, withTenantScope } from "@/lib/db";
import {
  checkSharedRateLimit,
  createRateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/rate-limit";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";

/**
 * POST /api/portal/gdpr/erasure
 *
 * GDPR Art. 17 — Right to Erasure.
 * Creates an erasure request. Admin review is required because Romanian
 * tax law (L207/2015) mandates 5-year retention for fiscal records.
 *
 * Immediate actions (on request creation):
 *   - Delete notifications (Notificare) — per-citizen, safe to delete
 *
 * Deferred actions (after admin approval):
 *   - Delete/withdraw consents (shared per contribuabil — requires sole-ownership check)
 *   - Anonymize contribuabil PII (name → "ȘTERGERE GDPR", CNP → null)
 *   - Deactivate citizen account
 *   - Retain tax records and payments (legal obligation)
 */
export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);

  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    logWarn({
      message: "GDPR erasure request rejected: not authenticated",
      ...logContext,
    });
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limit per citizen (not per IP) — 1 erasure request per hour
  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "portal-gdpr-erasure",
    limit: 1,
    windowMs: 60 * 60 * 1000,
    keySuffix: citizen.sub,
  });
  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined;
    } catch {
      // No body is fine — reason is optional
    }

    const result = await withTenantScope(citizen.tenantId, async () => {
      // Check for existing pending request
      const existing = await prisma.gdprErasureRequest.findFirst({
        where: {
          citizenUserId: citizen.sub,
          tenantId: citizen.tenantId,
          status: { in: ["pending", "approved"] },
        },
      });

      if (existing) {
        return {
          alreadyExists: true,
          requestId: existing.id,
          status: existing.status,
        };
      }

      // Create the erasure request
      const erasureRequest = await prisma.gdprErasureRequest.create({
        data: {
          tenantId: citizen.tenantId,
          citizenUserId: citizen.sub,
          reason,
          status: "pending",
        },
      });

      // Immediate: delete only data owned solely by this citizen user.
      // Consents (Consimtamant) are keyed by contribuabilId and shared
      // across all citizens linked to that taxpayer — deleting them here
      // would revoke consent for other users. Consent cleanup is deferred
      // to admin review, which can check for sole-ownership safely.

      // Notifications are per-citizenUserId, safe to delete immediately.
      const deletedNotifications = await prisma.notificare.deleteMany({
        where: { citizenUserId: citizen.sub },
      });

      return {
        alreadyExists: false,
        requestId: erasureRequest.id,
        status: erasureRequest.status,
        immediateActions: {
          notificationsDeleted: deletedNotifications.count,
        },
      };
    });

    if (result.alreadyExists) {
      return withRateLimitHeaders(
        NextResponse.json({
          success: true,
          message: "O cerere de ștergere este deja în curs de procesare",
          requestId: result.requestId,
          status: result.status,
        }),
        rateLimit
      );
    }

    return withRateLimitHeaders(
      NextResponse.json({
        success: true,
        message:
          "Cererea de ștergere a fost înregistrată. Datele fiscale sunt păstrate " +
          "conform L207/2015 (5 ani). Notificările au fost șterse imediat. " +
          "Consimțămintele și datele personale vor fi procesate după revizuirea administratorului.",
        requestId: result.requestId,
        immediateActions: result.immediateActions,
      }),
      rateLimit
    );
  } catch (error) {
    logError(
      {
        message: "GDPR erasure request failed",
        ...logContext,
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
      },
      error
    );
    return withRateLimitHeaders(
      NextResponse.json({ error: "Eroare la procesarea cererii de ștergere" }, { status: 500 }),
      rateLimit
    );
  }
}
