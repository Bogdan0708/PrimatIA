import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/constants";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";

/**
 * Get the current session, redirecting to login if not authenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  if (session.user.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { status: true },
    });
    if (!tenant || !["active", "trial"].includes(tenant.status)) {
      const locale = await getLocale();
      redirect(`/${locale}/unauthorized`);
    }
  }

  return session;
}

/**
 * Require a specific role or set of roles.
 */
export async function requireRole(...roles: Role[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    const locale = await getLocale();
    redirect(`/${locale}/unauthorized`);
  }
  return session;
}

/**
 * Check if user is a super admin.
 */
export async function requireSuperAdmin() {
  return requireRole("super_admin");
}

/**
 * Check if user has admin-level access (super_admin or primaria_admin).
 */
export async function requireAdmin() {
  return requireRole("super_admin", "primaria_admin");
}

/**
 * Check if user has staff-level access (not citizen).
 */
export async function requireStaff() {
  return requireRole("super_admin", "primaria_admin", "operator", "contabil");
}
