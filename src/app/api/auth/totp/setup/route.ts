import { NextRequest, NextResponse } from "next/server";
import {
  createPendingTotpSetupToken,
  getStaffTotpStatus,
  getTotpSetupCookieName,
  requireAuthenticatedStaff,
} from "@/app/api/auth/totp/_lib";
import { buildOtpAuthUrl, formatTotpSecret, generateTotpSecret } from "@/lib/totp";
import { logError, logWarn, logInfo, getRequestLogContext } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  try {
    const session = await requireAuthenticatedStaff();
    if (!session) {
      logWarn({ message: "TOTP setup rejected: unauthorized", ...logContext });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getStaffTotpStatus(session.user.id, session.user.tenantId);
    if (!user) {
      logWarn({ message: "TOTP setup rejected: user not found", ...logContext });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.totpSecret) {
      logWarn({ message: "TOTP setup rejected: TOTP already enabled", ...logContext });
      return NextResponse.json({ error: "TOTP already enabled" }, { status: 409 });
    }

    const secret = generateTotpSecret();
    const issuer = "PrimarIA";
    const otpauthUrl = buildOtpAuthUrl({
      secret,
      issuer,
      accountName: user.email,
    });

    const token = await createPendingTotpSetupToken({
      userId: session.user.id,
      tenantId: session.user.tenantId,
      secret,
    });

    const response = NextResponse.json({
      success: true,
      secret,
      formattedSecret: formatTotpSecret(secret),
      issuer,
      accountName: user.email,
      otpauthUrl,
      expiresInSeconds: 600,
    });

    response.cookies.set(getTotpSetupCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 10 * 60,
    });

    logInfo({
      message: "TOTP setup initiated",
      ...logContext,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    });

    return response;
  } catch (error) {
    logError({ message: "TOTP setup error", ...logContext }, error);
    return NextResponse.json({ error: "Failed to start TOTP setup" }, { status: 500 });
  }
}
