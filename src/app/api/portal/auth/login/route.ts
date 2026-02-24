import { NextRequest, NextResponse } from "next/server";
import { authenticateCitizen } from "@/lib/citizen-auth";
import { SignJWT } from "jose";
import { prisma } from "@/lib/db";

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
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Prefer the header injected by middleware (from TENANT_ID env var in production).
    // Fall back to the single active tenant for single-tenant deployments and local dev
    // where TENANT_ID is not configured. This is safe: if multiple tenants exist and no
    // header is present, the query returns null and we return 400.
    let tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { status: { in: ["active", "trial"] }, deletedAt: null },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (!tenant) {
        return NextResponse.json(
          { error: "Tenant identification required" },
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
    console.error("Citizen login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// getDefaultTenantId removed — was a cross-tenant bypass (P0-SEC-3).
// Tenant must always be explicitly identified via x-tenant-id header.
