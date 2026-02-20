import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";

// ---------------------------------------------------------------------------
// AsyncLocalStorage for tenant context
// ---------------------------------------------------------------------------

interface ActiveTenantScope {
  tenantId: string;
  tx: PrismaTransactionClient;
}

/** Active when inside withTenantScope() — queries route to the tx client. */
const activeScopeStorage = new AsyncLocalStorage<ActiveTenantScope>();

/** Set by setTenantContext() for backward compat — triggers per-query wrapping. */
const pendingTenantStorage = new AsyncLocalStorage<{ tenantId: string }>();

export type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ---------------------------------------------------------------------------
// Base Prisma client (singleton)
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  _basePrisma: PrismaClient | undefined;
};

const basePrisma =
  globalForPrisma._basePrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma._basePrisma = basePrisma;

// ---------------------------------------------------------------------------
// Query-wrapping model proxy
// When pendingTenantStorage has a tenantId but no active scope,
// each model method call is wrapped in its own mini-transaction with SET LOCAL.
// ---------------------------------------------------------------------------

function wrapModelDelegate(modelName: string, tenantId: string): unknown {
  const baseModel = (basePrisma as any)[modelName];
  if (!baseModel || typeof baseModel !== "object") return baseModel;

  return new Proxy(baseModel, {
    get(target: any, methodProp: string | symbol) {
      const original = target[methodProp];
      if (typeof original !== "function") return original;

      return (...args: any[]) => {
        return basePrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;
          return (tx as any)[modelName][methodProp](...args);
        }, { maxWait: 10000, timeout: 60000 });
      };
    },
  });
}

// Properties that always go to base client
const BASE_ONLY_PROPS = new Set([
  "$connect", "$disconnect", "$on", "$use", "$extends",
  "then", "catch", "finally",
  Symbol.toPrimitive, Symbol.toStringTag,
]);

// Methods on PrismaClient that need wrapping (not on model delegates)
const RAW_QUERY_METHODS = new Set(["$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe"]);

/**
 * Proxied Prisma client that transparently routes queries through
 * tenant-scoped transactions. Works in two modes:
 *
 * 1. Inside withTenantScope(): all model access routes to the transaction client
 * 2. After setTenantContext(): each query auto-wrapped in a mini-transaction with SET LOCAL
 * 3. Otherwise: behaves as normal PrismaClient
 */
export const prisma: PrismaClient = new Proxy(basePrisma, {
  get(target, prop, receiver) {
    if (BASE_ONLY_PROPS.has(prop)) {
      return Reflect.get(target, prop, receiver);
    }

    // Mode 1: Inside withTenantScope — route everything to tx
    const activeScope = activeScopeStorage.getStore();
    if (activeScope?.tx) {
      const val = (activeScope.tx as any)[prop];
      if (val !== undefined) return val;
    }

    // $transaction always goes to base client (prevents nesting issues)
    if (prop === "$transaction") {
      return Reflect.get(target, prop, receiver);
    }

    // Mode 2: After setTenantContext — wrap queries in mini-transactions
    const pending = pendingTenantStorage.getStore();
    if (pending?.tenantId && typeof prop === "string") {
      // Wrap raw query methods
      if (RAW_QUERY_METHODS.has(prop)) {
        const originalMethod = (target as any)[prop].bind(target);
        return (...args: any[]) => {
          return basePrisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${pending.tenantId}::text, true)`;
            return (tx as any)[prop](...args);
          }, { maxWait: 10000, timeout: 60000 });
        };
      }

      // Wrap model delegates
      const baseModel = (target as any)[prop];
      if (baseModel && typeof baseModel === "object" && !Array.isArray(baseModel)) {
        return wrapModelDelegate(prop, pending.tenantId);
      }
    }

    // Mode 3: No tenant context — use base client directly
    return Reflect.get(target, prop, receiver);
  },
});

// ---------------------------------------------------------------------------
// withTenantScope — the recommended way to execute tenant-scoped queries
// ---------------------------------------------------------------------------

/**
 * Execute a callback with RLS tenant context properly set.
 * All queries inside share a single database transaction with SET LOCAL.
 * This is the most efficient approach — one SET LOCAL per scope, not per query.
 *
 * Inside the callback, the global `prisma` object automatically routes
 * all model operations through the tenant-scoped transaction.
 *
 * @example
 * ```ts
 * const data = await withTenantScope(tenantId, async () => {
 *   return prisma.user.findMany(); // uses tenant-scoped transaction
 * });
 * ```
 */
export async function withTenantScope<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  return basePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;
    return activeScopeStorage.run(
      { tenantId, tx: tx as unknown as PrismaTransactionClient },
      fn
    );
  }, {
    maxWait: 10000,
    timeout: 60000,
  });
}

/**
 * Get the current tenant ID if inside a tenant scope, or null.
 */
export function getCurrentTenantId(): string | null {
  return activeScopeStorage.getStore()?.tenantId
    ?? pendingTenantStorage.getStore()?.tenantId
    ?? null;
}

// ---------------------------------------------------------------------------
// setTenantContext — backward-compatible, auto-wraps queries
// ---------------------------------------------------------------------------

/**
 * Set tenant context for subsequent queries in the current async context.
 * Each query will be automatically wrapped in its own mini-transaction
 * with SET LOCAL to ensure tenant isolation with PgBouncer.
 *
 * For better performance (single transaction for multiple queries),
 * use withTenantScope() instead.
 *
 * @param tenantId - The tenant ID to set
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  pendingTenantStorage.enterWith({ tenantId });
}

/**
 * @deprecated No longer needed. Tenant context is transaction-scoped.
 */
export async function clearTenantContext(): Promise<void> {
  pendingTenantStorage.enterWith({ tenantId: "" });
}
