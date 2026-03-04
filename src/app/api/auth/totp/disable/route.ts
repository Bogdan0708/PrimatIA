import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth-utils";
import { verifyTOTPToken } from "@/lib/totp";
import { decryptString } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/totp/disable
 * Disable TOTP for the current user. Requires a valid TOTP code to confirm.
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  const session = await requireStaff();

  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Current TOTP code is required to disable MFA" },
        { status: 400 }
      );
    }

    const user = await prisma.tenantUser.findUnique({
      where: { id: session.user.id },
      select: { totpSecret: true },
    });

    if (!user?.totpSecret) {
      return NextResponse.json(
        { error: "TOTP is not enabled" },
        { status: 400 }
      );
    }

    if (!verifyTOTPToken(decryptString(user.totpSecret), token)) {
      return NextResponse.json(
        { error: "Invalid TOTP code" },
        { status: 400 }
      );
    }

    await prisma.tenantUser.update({
      where: { id: session.user.id },
      data: { totpSecret: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "TOTP disable error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
