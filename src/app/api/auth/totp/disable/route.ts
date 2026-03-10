import { NextRequest, NextResponse } from "next/server";
import { prisma, setTenantContext } from "@/lib/db";
import { verifyTotpCode } from "@/lib/totp";
import { decryptString } from "@/lib/crypto";
import { logError, logWarn, logInfo, getRequestLogContext } from "@/lib/logger";
import {
  auditStaffTotpChange,
  getStaffTotpStatus,
  requireAuthenticatedStaff,
} from "@/app/api/auth/totp/_lib";

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  try {
    const session = await requireAuthenticatedStaff();
    if (!session) {
      logWarn({ message: "TOTP disable rejected: unauthorized", ...logContext });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await setTenantContext(session.user.tenantId);

    const body = await request.json();
    const code = typeof body?.code === "string" ? body.code : (typeof body?.token === "string" ? body.token : "");
    if (!code) {
      logWarn({ message: "TOTP disable rejected: missing code", ...logContext });
      return NextResponse.json({ error: "Authenticator code is required" }, { status: 400 });
    }

    const user = await getStaffTotpStatus(session.user.id, session.user.tenantId);
    if (!user) {
      logWarn({ message: "TOTP disable rejected: user not found", ...logContext });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!user.totpSecret) {
      logWarn({ message: "TOTP disable rejected: TOTP not enabled", ...logContext });
      return NextResponse.json({ error: "TOTP is not enabled" }, { status: 400 });
    }

    const decryptedSecret = decryptString(user.totpSecret);
    if (!verifyTotpCode(decryptedSecret, code)) {
      logWarn({ message: "TOTP disable rejected: invalid code", ...logContext });
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 400 });
    }

    await prisma.tenantUser.update({
      where: { id: session.user.id },
      data: { totpSecret: null },
    });

    await auditStaffTotpChange({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: "disable",
    });

    logInfo({
      message: "TOTP disabled successfully",
      ...logContext,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({ message: "TOTP disable error", ...logContext }, error);
    return NextResponse.json({ error: "Failed to disable TOTP" }, { status: 500 });
  }
}
