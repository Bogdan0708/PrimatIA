import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { getPaymentGateway } from "@/lib/payments/payment-gateway";
import { prisma, setTenantContext } from "@/lib/db";

export async function POST(request: NextRequest) {
  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
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
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const gateway = getPaymentGateway();
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const result = await gateway.initiatePayment({
      tenantId: citizen.tenantId,
      contribuabilId,
      citizenUserId: citizen.sub,
      items,
      returnUrl: `${baseUrl}/portal/plati/confirmare`,
      cancelUrl: `${baseUrl}/portal/plati`,
    });

    // Store payment in DB
    const totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);

    await prisma.onlinePayment.create({
      data: {
        tenantId: citizen.tenantId,
        citizenUserId: citizen.sub,
        contribuabilId,
        suma: totalAmount,
        status: "initiated",
        gatewayRef: result.gatewayRef,
        selectedDebts: items,
        expiresAt: result.expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      gatewayRef: result.gatewayRef,
    });
  } catch (error) {
    console.error("Payment initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate payment" },
      { status: 500 }
    );
  }
}
