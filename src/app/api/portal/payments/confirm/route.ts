import { NextRequest, NextResponse } from "next/server";
import { getGhiseulMockProvider } from "@/lib/payments/payment-gateway";
import { prisma, setTenantContext } from "@/lib/db";
import { generateDocumentNumber } from "@/lib/formatting";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gatewayRef } = body;

    if (!gatewayRef) {
      return NextResponse.json(
        { error: "gatewayRef is required" },
        { status: 400 }
      );
    }

    const mock = getGhiseulMockProvider();
    const confirmed = await mock.confirmMockPayment(gatewayRef);

    if (!confirmed) {
      return NextResponse.json(
        { error: "Payment not found or already processed" },
        { status: 400 }
      );
    }

    // Update DB record
    const onlinePayment = await prisma.onlinePayment.findFirst({
      where: { gatewayRef },
    });

    if (!onlinePayment) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      );
    }

    await setTenantContext(onlinePayment.tenantId);

    // Generate chitanță number
    const year = new Date().getFullYear();
    const paymentCount = await prisma.plata.count({
      where: { tenantId: onlinePayment.tenantId },
    });
    const nrChitanta = generateDocumentNumber("CHT", year, paymentCount + 1);

    // Create actual Plata record
    const plata = await prisma.plata.create({
      data: {
        tenantId: onlinePayment.tenantId,
        contribuabilId: onlinePayment.contribuabilId,
        suma: onlinePayment.suma,
        dataPlata: new Date(),
        modalitate: "card",
        nrChitanta,
        ghiseulRoRef: gatewayRef,
        distribuit: false,
      },
    });

    // Update online payment status
    await prisma.onlinePayment.update({
      where: { id: onlinePayment.id },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
        plataId: plata.id,
        gatewayResponse: { confirmed: true, transactionId: `TXN-${gatewayRef}` },
      },
    });

    // Auto-distribute payment to debts
    const selectedDebts = onlinePayment.selectedDebts as Array<{ impozitId: string; amount: number }>;
    if (selectedDebts && selectedDebts.length > 0) {
      for (const debt of selectedDebts) {
        await prisma.plataDistributie.create({
          data: {
            tenantId: onlinePayment.tenantId,
            plataId: plata.id,
            impozitId: debt.impozitId,
            sumaDebit: debt.amount,
            sumaPenalitati: 0,
          },
        });

        const impozit = await prisma.impozit.findUnique({
          where: { id: debt.impozitId },
        });

        if (impozit) {
          const newPaid = Number(impozit.sumaPlatita) + debt.amount;
          const totalOwed = Number(impozit.sumaDatorata);
          const newStatus = newPaid >= totalOwed ? "platit" : "partial_platit";

          await prisma.impozit.update({
            where: { id: debt.impozitId },
            data: {
              sumaPlatita: newPaid,
              status: newStatus,
            },
          });
        }
      }

      await prisma.plata.update({
        where: { id: plata.id },
        data: { distribuit: true },
      });
    }

    // Generate chitanță document
    await prisma.document.create({
      data: {
        tenantId: onlinePayment.tenantId,
        contribuabilId: onlinePayment.contribuabilId,
        tip: "chitanta",
        numarDocument: nrChitanta,
        dataDocument: new Date(),
        dataJson: {
          plataId: plata.id,
          suma: Number(onlinePayment.suma),
          modalitate: "card",
          gatewayRef,
          items: selectedDebts,
        },
        status: "generat",
      },
    });

    return NextResponse.json({ success: true, plataId: plata.id });
  } catch (error) {
    console.error("Payment confirmation error:", error);
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
}
