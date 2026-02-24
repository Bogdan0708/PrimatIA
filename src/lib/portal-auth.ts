import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
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

export interface CitizenSession {
  sub: string;
  email: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  role: "cetatean";
  isCitizen: true;
}

async function isCitizenSessionValid(session: CitizenSession): Promise<boolean> {
  const user = await prisma.citizenUser.findFirst({
    where: {
      id: session.sub,
      tenantId: session.tenantId,
      isActive: true,
      emailVerified: true,
      deletedAt: null,
      tenant: {
        status: { in: ["active", "trial"] },
        deletedAt: null,
      },
    },
    select: { id: true },
  });
  return Boolean(user);
}

/**
 * Get citizen session from cookies (for server components).
 */
export async function getCitizenSession(): Promise<CitizenSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("citizen-token")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const session = payload as unknown as CitizenSession;
    if (!(await isCitizenSessionValid(session))) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Get citizen session from request (for API routes).
 */
export async function getCitizenFromRequest(request: NextRequest): Promise<CitizenSession | null> {
  const token = request.cookies.get("citizen-token")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const session = payload as unknown as CitizenSession;
    if (!(await isCitizenSessionValid(session))) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Resolve tenant ID for a portal API request.
 * Checks x-tenant-id header first; falls back to the single active tenant
 * for single-tenant deployments where TENANT_ID env var is not set.
 */
export async function resolvePortalTenant(request: NextRequest): Promise<string | null> {
  const fromHeader = request.headers.get("x-tenant-id");
  if (fromHeader) return fromHeader;

  const tenant = await prisma.tenant.findFirst({
    where: { status: { in: ["active", "trial"] }, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return tenant?.id ?? null;
}

/**
 * Require citizen auth - redirects to login if not authenticated.
 * For use in server components.
 */
export async function requireCitizenAuth(): Promise<CitizenSession> {
  const session = await getCitizenSession();
  if (!session) {
    const locale = await getLocale();
    redirect(`/${locale}/portal/login`);
  }
  return session;
}
