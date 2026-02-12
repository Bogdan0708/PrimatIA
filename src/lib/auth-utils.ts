import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/constants";

/**
 * Get the current session, redirecting to login if not authenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Require a specific role or set of roles.
 */
export async function requireRole(...roles: Role[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    redirect("/unauthorized");
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
