import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerCitizen } from "@/lib/citizen-auth";
import { hashCnp } from "@/lib/crypto";
import { sendNotification } from "@/lib/notifications";
import { prisma } from "@/lib/db";
import { resolveTenantIdFromHeaders } from "@/lib/tenant-resolution";
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
  try {
    const body = await request.json();
    const parsed = registerCitizenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid registration data" },
        { status: 400 }
      );
    }
    const { firstName, lastName, email, password, cnp, cui, phone, limbaPreferata } = parsed.data;

    // Tenant identity must be derived server-side from trusted context.
    const tenantId = await resolveTenantIdFromHeaders(request.headers);
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant could not be resolved for this domain." },
        { status: 400 }
      );
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
      if (result.error === "email_exists") {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 409 }
        );
      }
      if (result.error === "no_match") {
        return NextResponse.json(
          { error: "no_match" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Registration failed" },
        { status: 500 }
      );
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
      console.error("Failed to send verification email:", emailError);
      // Registration still succeeds even if email fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Citizen registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
