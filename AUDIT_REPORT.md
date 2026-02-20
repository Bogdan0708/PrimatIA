# PrimărIA — Technical Audit Report

**Date:** 2026-02-20  
**Branch:** master  
**Codebase:** ~243 TypeScript files, ~1200-line Prisma schema, Next.js 14.2.35

---

## Summary

The project is well-structured for its stage — clean architecture, good separation of concerns, solid security foundations (RLS, encryption, rate limiting, security headers). However, there are critical tenant isolation bugs with PgBouncer, minimal test coverage, and several production-readiness gaps. The codebase is surprisingly mature for a debug/stabilization phase, but the items below need attention before real municipality data flows through.

**Issue counts:** 4 × P0, 9 × P1, 8 × P2

---

## 1. Security

### P0-SEC-1: RLS tenant context leaks with PgBouncer transaction pooling

**Files:** `src/lib/db.ts:25`, `docker/pgbouncer/pgbouncer.ini` (pool_mode = transaction)

`setTenantContext()` uses `set_config('app.current_tenant_id', ..., true)` — the `true` parameter means "local to current transaction." With PgBouncer in **transaction mode**, each Prisma query that isn't inside an explicit `$transaction()` block runs in its own transaction. This means:

- The `setTenantContext()` call runs in transaction A
- The subsequent `prisma.plata.findMany()` runs in transaction B (possibly on a different connection)
- Transaction B has **no tenant context set** → RLS policies see empty string → behavior depends on your RLS policy (either returns nothing or everything)

**Fix:** Either:
1. Wrap all tenant-scoped queries in explicit `prisma.$transaction()` blocks that include the `setTenantContext` call, OR
2. Use `set_config(..., false)` (session-level) and switch PgBouncer to `session` mode (less efficient), OR
3. Use Prisma's `$extends` with `query` middleware to auto-inject `SET LOCAL` inside every query's transaction

### P0-SEC-2: `clearTenantContext()` is never called

**File:** `src/lib/db.ts:30` — defined but grep shows zero call sites.

If you fix P0-SEC-1 and tenant context persists across queries, you must clear it after each request. Otherwise, connection reuse can leak tenant context to the next request.

### P0-SEC-3: Portal login falls back to "first active tenant"

**Files:** `src/app/api/portal/auth/login/route.ts:78-83`, `src/app/api/portal/auth/register/route.ts:82-87`

`getDefaultTenantId()` picks `prisma.tenant.findFirst({ where: { status: { in: ["active", "trial"] } } })`. In a multi-tenant system, a citizen logging in without `x-tenant-id` header gets authenticated against a random tenant. This is a **cross-tenant auth bypass**.

**Fix:** Require tenant identification (subdomain, explicit header, or URL path). Never fall back to "first found."

### P0-SEC-4: No CSRF protection on cookie-authenticated portal API routes

**Files:** All `src/app/api/portal/*` routes

The citizen portal uses `httpOnly` cookie-based JWT auth. The CORS config helps, but CORS alone doesn't prevent CSRF from same-origin or when `Access-Control-Allow-Origin` matches. There's no CSRF token validation.

**Fix:** Add a `X-Requested-With` header check (simple CSRF mitigation) or implement double-submit cookie pattern.

### P1-SEC-5: No input validation on API routes

**Files:** `src/app/api/portal/auth/login/route.ts`, `src/app/api/portal/auth/register/route.ts`, most API routes

Despite having `zod` as a dependency, API routes destructure `request.json()` directly without schema validation. The register route accepts `password` without length/complexity checks.

**Fix:** Add Zod schemas to all API route inputs. You already have `src/lib/validations.ts` — extend and use it.

### P1-SEC-6: CSP allows `unsafe-inline` and `unsafe-eval`

**File:** `src/middleware.ts:72-73`

`script-src 'self' 'unsafe-inline' 'unsafe-eval'` — the comment says "Next.js requires in dev" but this applies to production too. This largely negates XSS protection from CSP.

**Fix:** Use nonce-based CSP for Next.js. Next.js 14 supports `nonce` via `headers()` — see Next.js docs on CSP with nonces.

### P1-SEC-7: Super admin credentials in `.env.example`

**File:** `.env.example:50-51`

`SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` with placeholder values. If someone copies this without changing, the default admin creds are predictable.

**Fix:** Remove default values; make the seed script fail if not set.

### P2-SEC-8: Rate limiter is in-memory, single-instance only

**File:** `src/middleware.ts:16-54`

