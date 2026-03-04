import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth-utils";
import { verifyTOTPToken } from "@/lib/totp";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/totp/enable
 * Verify a TOTP code against the provided secret, then save it to the user's profile.
 * Body: { secret: string, token: string }
 */
export async function POST(request: NextRequest) {
  const session = await requireStaff();

  try {
    const { secret, token } = await request.json();

    if (!secret || !token) {
      return NextResponse.json(
        { error: "Secret and verification code are required" },
        { status: 400 }
      );
    }

    // Verify the code matches the secret before saving
    if (!verifyTOTPToken(secret, token)) {
      return NextResponse.json(
        { error: "Invalid verification code. Please try again." },
        { status: 400 }
      );
    }

    // Save the verified secret
    await prisma.tenantUser.update({
      where: { id: session.user.id },
      data: { totpSecret: secret },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("TOTP enable error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
