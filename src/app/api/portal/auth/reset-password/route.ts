import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { strongPasswordSchema } from "@/lib/validations";
import { checkSharedRateLimit, createRateLimitExceededResponse, withRateLimitHeaders } from "@/lib/rate-limit";
import { getRequestLogContext, logError } from "@/lib/logger";

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Token and password are required"),
  password: strongPasswordSchema,
});

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);

  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "reset-password",
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return withRateLimitHeaders(NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid reset payload" },
        { status: 400 }
      ), rateLimit);
    }
    const { token, password } = parsed.data;

    const ok = await resetPasswordWithToken({
      token,
      newPassword: password,
      userType: "citizen",
    });

    if (!ok) {
      return withRateLimitHeaders(NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      ), rateLimit);
    }

    return withRateLimitHeaders(NextResponse.json({ success: true }), rateLimit);
  } catch (error) {
    logError(
      {
        message: "Citizen reset-password failed unexpectedly",
        ...logContext,
      },
      error
    );
    return withRateLimitHeaders(NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    ), rateLimit);
  }
}
