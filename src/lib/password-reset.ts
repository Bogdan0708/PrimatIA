import { randomBytes, createHash } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { LOCALES, type Locale } from "@/lib/constants";

type ResetUserType = "staff" | "citizen";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getResetExpiryDate(): Date {
  const ttlMinutes = parseInt(
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || "60",
    10
  );
  return new Date(Date.now() + Math.max(5, ttlMinutes) * 60 * 1000);
}

function normalizeLocale(locale?: string | null): Locale {
  if (locale && (LOCALES as readonly string[]).includes(locale)) {
    return locale as Locale;
  }
  return "ro";
}

function buildStaffResetUrl(token: string, locale: Locale): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl}/${locale}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildCitizenResetUrl(token: string, locale: Locale): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl}/${locale}/portal/reset-password?token=${encodeURIComponent(token)}`;
}

function getStaffEmail(locale: Locale, resetUrl: string) {
  if (locale === "en") {
    return {
      subject: "PrimarIA password reset",
      text: `You requested a password reset. Use this link: ${resetUrl}. The link expires in 60 minutes.`,
      html: `<p>You requested a password reset.</p><p><a href=\"${resetUrl}\">Reset password</a></p><p>This link expires in 60 minutes.</p>`,
    };
  }

  if (locale === "hu") {
    return {
      subject: "PrimarIA jelszo visszaallitas",
      text: `Jelszo-visszaallitast kert. Hasznalja ezt a linket: ${resetUrl}. A link 60 perc mulva lejar.`,
      html: `<p>Jelszo-visszaallitast kert.</p><p><a href=\"${resetUrl}\">Jelszo visszaallitasa</a></p><p>A link 60 perc mulva lejar.</p>`,
    };
  }

  return {
    subject: "Resetare parolă PrimărIA",
    text: `Ați solicitat resetarea parolei. Folosiți acest link: ${resetUrl}. Linkul expiră în 60 de minute.`,
    html: `<p>Ați solicitat resetarea parolei.</p><p><a href=\"${resetUrl}\">Resetează parola</a></p><p>Linkul expiră în 60 de minute.</p>`,
  };
}

function getCitizenEmail(locale: Locale, resetUrl: string) {
  if (locale === "en") {
    return {
      subject: "PrimarIA citizen portal password reset",
      text: `You requested a password reset for the citizen portal. Use this link: ${resetUrl}. The link expires in 60 minutes.`,
      html: `<p>You requested a password reset for the citizen portal.</p><p><a href=\"${resetUrl}\">Reset password</a></p><p>This link expires in 60 minutes.</p>`,
    };
  }

  if (locale === "hu") {
    return {
      subject: "PrimarIA portal jelszo visszaallitas",
      text: `Jelszo-visszaallitast kert a polgari portalhoz. Hasznalja ezt a linket: ${resetUrl}. A link 60 perc mulva lejar.`,
      html: `<p>Jelszo-visszaallitast kert a polgari portalhoz.</p><p><a href=\"${resetUrl}\">Jelszo visszaallitasa</a></p><p>A link 60 perc mulva lejar.</p>`,
    };
  }

  return {
    subject: "Resetare parolă Portal Cetățean PrimărIA",
    text: `Ați solicitat resetarea parolei pentru portalul cetățean. Folosiți acest link: ${resetUrl}. Linkul expiră în 60 de minute.`,
    html: `<p>Ați solicitat resetarea parolei pentru portalul cetățean.</p><p><a href=\"${resetUrl}\">Resetează parola</a></p><p>Linkul expiră în 60 de minute.</p>`,
  };
}

export async function requestStaffPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return;

  const users = await prisma.tenantUser.findMany({
    where: {
      email,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      tenantId: true,
      limbaPreferata: true,
    },
  });

  if (users.length === 0) return;

  for (const user of users) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);

    await prisma.passwordResetToken.create({
      data: {
        tenantId: user.tenantId,
        userType: "staff",
        tenantUserId: user.id,
        email: user.email,
        tokenHash,
        expiresAt: getResetExpiryDate(),
      },
    });

    const locale = normalizeLocale(user.limbaPreferata);
    const resetUrl = buildStaffResetUrl(token, locale);
    const content = getStaffEmail(locale, resetUrl);

    await sendEmail({
      to: user.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  }
}

export async function requestCitizenPasswordReset(
  tenantId: string,
  emailRaw: string
): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return;

  const user = await prisma.citizenUser.findUnique({
    where: {
      tenantId_email: {
        tenantId,
        email,
      },
    },
    select: {
      id: true,
      email: true,
      tenantId: true,
      limbaPreferata: true,
      emailVerified: true,
      isActive: true,
      deletedAt: true,
    },
  });

  if (!user || !user.isActive || !user.emailVerified || user.deletedAt) {
    return;
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await prisma.passwordResetToken.create({
    data: {
      tenantId: user.tenantId,
      userType: "citizen",
      citizenUserId: user.id,
      email: user.email,
      tokenHash,
      expiresAt: getResetExpiryDate(),
    },
  });

  const locale = normalizeLocale(user.limbaPreferata);
  const resetUrl = buildCitizenResetUrl(token, locale);
  const content = getCitizenEmail(locale, resetUrl);

  await sendEmail({
    to: user.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

export async function resetPasswordWithToken(params: {
  token: string;
  newPassword: string;
  userType: ResetUserType;
}): Promise<boolean> {
  const tokenHash = hashToken(params.token);

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      userType: params.userType,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      tenantId: true,
      tenantUserId: true,
      citizenUserId: true,
      userType: true,
    },
  });

  if (!resetToken) return false;

  const passwordHash = await hash(params.newPassword, 12);

  await prisma.$transaction(async (tx) => {
    if (params.userType === "staff" && resetToken.tenantUserId) {
      await tx.tenantUser.update({
        where: { id: resetToken.tenantUserId },
        data: {
          passwordHash,
          loginAttempts: 0,
          lockedUntil: null,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userType: "staff",
          tenantUserId: resetToken.tenantUserId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      return;
    }

    if (params.userType === "citizen" && resetToken.citizenUserId) {
      await tx.citizenUser.update({
        where: { id: resetToken.citizenUserId },
        data: {
          passwordHash,
          loginAttempts: 0,
          lockedUntil: null,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userType: "citizen",
          citizenUserId: resetToken.citizenUserId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      return;
    }

    throw new Error("Invalid reset token target");
  });

  return true;
}
