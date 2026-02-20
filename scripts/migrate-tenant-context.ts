/**
 * Migration helper script — not meant to be run automatically.
 * Documents the transformation pattern for the RLS fix.
 *
 * BEFORE:
 *   import { prisma } from "@/lib/db";
 *   import { setTenantContext } from "@/lib/db";
 *   ...
 *   await setTenantContext(session.user.tenantId);
 *   const data = await prisma.foo.findMany({...});
 *
 * AFTER:
 *   import { prisma, withTenantScope } from "@/lib/db";
 *   ...
 *   return withTenantScope(session.user.tenantId, async () => {
 *     const data = await prisma.foo.findMany({...});
 *     return data;
 *   });
 *
 * The global `prisma` object is now a Proxy that automatically routes
 * model operations to the transaction client when inside withTenantScope().
 */
