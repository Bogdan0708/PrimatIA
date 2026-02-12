import { auth } from "@/lib/auth";
import { prisma, setTenantContext } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// Payment Recording API
// POST /api/plati/record
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    // Require staff authentication
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const tenantId = session.user.tenantId;
    const userId = session.user.id;

    await setTenantContext(tenantId);

    // Parse request body
    const body = await request.json();
    const {
      contribuabilId,
      suma,
      modalitate,
      dataPlata,
      nrChitanta,
      nrDocument,
      nota,
    } = body;

    // Validate required fields
    if (!contribuabilId || !suma || !modalitate || !dataPlata) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: contribuabilId, suma, modalitate, dataPlata",
        },
        { status: 400 }
      );
    }

    if (Number(suma) <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be positive" },
        { status: 400 }
      );
    }

    // Verify the taxpayer exists
    const contribuabil = await prisma.contribuabil.findFirst({
      where: {
        id: contribuabilId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!contribuabil) {
      return NextResponse.json(
        { success: false, error: "Taxpayer not found" },
        { status: 404 }
      );
    }

    // Create the payment record
    const plata = await prisma.plata.create({
      data: {
        tenantId,
        contribuabilId,
        suma: Number(suma),
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
    await distributePayment(tenantId, plata.id, contribuabilId, Number(suma));

    return NextResponse.json(
      {
        success: true,
        id: plata.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error recording payment:", error);
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

async function distributePayment(
  tenantId: string,
  plataId: string,
  contribuabilId: string,
  amount: number
): Promise<number> {
  // Get all outstanding taxes, oldest first (per Cod Procedura Fiscala)
  const outstandingTaxes = await prisma.impozit.findMany({
    where: {
      tenantId,
      contribuabilId,
      status: { in: ["calculat", "emis", "partial_platit", "executare"] },
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
