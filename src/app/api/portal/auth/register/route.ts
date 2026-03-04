import { NextRequest, NextResponse } from "next/server";
import { registerCitizen } from "@/lib/citizen-auth";
import { hashCnp } from "@/lib/crypto";
import { sendNotification } from "@/lib/notifications";
import { prisma } from "@/lib/db";
import { resolvePortalTenant } from "@/lib/portal-auth";
import { checkDistributedRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Distributed rate limiting (Redis) — second layer after in-memory middleware
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await checkDistributedRateLimit(`rl:register:${ip}`, 5, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = await request.json();
    const { firstName, lastName, email, password, tip, cnp, cui, phone, limbaPreferata } = body;

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (tip === "PF" && !cnp) {
      return NextResponse.json(
        { error: "CNP is required for individuals" },
        { status: 400 }
      );
    }

    if (tip === "PJ" && !cui) {
      return NextResponse.json(
        { error: "CUI is required for companies" },
        { status: 400 }
      );
    }

    const tenantId = await resolvePortalTenant(request);
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant identification required" },
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
      if (result.error === "email_exists" || result.error === "no_match") {
        // Return same response as success to prevent email enumeration
        return NextResponse.json({ success: true });
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

