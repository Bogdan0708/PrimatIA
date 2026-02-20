# RLS Tenant Isolation Fix — Summary

**Branch:** `fix/rls-tenant-isolation`  
**Date:** 2026-02-20  
**Fixes:** P0-SEC-1, P0-SEC-2, P0-SEC-3 from AUDIT_REPORT.md

---

## The Problem

### P0-SEC-1: RLS tenant context leaks with PgBouncer transaction pooling

`setTenantContext()` used `set_config('app.current_tenant_id', ..., true)` which sets the config **local to the current transaction**. With PgBouncer in transaction pooling mode, each Prisma query runs in its own implicit transaction on potentially different connections. This means:

1. `setTenantContext()` runs in transaction A on connection X
2. `prisma.plata.findMany()` runs in transaction B on connection Y
3. Transaction B has **no tenant context** → RLS policies see empty `app.current_tenant_id`

**Impact:** Complete tenant data isolation failure. Depending on RLS policy implementation, queries either return no data or ALL tenants' data.

### P0-SEC-3: Portal auth falls back to "first active tenant"

`getDefaultTenantId()` picked `prisma.tenant.findFirst({ where: { status: 'active' } })`. A citizen logging in without an `x-tenant-id` header got authenticated against a random tenant — a **cross-tenant authentication bypass**.

---

## The Fix

### Architecture: Proxy-based transparent tenant context (`src/lib/db.ts`)

The core fix uses two mechanisms:

#### 1. `withTenantScope(tenantId, fn)` — Recommended path (optimal)

Wraps the callback in a Prisma **interactive transaction** that:
- Calls `SET LOCAL app.current_tenant_id = '...'` at the start
- Stores the transaction client in `AsyncLocalStorage`
- A **Proxy** on the exported `prisma` object detects the active scope and routes all model operations (`prisma.user.findMany()`, etc.) through the transaction client

```typescript
// All queries inside share ONE transaction with SET LOCAL
const data = await withTenantScope(tenantId, async () => {
  return prisma.contribuabil.findMany({ where: { ... } });
});
```

This guarantees that `SET LOCAL` and all queries share the same database connection and transaction, regardless of PgBouncer pooling mode.

#### 2. `setTenantContext(tenantId)` — Backward-compatible path (works, slightly less efficient)

For the ~30 files not yet migrated to `withTenantScope`, the old `setTenantContext()` now:
- Stores the tenant ID via `AsyncLocalStorage.enterWith()`
- The Proxy detects this and wraps **each individual query** in its own mini-transaction with `SET LOCAL`

This adds one extra SQL roundtrip per query (for SET LOCAL) but is **correct** — each query gets its own `BEGIN → SET LOCAL → query → COMMIT` sequence. The Proxy checks `activeScopeStorage` first (from `withTenantScope`), so nested calls are handled correctly.

#### 3. `$transaction` handling

Files that used `setTenantContext()` + `prisma.$transaction()` were broken because the `$transaction` ran on a different connection. These are now fixed:
- `payments/webhook/route.ts` — replaced with `withTenantScope()`, inner code uses `prisma` proxy
- `payments/bank-transfer/confirm/route.ts` — same approach

The Proxy routes `prisma.$transaction` to the base client to prevent nesting issues.

### Portal auth fix (`P0-SEC-3`)

Removed `getDefaultTenantId()` from all portal auth routes:
- `portal/auth/login/route.ts`
- `portal/auth/register/route.ts`
- `portal/auth/forgot-password/route.ts`
- `portal/contact/route.ts`

Tenant must now be explicitly identified via `x-tenant-id` header. Missing header returns 400 error.

---

## Files Changed

### Core infrastructure
| File | Change |
|------|--------|
| `src/lib/db.ts` | Complete rewrite: AsyncLocalStorage + Proxy pattern, `withTenantScope()`, backward-compat `setTenantContext()` |
| `src/lib/tenant-context.ts` | Updated `withTenantContext()` and `withSpecificTenant()` to use `withTenantScope()` |

### Migrated to `withTenantScope` (optimal path)
| File | Change |
|------|--------|
| `src/app/[locale]/(authenticated)/contribuabili/_actions/contribuabil-actions.ts` | All 5 functions wrapped in `withTenantScope` |
| `src/app/[locale]/(authenticated)/plati/_actions/plata-actions.ts` | All 4 functions + `distributePayment` wrapped |
| `src/app/api/payments/webhook/route.ts` | Replaced `setTenantContext` + `$transaction` with `withTenantScope` |
| `src/app/api/payments/bank-transfer/confirm/route.ts` | Same pattern replacement |
| `src/app/api/portal/contact/route.ts` | Uses `withTenantScope` |

### Portal auth (P0-SEC-3)
| File | Change |
|------|--------|
| `src/app/api/portal/auth/login/route.ts` | Removed `getDefaultTenantId()`, require `x-tenant-id` |
| `src/app/api/portal/auth/register/route.ts` | Same |
| `src/app/api/portal/auth/forgot-password/route.ts` | Same |

### Backward-compatible (auto-wrapped by proxy)
All other files (~30) that use `setTenantContext()` work automatically via the `enterWith` + proxy wrapping approach. Each query gets its own mini-transaction with SET LOCAL.

---

## How It Works (Technical Deep Dive)

```
┌─────────────────────────────────────────────────┐
│              prisma (Proxy)                      │
│                                                  │
│  get(target, prop) {                            │
│    1. Check activeScopeStorage → route to tx    │
│    2. Check pendingTenantStorage → wrap query   │
│    3. Fallback to base PrismaClient             │
│  }                                               │
└─────────────┬───────────────────┬───────────────┘
              │                   │
    withTenantScope()     setTenantContext()
              │                   │
    ┌─────────▼─────────┐  ┌─────▼──────────────┐
    │  Single $transaction│  │  Per-query wrapping │
    │  SET LOCAL once     │  │  SET LOCAL each time│
    │  All queries in tx  │  │  Mini-tx per query  │
    │  activeScopeStorage │  │  pendingTenantStorage│
    └─────────────────────┘  └──────────────────────┘
```

---

## Migration Guide

To migrate remaining files from `setTenantContext` to `withTenantScope` (optional, for performance):

```typescript
// BEFORE
await setTenantContext(session.user.tenantId);
const data = await prisma.foo.findMany({ ... });
const count = await prisma.foo.count({ ... });

// AFTER
const { data, count } = await withTenantScope(session.user.tenantId, async () => {
  const data = await prisma.foo.findMany({ ... });
  const count = await prisma.foo.count({ ... });
  return { data, count };
});
```

---

## Risks & Caveats

1. **Transaction timeout**: `withTenantScope` uses a 60-second timeout. Long-running report generation may need adjustment.
2. **No nested transactions**: Code inside `withTenantScope` cannot call `prisma.$transaction()` (Prisma limitation). The webhook and bank-transfer routes were refactored to use `withTenantScope` as the outer transaction.
3. **`enterWith` scoping**: `setTenantContext` uses `AsyncLocalStorage.enterWith()` which persists for the rest of the async context. In Next.js, each request has its own async context, so this is safe. But calling `setTenantContext` with different tenant IDs in the same request would override the previous one.
4. **Performance**: Files using `setTenantContext` (backward-compat) pay one extra roundtrip per query. Files using `withTenantScope` pay one roundtrip total per scope.

---

## What's NOT Fixed (out of scope)

- P0-SEC-4: CSRF protection on portal routes
- P0-TEST-1: Test coverage (no RLS tests added)
- P1-SEC-5: Input validation on API routes
- Other P1/P2 items from AUDIT_REPORT.md
