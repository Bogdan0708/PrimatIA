import { auth } from "@/lib/auth";
import { withTenantScope } from "@/lib/db";

/**
 * Execute a function with RLS tenant context from the authenticated session.
 * All database queries inside the callback automatically use the tenant-scoped
 * transaction via the global `prisma` proxy — just use `prisma.xxx` as usual.
 *
 * This is safe with PgBouncer transaction pooling because SET LOCAL and all queries
 * share the same database transaction.
 *
 * @example
 * ```ts
 * const result = await withTenantContext(async () => {
 *   return prisma.plata.findMany({ where: { ... } });
 * });
 * ```
 */
export async function withTenantContext<T>(
  fn: () => Promise<T>
): Promise<T> {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error("No tenant context available");
  }

  return withTenantScope(session.user.tenantId, fn);
}

/**
 * Execute a function with RLS tenant context for a specific tenant ID.
 * Used by super_admin operations and background jobs.
 */
export async function withSpecificTenant<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  return withTenantScope(tenantId, fn);
}
