import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth-utils";
import { generateTOTPSecret, generateTOTPKeyURI } from "@/lib/totp";
import { prisma } from "@/lib/db";

/**
 * GET /api/auth/totp/setup
 * Generate a new TOTP secret and QR code URI for the authenticated staff user.
 * Does NOT save the secret — the user must verify it first via /api/auth/totp/enable.
 */
export async function GET() {
  try {
    const session = await requireStaff();

    // Check if TOTP is already enabled
    const user = await prisma.tenantUser.findUnique({
      where: { id: session.user.id },
      select: { totpSecret: true, email: true },
    });

    if (user?.totpSecret) {
      return NextResponse.json(
        { error: "TOTP is already enabled. Disable it first to reconfigure." },
        { status: 400 }
      );
    }

    const secret = generateTOTPSecret();
    const keyURI = generateTOTPKeyURI(user!.email, secret);

    return NextResponse.json({ secret, keyURI });
  } catch (error) {
    console.error("TOTP setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
