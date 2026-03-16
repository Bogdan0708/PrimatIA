import { auth } from "@/lib/auth";
import { prisma, withTenantScope } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { plataSchema } from "@/lib/validations";
import { generateDocumentNumber } from "@/lib/formatting";
import { Prisma } from "@prisma/client";
import type { Role } from "@/lib/constants";
import { logger, getRequestLogContext } from "@/lib/logger";
import { checkSharedRateLimit, createRateLimitExceededResponse, withRateLimitHeaders } from "@/lib/rate-limit";

// Roles allowed to record payments
const PAYMENT_ROLES: Role[] = ["super_admin", "primaria_admin", "operator", "contabil"];

// ============================================================================
// Payment Recording API
// POST /api/plati/record
// ============================================================================

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  try {
    const rateLimit = await checkSharedRateLimit({
      request,
      bucket: "payments-record",
      limit: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitExceededResponse(rateLimit);
    }

    const session = await auth();

    // Require staff authentication
    if (!session?.user?.tenantId || !session?.user?.id) {
      logger.warn({
        ...logContext,
      }, "Payment recording rejected because staff session was missing");
      return withRateLimitHeaders(NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ), rateLimit);
    }

    // Role check: only staff roles can record payments
    const userRole = session.user.role as Role;
    if (!PAYMENT_ROLES.includes(userRole)) {
      logger.warn({
        ...logContext,
        tenantId: session.user.tenantId,
        userId: session.user.id,
        role: userRole,
      }, "Payment recording rejected because role lacked permission");
      return withRateLimitHeaders(NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      ), rateLimit);
    }

    const tenantId = session.user.tenantId;
    const userId = session.user.id;

    // Validate request body with Zod schema
    const body = await request.json();
    const parsed = plataSchema.safeParse(body);
    if (!parsed.success) {
      return withRateLimitHeaders(NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((e: { message: string }) => e.message).join("; "),
        },
        { status: 400 }
      ), rateLimit);
    }

    const { contribuabilId, suma, modalitate, dataPlata, nrDocument, nota, targetImpozitIds } = parsed.data;
    let { nrChitanta } = parsed.data;

    return await withTenantScope(tenantId, async () => {
      // Verify the taxpayer exists
      const contribuabil = await prisma.contribuabil.findFirst({
        where: {
          id: contribuabilId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!contribuabil) {
        return withRateLimitHeaders(NextResponse.json(
          { success: false, error: "Taxpayer not found" },
          { status: 404 }
        ), rateLimit);
      }

      // Auto-generate receipt number for cash payments if not provided
      if (modalitate === "numerar" && !nrChitanta) {
        const year = new Date(dataPlata).getFullYear();
        const seqResult = await prisma.$queryRaw<Array<{ next_val: bigint }>>(
          Prisma.sql`INSERT INTO "ChitantaSequence" ("tenantId", "year", "currentVal")
                     VALUES (${tenantId}::uuid, ${year}, 1)
                     ON CONFLICT ("tenantId", "year")
                     DO UPDATE SET "currentVal" = "ChitantaSequence"."currentVal" + 1
                     RETURNING "currentVal" AS next_val`
        );
        const seqNum = Number(seqResult[0].next_val);
        nrChitanta = generateDocumentNumber("CHT", year, seqNum);
      }

      // Create the payment record
      const plata = await prisma.plata.create({
        data: {
          tenantId,
          contribuabilId,
          suma,
          dataPlata: new Date(dataPlata),
          modalitate,
          nrChitanta: nrChitanta || undefined,
          nrDocument: nrDocument || undefined,
          nota: nota || undefined,
          inregistratDeId: userId,
          distribuit: false,
        },
      });

      // Auto-distribute payment to outstanding debts
      await distributePayment(tenantId, plata.id, contribuabilId, suma, targetImpozitIds);

      // Audit log for payment creation
      await prisma.auditLog.create({
        data: {
          tenantId,
          action: "create",
          entityType: "plata",
          entityId: plata.id,
          newValues: {
            suma,
            modalitate,
            contribuabilId,
            nrChitanta: nrChitanta || null,
            dataPlata: new Date(dataPlata).toISOString(),
          },
          userId,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
          userAgent: request.headers.get("user-agent") || null,
        },
      });

      return withRateLimitHeaders(NextResponse.json(
        {
          success: true,
          id: plata.id,
          nrChitanta: nrChitanta || null,
        },
        { status: 201 }
      ), rateLimit);
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        ...logContext,
      },
      "Payment recording failed unexpectedly"
    );
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Payment Auto-Distribution Logic
// Per Cod Procedura Fiscala: oldest debts first, penalties before principal
// ============================================================================

/**
 * Distribute a payment across outstanding taxes.
 * Per Cod Procedura Fiscala Art. 165:
 * - If targetImpozitIds is provided, taxpayer designates which debts to pay.
 * - If not provided, FIFO applies: oldest debts first, penalties before principal.
 */
async function distributePayment(
  tenantId: string,
  plataId: string,
  contribuabilId: string,
  amount: number,
  targetImpozitIds?: string[]
): Promise<number> {
  const outstandingTaxes = await prisma.impozit.findMany({
    where: {
      tenantId,
      contribuabilId,
      status: { in: ["calculat", "emis", "partial_platit", "executare"] },
      ...(targetImpozitIds && targetImpozitIds.length > 0
        ? { id: { in: targetImpozitIds } }
        : {}),
    },
    orderBy: [{ fiscalYear: "asc" }, { rata1Scadenta: "asc" }],
  });

  let remaining = amount;
  const distributions: Array<{
    impozitId: string;
    sumaDebit: number;
    sumaPenalitati: number;
  }> = [];

  for (const tax of outstandingTaxes) {
    if (remaining <= 0) break;

    const totalDebt = Number(tax.sumaDatorata);
    const totalPenalties = Number(tax.sumaPenalitati);
    const alreadyPaid = Number(tax.sumaPlatita);
    const totalOwed = totalDebt + totalPenalties;
    const outstanding = totalOwed - alreadyPaid;

    if (outstanding <= 0) continue;

    const toApply = Math.min(remaining, outstanding);

    // Apply to penalties first per fiscal code, then to principal
    // Calculate how much of alreadyPaid has gone to penalties vs principal
    const penaltiesCoveredSoFar = Math.min(alreadyPaid, totalPenalties);
    const penaltiesRemaining = totalPenalties - penaltiesCoveredSoFar;

    const toPenalties = Math.min(toApply, Math.max(0, penaltiesRemaining));
    const toDebit = toApply - toPenalties;

    distributions.push({
      impozitId: tax.id,
      sumaDebit: toDebit,
      sumaPenalitati: toPenalties,
    });

    // Update the tax record
    const newPaid = alreadyPaid + toApply;
    const newStatus =
      newPaid >= totalOwed
        ? "platit"
        : newPaid > 0
          ? "partial_platit"
          : tax.status;

    await prisma.impozit.update({
      where: { id: tax.id },
      data: {
        sumaPlatita: newPaid,
        status: newStatus,
      },
    });

    remaining -= toApply;
  }

  // Create distribution records
  if (distributions.length > 0) {
    await prisma.plataDistributie.createMany({
      data: distributions.map((d) => ({
        tenantId,
        plataId,
        impozitId: d.impozitId,
        sumaDebit: d.sumaDebit,
        sumaPenalitati: d.sumaPenalitati,
      })),
    });
  }

  // Mark payment as distributed
  await prisma.plata.update({
    where: { id: plataId },
    data: { distribuit: true },
  });

  // Return any remainder (overpayment / credit)
  return Math.max(0, remaining);
}
