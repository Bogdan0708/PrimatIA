import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyTotpCode } from "@/lib/totp";
import { encryptString } from "@/lib/crypto";
import { logError, logWarn, logInfo, getRequestLogContext } from "@/lib/logger";
import {
  auditStaffTotpChange,
  getStaffTotpStatus,
  getTotpSetupCookieName,
  requireAuthenticatedStaff,
  verifyPendingTotpSetupToken,
} from "@/app/api/auth/totp/_lib";

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  try {
    const session = await requireAuthenticatedStaff();
    if (!session) {
      logWarn({ message: "TOTP enable rejected: unauthorized", ...logContext });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const code = typeof body?.code === "string" ? body.code : (typeof body?.token === "string" ? body.token : "");
    if (!code) {
      logWarn({ message: "TOTP enable rejected: missing code", ...logContext });
      return NextResponse.json({ error: "Authenticator code is required" }, { status: 400 });
    }

    const pendingToken = request.cookies.get(getTotpSetupCookieName())?.value;
    if (!pendingToken) {
      logWarn({ message: "TOTP enable rejected: setup session expired", ...logContext });
      return NextResponse.json({ error: "TOTP setup session expired" }, { status: 400 });
    }

    const pending = await verifyPendingTotpSetupToken(pendingToken);
    if (pending.userId !== session.user.id || pending.tenantId !== session.user.tenantId) {
      logWarn({ message: "TOTP enable rejected: invalid setup session for user", ...logContext });
      return NextResponse.json({ error: "Invalid TOTP setup session" }, { status: 403 });
    }

    if (!verifyTotpCode(pending.secret, code)) {
      logWarn({ message: "TOTP enable rejected: invalid code", ...logContext });
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 400 });
    }

    const user = await getStaffTotpStatus(session.user.id, session.user.tenantId);
    if (!user) {
      logWarn({ message: "TOTP enable rejected: user not found", ...logContext });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Save the verified secret (encrypted at rest)
    await prisma.tenantUser.update({
      where: { id: session.user.id },
      data: { totpSecret: encryptString(pending.secret) },
    });

    await auditStaffTotpChange({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: "enable",
    });

    logInfo({
      message: "TOTP enabled successfully",
      ...logContext,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(getTotpSetupCookieName(), "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    logError({ message: "TOTP enable error", ...logContext }, error);
    return NextResponse.json({ error: "Failed to enable TOTP" }, { status: 500 });
  }
}
