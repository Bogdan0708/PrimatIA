import { NextRequest, NextResponse } from "next/server";
import { authenticateCitizen } from "@/lib/citizen-auth";
import { resolveTenantIdFromHeaders } from "@/lib/tenant-resolution";
import { SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { checkDistributedRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/** Lazily resolved at request time so the module can be imported during build. */
function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    process.env.CITIZEN_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET (or CITIZEN_JWT_SECRET/NEXTAUTH_SECRET) must be configured"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function POST(request: NextRequest) {
  try {
    // Distributed rate limiting (Redis) — second layer after in-memory middleware
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await checkDistributedRateLimit(`rl:login:${ip}`, 10, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Tenant identity must be derived server-side from trusted context.
    // Fall back to the single active tenant for single-tenant deployments and local dev.
    let tenantId = await resolveTenantIdFromHeaders(request.headers);
    if (!tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { status: { in: ["active", "trial"] }, deletedAt: null },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (!tenant) {
        return NextResponse.json(
          { error: "Tenant could not be resolved for this domain." },
          { status: 400 }
        );
      }
      tenantId = tenant.id;
    }

    const citizen = await authenticateCitizen(email, password, tenantId);

    if (!citizen) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await new SignJWT({
      sub: citizen.id,
      email: citizen.email,
      tenantId: citizen.tenantId,
      firstName: citizen.firstName,
      lastName: citizen.lastName,
      role: "cetatean",
      isCitizen: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("4h")
      .sign(getJwtSecret());

    const response = NextResponse.json({
      success: true,
      user: {
        id: citizen.id,
        email: citizen.email,
        firstName: citizen.firstName,
        lastName: citizen.lastName,
      },
    });

    // Set the citizen session cookie
    response.cookies.set("citizen-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 4 * 60 * 60, // 4 hours
    });

    return response;
  } catch (error) {
    logger.error({ err: error }, "Citizen login error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
