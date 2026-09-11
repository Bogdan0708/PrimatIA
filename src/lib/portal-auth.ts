import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { prisma, withTenantScope } from "@/lib/db";

/**
 * Resolve the citizen portal JWT signing secret.
 * SECURITY: Uses a dedicated secret (CITIZEN_JWT_SECRET or JWT_SECRET) to
 * prevent token confusion between staff (NextAuth) and citizen sessions.
 */
export function getPortalJwtSecret(): Uint8Array {
  const citizenSecret = process.env.CITIZEN_JWT_SECRET;
  if (citizenSecret) {
    return new TextEncoder().encode(citizenSecret);
  }
  // In production, require a dedicated citizen secret to prevent token confusion
  // between staff (NextAuth) and citizen sessions.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CITIZEN_JWT_SECRET must be configured in production (cannot share JWT_SECRET with staff auth)"
    );
  }
  // Dev fallback only
  const fallback = process.env.JWT_SECRET;
  if (!fallback) {
    throw new Error(
      "CITIZEN_JWT_SECRET (or JWT_SECRET in development) must be configured"
    );
  }
  return new TextEncoder().encode(fallback);
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
  const user = await withTenantScope(session.tenantId, () =>
    prisma.citizenUser.findFirst({
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
    })
  );
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
    const { payload } = await jwtVerify(token, getPortalJwtSecret());
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
    const { payload } = await jwtVerify(token, getPortalJwtSecret());
    const session = payload as unknown as CitizenSession;
    if (!(await isCitizenSessionValid(session))) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Resolve tenant ID for a portal API request.
 * Uses ONLY the deployment-scoped TENANT_ID env var (server-side, not client-controllable).
 * SECURITY: Never trust x-tenant-id from client headers — it can be spoofed.
 * Fails closed when not available.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resolvePortalTenant(request: NextRequest): Promise<string | null> {
  const fromEnv = process.env.TENANT_ID?.trim();
  return fromEnv || null;
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
