import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { strongPasswordSchema } from "@/lib/validations";

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Token and password are required"),
  password: strongPasswordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid reset payload" },
        { status: 400 }
      );
    }
    const { token, password } = parsed.data;

    const ok = await resetPasswordWithToken({
      token,
      newPassword: password,
      userType: "staff",
    });

    if (!ok) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Staff reset-password failed:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
