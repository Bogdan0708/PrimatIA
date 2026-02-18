import { NextRequest, NextResponse } from "next/server";
import { authenticateCitizen } from "@/lib/citizen-auth";
import { prisma } from "@/lib/db";
import { SignJWT } from "jose";

const citizenJwtSecret =
  process.env.JWT_SECRET ||
  process.env.CITIZEN_JWT_SECRET ||
  process.env.NEXTAUTH_SECRET;

if (!citizenJwtSecret) {
  throw new Error(
    "JWT_SECRET (or CITIZEN_JWT_SECRET/NEXTAUTH_SECRET) must be configured"
  );
}

const JWT_SECRET = new TextEncoder().encode(citizenJwtSecret);

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

    // For now, resolve tenant from the first active tenant or from header
    const tenantId = request.headers.get("x-tenant-id") || await getDefaultTenantId();
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      );
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
      .sign(JWT_SECRET);

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

async function getDefaultTenantId(): Promise<string | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { status: { in: ["active", "trial"] }, deletedAt: null },
    select: { id: true },
  });
  return tenant?.id || null;
}
