import { NextRequest, NextResponse } from "next/server";
import { getGhiseulMockProvider } from "@/lib/payments/ghiseul-mock";
import { prisma, setTenantContext } from "@/lib/db";

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

    // Create actual Plata record
    const plata = await prisma.plata.create({
      data: {
        tenantId: onlinePayment.tenantId,
        contribuabilId: onlinePayment.contribuabilId,
        suma: onlinePayment.suma,
        dataPlata: new Date(),
        modalitate: "ghiseul_ro",
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

    return NextResponse.json({ success: true, plataId: plata.id });
  } catch (error) {
    console.error("Payment confirmation error:", error);
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
}
