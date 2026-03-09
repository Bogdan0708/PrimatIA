import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/constants";
import { verifyTotpCode } from "@/lib/totp";
import { decryptString } from "@/lib/crypto";

export interface StaffAuthResult {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  firstName: string;
  lastName: string;
}

async function registerFailedAttempt(userId: string, attempts: number) {
  await prisma.tenantUser.update({
    where: { id: userId },
    data: {
      loginAttempts: attempts,
      lockedUntil:
        attempts >= 5
          ? new Date(Date.now() + 15 * 60 * 1000)
          : undefined,
    },
  });
}

export async function authorizeStaffCredentials(params: {
  email: string;
  password: string;
  totpCode?: string | null;
  tenantId: string;
}): Promise<StaffAuthResult | null> {
  const user = await prisma.tenantUser.findFirst({
    where: {
      email: params.email,
      tenantId: params.tenantId,
      isActive: true,
      deletedAt: null,
    },
    include: {
      tenant: true,
    },
  });

  if (!user) return null;
  if (!["active", "trial"].includes(user.tenant.status)) return null;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return null;
  }

  const passwordValid = await compare(params.password, user.passwordHash);

  if (!passwordValid) {
    await registerFailedAttempt(user.id, user.loginAttempts + 1);
    return null;
  }

  if (user.totpSecret) {
    const decryptedTotpSecret = decryptString(user.totpSecret);
    const totpValid = params.totpCode
      ? verifyTotpCode(decryptedTotpSecret, params.totpCode)
      : false;

    if (!totpValid) {
      await registerFailedAttempt(user.id, user.loginAttempts + 1);
      return null;
    }
  }

  await prisma.tenantUser.update({
    where: { id: user.id },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    tenantId: user.tenantId,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}
