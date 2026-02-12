import { auth } from "@/lib/auth";
import { setTenantContext } from "@/lib/db";

/**
 * Middleware-like function to set tenant context from the authenticated session.
 * Call this at the start of any server action or API route that accesses tenant-scoped data.
 */
export async function withTenantContext<T>(
  fn: () => Promise<T>
): Promise<T> {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error("No tenant context available");
  }

  await setTenantContext(session.user.tenantId);
  return fn();
}

/**
 * Set tenant context for a specific tenant ID (used by super_admin).
 */
export async function withSpecificTenant<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  await setTenantContext(tenantId);
  return fn();
}
