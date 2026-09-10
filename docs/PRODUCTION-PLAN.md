# PrimarIA — Production Plan

**Status: ADVANCED PROTOTYPE — CRITICAL SECURITY FIXES REQUIRED**
**Score: ~6/10**
**Estimated effort: 3-4 weeks**
**Current: Next.js 14, Prisma 6, PostgreSQL 16 + RLS, deployed on GCP Cloud Run**

---

## Current State

- 268/269 unit tests passing (1 failing: chatbot rate limit fail-closed)
- Zero lint/type errors
- Comprehensive tax engine (building, land, vehicle) with excellent test coverage
- Dual auth: NextAuth v5 (staff) + custom JWT (citizens)
- 38 Prisma models, 11 migrations, PostgreSQL RLS
- E2E tests broken (baseURL points to Cloud Run production, not localhost)
- 17 dependency vulnerabilities (4 moderate, 12 high, 1 critical)
- **4 critical security issues blocking production**

---

## Phase 1: Critical Security (1-2 weeks)

### P0-1: RLS Tenant Context Leak with PgBouncer
- [ ] Audit all server actions and API routes using `setTenantContext()` directly
- [ ] Refactor ALL tenant-scoped queries to use `withTenantScope()` (explicit transaction wrapper)
- [ ] Verify `clearTenantContext()` is called or not needed (currently defined but never called)
- [ ] Add integration test: verify RLS isolation with concurrent requests
- [ ] **Test with PgBouncer in transaction mode** — SET LOCAL must be in same transaction as query

### P0-2: Portal Login Tenant Isolation
- [ ] Remove `getDefaultTenantId()` fallback to "first active tenant"
- [ ] Require explicit tenant identification for citizen portal:
  - Option A: Subdomain-based (`bogdan-voda.primaria.ro`)
  - Option B: URL path-based (`/portal/bogdan-voda/login`)
  - Option C: Header-based (`X-Tenant-Slug`) set by middleware from TENANT_ID env
- [ ] Return 400 error if tenant cannot be determined (never guess)

### P0-3: CSRF Protection for Portal API
- [ ] Add CSRF validation to all state-changing portal API routes (`POST`, `PUT`, `DELETE` on `/api/portal/*`)
- [ ] Implement double-submit cookie pattern OR `X-Requested-With: XMLHttpRequest` header check
- [ ] Exempt Stripe webhook from CSRF check (already done for `/api/payments/webhook`)

### P0-4: Input Validation
- [ ] Add Zod schemas to ALL API routes (currently ~24 routes without validation)
- [ ] Priority routes: `/api/portal/auth/login`, `/api/portal/auth/register`, `/api/portal/payments/*`
- [ ] Validate email format, password strength, CNP format, amounts, dates
- [ ] Return 400 with structured error on validation failure

### 1.5 Dependency Vulnerabilities
- [ ] Run `npm audit fix` (resolves picomatch, rollup, flatted, brace-expansion, glob, minimatch)
- [ ] Evaluate fast-xml-parser upgrade (critical CVE — entity expansion DoS)
- [ ] Evaluate nodemailer upgrade to 8.0.4
- [ ] Evaluate Next.js 15+ upgrade path (multiple CVEs in 14.2.35)
- [ ] Test thoroughly after patching

---

## Phase 2: Error Handling & Resilience (1 week)

### 2.1 Error Boundaries
- [ ] Add `src/app/[locale]/error.tsx` (catch-all error UI)
- [ ] Add `src/app/[locale]/not-found.tsx` (404 page)
- [ ] Add error boundaries per route group: `(authenticated)/error.tsx`, `portal/error.tsx`

### 2.2 Fix Failing Test
- [ ] Fix chatbot rate limiter fail-closed behavior in production when Redis unavailable
- [ ] Should return `{ limited: true, retryAfterSeconds: 60 }` when Redis is down in prod