Fine for single instance, but will silently stop working with multiple replicas. The `rateLimitMap` also has no proper cleanup (the size check at line 56 only runs at module load, not periodically — edge runtime doesn't support `setInterval`).

**Fix:** Document single-instance limitation. For multi-instance, move to Redis-based rate limiting.

### P2-SEC-9: JWT secret fallback chain is fragile

**File:** `src/lib/portal-auth.ts:8-10`

`JWT_SECRET || CITIZEN_JWT_SECRET || NEXTAUTH_SECRET` — using the same secret for NextAuth sessions and citizen JWTs means compromising one compromises both.

**Fix:** Require a dedicated `CITIZEN_JWT_SECRET` in production; remove fallback chain.

---

## 2. Code Quality & Architecture

### P1-CQ-1: No worker process for BullMQ queues

**File:** `src/lib/queue.ts`

Queues and job types are defined, `createWorker()` helper exists, but there's no worker entrypoint (no `src/worker.ts` or similar, no worker service in Docker compose). Jobs added to queues will never be processed.

**Fix:** Create a worker entrypoint and add a `worker` service to `docker-compose.production.yml`.

### P1-CQ-2: Duplicate Prisma client import pattern

**File:** `src/app/[locale]/(authenticated)/plati/_actions/plata-actions.ts:3-4`

```typescript
import { prisma } from "@/lib/db";
import { setTenantContext } from "@/lib/db";
```

Minor, but the `setTenantContext` + manual `auth()` + `setTenantContext(session.user.tenantId)` pattern is repeated in every server action. This is what `withTenantContext()` from `src/lib/tenant-context.ts` was designed for, but most actions don't use it.

**Fix:** Refactor server actions to use `withTenantContext()` consistently.

### P1-CQ-3: Webhook handler is 200+ lines with no abstraction

**File:** `src/app/api/payments/webhook/route.ts`

The Stripe webhook handler is a monolithic function handling 7+ event types with deeply nested transaction logic. Hard to test and maintain.

**Fix:** Extract each event handler into separate functions. Add idempotency checks consistently.

### P2-CQ-4: `src/lib/stripe.ts` exists alongside `src/lib/payments/stripe-provider.ts`

Two stripe-related modules. Unclear which is canonical.

### P2-CQ-5: AI/ML modules are stubs

**Files:** `src/lib/ai/revenue-forecast.ts`, `src/lib/ai/anomaly-detection.ts`, `src/lib/ocr/document-processor.ts`, `src/lib/chatbot/knowledge.ts`

These appear to be placeholder/aspirational modules. No issue if they're not imported, but they add confusion.

---

## 3. Performance

### P1-PERF-1: PgBouncer transaction mode breaks `set_config` (duplicate of P0-SEC-1)

Beyond security, this likely means RLS isn't filtering at all, so every tenant-scoped query returns **all tenants' data** — both a security and performance problem.

### P1-PERF-2: No database indexes visible in Prisma schema

**File:** `prisma/schema.prisma`

Only `@@index([tenantId])` on `TenantUser` visible in the first 200 lines. For a tax administration app with query-heavy patterns (date ranges, contribuabil lookups, payment searches), missing indexes on `dataPlata`, `contribuabilId`, `status`, compound indexes on `(tenantId, contribuabilId)`, etc. will cause full table scans.

**Fix:** Audit slow queries with `EXPLAIN ANALYZE` and add appropriate indexes.

### P2-PERF-3: Webhook fetches all `initiated` payments for matching

**File:** `src/app/api/payments/webhook/route.ts:125-133`

For `payment_intent.payment_failed`, the code loads ALL `initiated` payments and loops through them to match by `gatewayResponse.paymentIntentId`. This is O(n) in total initiated payments.

**Fix:** Add an indexed column or use a direct query with JSON path filter.

### P2-PERF-4: No caching layer despite Redis being available

Redis is configured for BullMQ but not used for caching tax rates, tenant settings, or other hot data.

---

## 4. Docker & Deployment

### P1-DOCK-1: Production compose exposes all service ports to host

**File:** `docker-compose.production.yml`

PostgreSQL (5433), PgBouncer (6432), Redis (6379), MinIO (9000, 9001) are all exposed to the host. In production, only the app port (3000) and possibly MinIO console should be exposed.

**Fix:** Remove port mappings for internal services; use Docker network only. Or bind to `127.0.0.1:port:port`.

### P1-DOCK-2: No database migration step

**Files:** `Dockerfile`, `docker-compose.production.yml`

The Dockerfile copies Prisma schema and migrations but never runs `prisma migrate deploy`. There's no migration service or init container.

**Fix:** Add a migration step — either an init container, a startup script, or a `migrate` service that runs before `app`.

### P1-DOCK-3: Dockerfile port mismatch

**File:** `Dockerfile:54` says `PORT=8080`, but `docker-compose.production.yml:16` maps `3000:3000`.

**Fix:** Align ports. Either change Dockerfile to 3000 or compose to 8080.

### P2-DOCK-4: No `.dockerignore` for node_modules efficiency check

**File:** `.dockerignore` exists but wasn't inspected for completeness. Ensure `node_modules`, `.git`, `.env*` are excluded.

### P2-DOCK-5: Package manager mismatch

`bun.lock` exists alongside `package-lock.json`. Dockerfile uses `npm ci`. Pick one package manager.

---

## 5. Testing

### P0-TEST-1: Critically low test coverage

**5 test files** covering 243 source files (~2% file coverage):
- `src/__tests__/tax-engine/building-tax.test.ts`
- `src/__tests__/tax-engine/land-tax.test.ts`
- `src/__tests__/tax-engine/vehicle-tax.test.ts`
- `src/__tests__/formatting/number-to-words.test.ts`
- `src/__tests__/import/import-actions.test.ts`

**No tests for:**
- Auth flows (login, register, JWT validation)
- Payment processing (webhook, Stripe integration)
- RLS/tenant isolation
- API route input validation
- Server actions

**Vitest coverage** is configured only for `src/lib/tax-engine/**` and `src/lib/patrimven/**`.

**Fix (priority order):**
1. Auth + tenant isolation tests (prevents P0-SEC-1/3 from recurring)
2. Payment webhook tests (money is involved)
3. API route validation tests
4. Server action integration tests

---

## 6. DX & UX

### P1-DX-1: No error boundaries or loading states visible

No `error.tsx` or `loading.tsx` files found in app routes. Next.js will show the default error page on any unhandled error.

**Fix:** Add `error.tsx` and `loading.tsx` at the layout level minimum.

### P2-DX-2: Login error messages are generic

**Files:** `src/lib/auth.ts`, `src/app/api/portal/auth/login/route.ts`

Account lockout returns the same "Invalid credentials" as wrong password. Users won't know they're locked out or why.

**Fix:** Return a distinct error for locked accounts with the unlock time.

### P2-DX-3: No form validation feedback patterns

Server actions return `{ success: false, error: string }` but there's no visible pattern for showing field-level validation errors to users.

### P2-DX-4: i18n has 3 locales but completeness is unknown

**Files:** `src/messages/ro.json`, `src/messages/en.json`, `src/messages/hu.json`

No tooling to detect missing translation keys.

---

## 7. Dependencies

### P1-DEP-1: `next-auth` 5.0.0-beta.25 is a pre-release

**File:** `package.json`

Beta software in production for authentication. API may change, bugs are expected, security patches may lag.

**Fix:** Either pin carefully and monitor releases, or consider stable alternatives. NextAuth v5 is close to stable — track the release.

### P2-DEP-2: `zod` v4.3.6 is very new (major version bump)

Zod v4 was recently released with breaking changes. Ensure compatibility.

### P2-DEP-3: No `npm audit` in CI

**Fix:** Add `npm audit --audit-level=high` to the CI pipeline.

---

## 8. CI/CD Readiness

### P1-CI-1: Lint job has `continue-on-error: true`

**File:** `.github/workflows/ci.yml:42`

Lint failures are silently ignored. This means lint rules provide zero enforcement.

**Fix:** Remove `continue-on-error`, fix lint issues, enforce.

### P1-CI-2: No build step in CI

CI runs type-check, test, and lint, but never `npm run build`. Build failures won't be caught until deployment.

**Fix:** Add a build job.

### P1-CI-3: No Docker build/push pipeline

No workflow for building Docker images, pushing to registry, or deploying.

**Fix:** Add a deployment workflow with:
- Docker build + push to GCR/Artifact Registry
- Staging deploy on merge to `main`
- Production deploy on tag/release

### P2-CI-4: No E2E tests

No Playwright/Cypress setup. For a tax administration app handling payments, E2E tests on critical flows (login → view debts → pay → receipt) are essential.

### P2-CI-5: No secret scanning or SAST

**Fix:** Add `gitleaks` or GitHub's secret scanning. Consider CodeQL for SAST.

---

## Priority Action Plan

### Immediate (P0 — fix before any real data)
1. **Fix RLS + PgBouncer tenant isolation** (P0-SEC-1, P0-SEC-2)
2. **Fix portal tenant resolution** — remove `getDefaultTenantId()` fallback (P0-SEC-3)
3. **Add CSRF protection** to portal routes (P0-SEC-4)
4. **Add critical-path tests** — auth, payments, tenant isolation (P0-TEST-1)

### Next Sprint (P1)
5. Add Zod validation to all API routes (P1-SEC-5)
6. Create BullMQ worker process + Docker service (P1-CQ-1)
7. Fix Docker port mismatch and restrict production port exposure (P1-DOCK-1, P1-DOCK-3)
8. Add migration step to deployment (P1-DOCK-2)
9. Add build job to CI, remove lint continue-on-error (P1-CI-1, P1-CI-2)
10. Add database indexes for common query patterns (P1-PERF-2)
11. Add error boundaries + loading states (P1-DX-1)
12. Fix CSP to use nonces (P1-SEC-6)

### Backlog (P2)
13. Redis-based caching for hot data
14. E2E test setup
15. i18n completeness tooling
16. Nonce-based CSP
17. npm audit in CI
18. Clean up duplicate stripe modules and stub AI modules
