import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import {
  SelectedDebtValidationError,
  validateSelectedDebtsForContribuabil,
} from "@/lib/payments/selected-debts";
import { getRequestLogContext, logError, logWarn } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    logWarn({
      message: "Bank transfer initiation rejected because citizen was not authenticated",
      ...logContext,
    });
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { contribuabilId, items } = body;

    if (!contribuabilId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "contribuabilId and items are required" },
        { status: 400 }
      );
    }

    await setTenantContext(citizen.tenantId);

    // Verify citizen has access to this contribuabil
    const link = await prisma.citizenContribuabilLink.findFirst({
      where: {
        citizenUserId: citizen.sub,
        contribuabilId,
        isActive: true,
      },
    });

    if (!link) {
      logWarn({
        message: "Bank transfer initiation rejected because citizen lacks contribuabil access",
        ...logContext,
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
        contribuabilId,
      });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const validatedSelection = await validateSelectedDebtsForContribuabil({
      tenantId: citizen.tenantId,
      contribuabilId,
      items,
    });

    // Generate unique bank transfer reference
    const year = new Date().getFullYear();
    const random = randomBytes(4).toString("hex").toUpperCase();
    const referenceCode = `PRM-${contribuabilId.slice(0, 8)}-${year}-${random}`;

    // Store in DB as initiated bank transfer
    await prisma.onlinePayment.create({
      data: {
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
        contribuabilId,
        suma: validatedSelection.totalAmount,
        status: "pending",
        modalitate: "virament",
        gatewayRef: referenceCode,
        selectedDebts: validatedSelection.items as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Get tenant details for IBAN display
    const tenant = await prisma.tenant.findUnique({
      where: { id: citizen.tenantId },
      select: { name: true, settings: true },
    });

    // Bank details from tenant settings or defaults
    const settings = (tenant?.settings as Record<string, unknown>) || {};
    const iban = (settings.iban as string) || "RO49 AAAA 1B31 0075 9384 0000";
    const bankName = (settings.bankName as string) || "Trezoreria Municipiului";
    const beneficiary = tenant?.name || "Primăria";

    return NextResponse.json({
      success: true,
      referenceCode,
      totalAmount: validatedSelection.totalAmount,
      bankDetails: {
        iban,
        bankName,
        beneficiary,
        referenceCode,
      },
    });
  } catch (error) {
    if (error instanceof SelectedDebtValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logError(
      {
        message: "Bank transfer initiation failed unexpectedly",
        ...logContext,
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
      },
      error
    );
    return NextResponse.json(
      { error: "Failed to generate bank transfer reference" },
      { status: 500 }
    );
  }
}
