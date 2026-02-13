import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { getLocale } from "next-intl/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.CITIZEN_JWT_SECRET || process.env.NEXTAUTH_SECRET || "citizen-secret-key"
);

export interface CitizenSession {
  sub: string;
  email: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  role: "cetatean";
  isCitizen: true;
}

/**
 * Get citizen session from cookies (for server components).
 */
export async function getCitizenSession(): Promise<CitizenSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("citizen-token")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as CitizenSession;
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
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as CitizenSession;
  } catch {
    return null;
  }
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
