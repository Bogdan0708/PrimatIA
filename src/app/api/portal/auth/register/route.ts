import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerCitizen } from "@/lib/citizen-auth";
import { hashCnp } from "@/lib/crypto";
import { sendNotification } from "@/lib/notifications";
import { prisma } from "@/lib/db";
import { resolvePortalTenant } from "@/lib/portal-auth";
import { checkSharedRateLimit, createRateLimitExceededResponse, withRateLimitHeaders } from "@/lib/rate-limit";
import { getRequestLogContext, logError } from "@/lib/logger";
import { strongPasswordSchema } from "@/lib/validations";

const registerCitizenSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.string().trim().email("Email invalid"),
    password: strongPasswordSchema,
    tip: z.enum(["PF", "PJ"]).optional(),
    cnp: z.string().trim().optional(),
    cui: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    limbaPreferata: z.enum(["ro", "en", "hu"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tip === "PF" && !data.cnp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cnp"],
        message: "CNP is required for individuals",
      });
    }
    if (data.tip === "PJ" && !data.cui) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cui"],
        message: "CUI is required for companies",
      });
    }
  });

export async function POST(request: NextRequest) {
  const logContext = getRequestLogContext(request);
  const rateLimit = await checkSharedRateLimit({
    request,
    bucket: "portal-auth-register",
    limit: 5,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const parsed = registerCitizenSchema.safeParse(body);
    if (!parsed.success) {
      return withRateLimitHeaders(NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid registration data" },
        { status: 400 }
      ), rateLimit);
    }

    const { firstName, lastName, email, password, tip, cnp, cui, phone, limbaPreferata } = parsed.data;

    const tenantId = await resolvePortalTenant(request);
    if (!tenantId) {
      return withRateLimitHeaders(NextResponse.json(
        { error: "Tenant identification required" },
        { status: 400 }
      ), rateLimit);
    }

    const cnpHash = cnp ? hashCnp(cnp, tenantId) : undefined;

    const result = await registerCitizen({
      tenantId,
      email,
      password,
      firstName,
      lastName,
      phone,
      cnpHash,
      cui,
      limbaPreferata,
    });

    if (!result.success) {
      if (result.error === "email_exists" || result.error === "no_match") {
        // Return same response as success to prevent email enumeration
        return withRateLimitHeaders(NextResponse.json({ success: true }), rateLimit);
      }
      return withRateLimitHeaders(NextResponse.json(
        { error: "Registration failed" },
        { status: 500 }
      ), rateLimit);
    }

    // Send verification email
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/portal/verify?token=${result.verificationToken}`;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    try {
      await sendNotification({
        tenantId,
        recipientEmail: email,
        event: "account_verification",
        limba: (limbaPreferata as "ro" | "en" | "hu") || "ro",
        data: {
          name: `${firstName} ${lastName}`,
          verifyUrl,
          tenantName: tenant?.name || "Primăria",
        },
      });
    } catch (emailError) {
      logError(
        {
          message: "Citizen registration succeeded but verification email failed",
          ...logContext,
          tenantId,
          citizenUserId: result.citizenId,
        },
        emailError
      );
      // Registration still succeeds even if email fails
    }

    return withRateLimitHeaders(NextResponse.json({ success: true }), rateLimit);
  } catch (error) {
    logError(
      {
        message: "Citizen registration failed unexpectedly",
        ...logContext,
      },
      error
    );
    return withRateLimitHeaders(NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ), rateLimit);
  }
}