### 2.3 CSP Hardening
- [ ] Remove `'unsafe-inline'` from production CSP
- [ ] Implement nonce-based CSP for Next.js (match FondEU's pattern)
- [ ] Keep `'unsafe-eval'` only in development

### 2.4 Rate Limiting
- [ ] Move rate limiter from in-memory to Redis (current: process-local, breaks with Cloud Run auto-scaling)
- [ ] Reuse pattern from `chatbot-rate-limit.ts` for middleware rate limiter
- [ ] Add rate limiting on login endpoints (10 attempts/min per IP)

### 2.5 JWT Secret Separation
- [ ] Require `CITIZEN_JWT_SECRET` as separate env var (don't fall back to shared `JWT_SECRET`)
- [ ] Fail startup if `CITIZEN_JWT_SECRET` not set in production

---

## Phase 3: Infrastructure & Testing (1 week)

### 3.1 Fix E2E Tests
- [ ] Change `playwright.config.ts` baseURL to `process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'`
- [ ] Verify all 14 e2e specs can initialize
- [ ] Fix auth setup to create admin + citizen storage states
- [ ] Add E2E step to CI pipeline

### 3.2 Deployment Fixes
- [ ] Add `prisma migrate deploy` to Dockerfile entrypoint (migrations not running on deploy)
- [ ] Fix port mismatch: Dockerfile=8080, docker-compose=3000 — align to 8080
- [ ] Remove external port bindings from `docker-compose.production.yml` (PostgreSQL, Redis, MinIO exposed to 0.0.0.0)
- [ ] Move secrets to GCP Secret Manager (not .env files)

### 3.3 BullMQ Worker
- [ ] Add worker process for BullMQ queues (jobs enqueued but never processed)
- [ ] Add worker to Dockerfile or separate Cloud Run service
- [ ] Add health check for worker process

### 3.4 Observability
- [ ] Replace all `console.log/error` with `logger.*` (10+ locations)
- [ ] Add OpenTelemetry for distributed tracing
- [ ] Add custom metrics: tax calculations, payments processed, document generations
- [ ] Set up Cloud Monitoring dashboard

---

## Phase 4: Quality & Compliance (1 week)

### 4.1 Testing
- [ ] Install `@vitest/coverage-v8` and measure coverage
- [ ] Add RLS isolation integration tests
- [ ] Add accessibility tests (axe-playwright) for citizen portal (WCAG 2.1 AA)
- [ ] Add load tests for bulk import, payment processing

### 4.2 Tax Engine Validation
- [ ] Add uniqueness constraint on rate table: `@@unique([tenantId, fiscalYear, taxTypeId, zone, buildingType])`
- [ ] Document fiscal year boundary logic
- [ ] Validate calculations against real municipality data (Bogdan Voda test cases)

### 4.3 Code Cleanup
- [ ] Consolidate Stripe modules: `stripe.ts` vs `stripe-provider.ts` — pick one
- [ ] Remove or clearly mark AI/ML stubs (revenue-forecast, anomaly-detection, document-processor)
- [ ] Standardize tenant context: `withTenantScope()` everywhere, remove ad-hoc `setTenantContext()` calls

### 4.4 Documentation
- [ ] Document RLS policies (which tables, what policies, how to verify)
- [ ] Document rollback procedures for each migration
- [ ] Add deployment runbook for Cloud Run
- [ ] Set up database backup automation (pre-migration snapshots)

---

## Paperclip Agent Assignments

| Agent | Role | Ticket Types |
|-------|------|-------------|
| **Claude Code** | engineer | RLS fixes, CSRF impl, input validation (Zod), error boundaries, rate limiter migration, JWT separation, E2E fixes |
| **Codex** | engineer | Dependency patches, CI/CD fixes, Dockerfile migration step, BullMQ worker, load tests, coverage setup |
| **Gemini** | engineer | RLS policy documentation, deployment runbook, tax engine validation docs, accessibility audit, compliance review |
