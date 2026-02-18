import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";

/**
 * Authenticate a citizen user by email and password.
 * Returns citizen data on success, null on failure.
 */
export async function authenticateCitizen(
  email: string,
  password: string,
  tenantId: string
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true },
  });
  if (!tenant || !["active", "trial"].includes(tenant.status)) {
    return null;
  }

  const citizen = await prisma.citizenUser.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });

  if (!citizen || !citizen.isActive || !citizen.emailVerified || citizen.deletedAt) {
    return null;
  }

  if (citizen.lockedUntil && citizen.lockedUntil > new Date()) {
    return null;
  }

  const passwordValid = await compare(password, citizen.passwordHash);

  if (!passwordValid) {
    const attempts = citizen.loginAttempts + 1;
    await prisma.citizenUser.update({
      where: { id: citizen.id },
      data: {
        loginAttempts: attempts,
        lockedUntil:
          attempts >= 5
            ? new Date(Date.now() + 15 * 60 * 1000)
            : undefined,
      },
    });
    return null;
  }

  await prisma.citizenUser.update({
    where: { id: citizen.id },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  return {
    id: citizen.id,
    email: citizen.email,
    tenantId: citizen.tenantId,
    firstName: citizen.firstName,
    lastName: citizen.lastName,
  };
}

/**
 * Register a new citizen account.
 * Matches CNP/CUI against existing contribuabili.
 */
export async function registerCitizen(params: {
  tenantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  cnpHash?: string;
  cui?: string;
  limbaPreferata?: string;
}): Promise<
  | { success: true; citizenId: string; verificationToken: string }
  | { success: false; error: "email_exists" | "no_match" | "internal_error" }
> {
  const { tenantId, email, password, firstName, lastName, phone, cnpHash, cui, limbaPreferata } = params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true },
  });
  if (!tenant || !["active", "trial"].includes(tenant.status)) {
    return { success: false, error: "internal_error" };
  }

  // Check if email already registered
  const existing = await prisma.citizenUser.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (existing) {
    return { success: false, error: "email_exists" };
  }

  // Try to match with existing contribuabil
  let contribuabil = null;
  if (cnpHash) {
    contribuabil = await prisma.contribuabil.findFirst({
      where: { tenantId, cnpHash, deletedAt: null },
    });
  } else if (cui) {
    contribuabil = await prisma.contribuabil.findFirst({
      where: { tenantId, cui, deletedAt: null },
    });
  }

  if (!contribuabil) {
    return { success: false, error: "no_match" };
  }

  const passwordHash = await hash(password, 12);
  const verificationToken = randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const citizen = await prisma.citizenUser.create({
    data: {
      tenantId,
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      verificationToken,
      verificationExpires,
      limbaPreferata: limbaPreferata || "ro",
    },
  });

  // Create the link between citizen user and contribuabil
  await prisma.citizenContribuabilLink.create({
    data: {
      tenantId,
      citizenUserId: citizen.id,
      contribuabilId: contribuabil.id,
      linkType: "owner",
    },
  });

  return { success: true, citizenId: citizen.id, verificationToken };
}

/**
 * Verify a citizen's email address.
 */
export async function verifyCitizenEmail(token: string): Promise<boolean> {
  const citizen = await prisma.citizenUser.findFirst({
    where: {
      verificationToken: token,
      verificationExpires: { gte: new Date() },
      emailVerified: false,
    },
  });

  if (!citizen) return false;

  await prisma.citizenUser.update({
    where: { id: citizen.id },
    data: {
      emailVerified: true,
      isActive: true,
      verificationToken: null,
      verificationExpires: null,
    },
  });

  // Mark the link as verified
  await prisma.citizenContribuabilLink.updateMany({
    where: { citizenUserId: citizen.id },
    data: { verifiedAt: new Date() },
  });

  return true;
}

/**
 * Get citizen's linked contribuabili with their data.
 */
export async function getCitizenContribuabili(citizenUserId: string) {
  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId, isActive: true },
    include: {
      contribuabil: {
        include: {
          adresaDomiciliu: true,
        },
      },
    },
  });

  return links.map((link) => ({
    linkId: link.id,
    linkType: link.linkType,
    contribuabil: link.contribuabil,
  }));
}
