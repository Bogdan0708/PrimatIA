import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { setTenantContext } from "@/lib/db";
import { reversePayment } from "@/lib/payments/reversal";

export async function POST(request: NextRequest) {
  const session = await requireAdmin();

  try {
    const { plataId, reason } = await request.json();

    if (!plataId || !reason) {
      return NextResponse.json(
        { error: "Payment ID and reason are required" },
        { status: 400 }
      );
    }

    await setTenantContext(session.user.tenantId);

    const result = await reversePayment({
      plataId,
      tenantId: session.user.tenantId,
      reversedById: session.user.id,
      reason,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      stornoPlataId: result.stornoPlataId,
    });
  } catch (error) {
    console.error("Payment reversal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
