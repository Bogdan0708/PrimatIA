import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Set tenant context for RLS.
 * MUST be called before any tenant-scoped query.
 * Uses parameterized query to prevent SQL injection.
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;
}

/**
 * Clear tenant context after request completes.
 */
export async function clearTenantContext(): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
}
