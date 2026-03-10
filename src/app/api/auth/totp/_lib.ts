import { SignJWT, jwtVerify } from "jose";
import { auth } from "@/lib/auth";
import { prisma, withTenantScope } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { Role } from "@/lib/constants";

const STAFF_TOTP_COOKIE = "staff-totp-setup";
const STAFF_ROLES = new Set<Role>([
  "super_admin",
  "primaria_admin",
  "operator",
  "contabil",
]);

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET or AUTH_SECRET must be configured");
  }
  return new TextEncoder().encode(secret);
}

export function getTotpSetupCookieName() {
  return STAFF_TOTP_COOKIE;
}

export async function requireAuthenticatedStaff() {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId || !STAFF_ROLES.has(session.user.role)) {
    return null;
  }

  return session;
}

export async function createPendingTotpSetupToken(params: {
  userId: string;
  tenantId: string;
  secret: string;
}) {
  return new SignJWT({
    purpose: "staff-totp-setup",
    userId: params.userId,
    tenantId: params.tenantId,
    secret: params.secret,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getJwtSecret());
}

export async function verifyPendingTotpSetupToken(token: string) {
  const verified = await jwtVerify(token, getJwtSecret());
  const payload = verified.payload;

  if (
    payload.purpose !== "staff-totp-setup" ||
    !payload.userId ||
    !payload.tenantId ||
    !payload.secret
  ) {
    throw new Error("Invalid TOTP setup token");
  }

  return {
    purpose: payload.purpose,
    userId: String(payload.userId),
    tenantId: String(payload.tenantId),
    secret: String(payload.secret),
  };
}

export async function getStaffTotpStatus(userId: string, tenantId: string) {
  return withTenantScope(tenantId, () =>
    prisma.tenantUser.findFirst({
      where: { id: userId, tenantId, deletedAt: null, isActive: true },
      select: { id: true, email: true, totpSecret: true },
    })
  );
}

export async function auditStaffTotpChange(params: {
  tenantId: string;
  userId: string;
  action: "enable" | "disable";
}) {
  await writeAuditLog({
    tenantId: params.tenantId,
    userId: params.userId,
    action: params.action,
    entityType: "tenant_user_totp",
    entityId: params.userId,
    newValues: { enabled: params.action === "enable" },
  });
}
