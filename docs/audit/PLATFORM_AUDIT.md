# PrimărIA — Platform Audit Report

> Date: 2026-02-27
> Scope: Backend, auth/RBAC, DB schema/integrity, audit logs, receipts/certificates, AI Gateway integration, data privacy/security, compliance-by-design
> Out of scope: Tax engine calculation algorithms (delegated to separate Codex audit)

## Executive Summary

PrimărIA is a well-architected multi-tenant SaaS for Romanian local tax administration. The codebase demonstrates strong foundations: robust tenant isolation via PostgreSQL RLS + AsyncLocalStorage proxy, transactional payment processing with row-level locking, Stripe webhook signature verification with event deduplication, comprehensive Zod validation schemas, and defense-in-depth security headers.

However, the audit identified **10 key risks** that need attention before the platform handles real taxpayer money and PII at scale. The most critical gaps are in **financial audit trails** (payments not logged to AuditLog), **document numbering atomicity**, **missing MFA for staff**, and **cashier session management**.

Quick wins (7 items) were implemented as part of this audit. No database migrations were needed.

---

## Key Risks (Top 10)

| # | Risk | Severity | Domain |
|---|------|----------|--------|
| 1 | **No MFA/2FA for staff accounts** — TOTP column exists but is unused. Super_admin and primaria_admin have single-factor auth only. | CRITICAL | Security |
| 2 | **Payment operations had no audit log** — Creating Plata, distributing to taxes, and confirming online payments were not logged to AuditLog. *(Fixed in QW-1)* | HIGH | Auditability |
| 3 | **Cash payment endpoint lacked role check** — Only checked for `tenantId` presence, not staff role. *(Fixed in QW-2)* | HIGH | Security |
| 4 | **Document number race condition** — `getNextDocumentNumber()` uses `COUNT + 1` query, not atomic. Concurrent PDF generations can produce duplicate numbers. | HIGH | Data Integrity |
| 5 | **No cashier session model** — Cash payments track the operator but lack session start/end, opening/closing balances, and daily reconciliation. | HIGH | Compliance |
| 6 | **No payment reversal/storno flow** — Incorrect payments cannot be formally corrected; no append-only reversal model. | HIGH | Compliance |
| 7 | **Rate limiting is in-memory only** — Doesn't survive restarts, not shared across Cloud Run instances. | MEDIUM | Security |
| 8 | **No PII scrubbing before AI gateway** — Chatbot sends taxpayer queries (which may contain CNP, names) directly to external LLM providers. | MEDIUM | Privacy |
| 9 | **Citizen registration leaks account existence** — Returns distinct `email_exists` and `no_match` errors, enabling enumeration. | MEDIUM | Security |
| 10 | **Soft-delete filter not automated** — Developers must manually add `deletedAt: null` to every query. Missing it returns deleted records. | MEDIUM | Data Integrity |

---

## Findings by Domain

### Security

| Finding | Severity | Status |
|---------|----------|--------|
| No MFA/2FA despite TOTP schema column | CRITICAL | Open |
| Cash payment endpoint missing role check | HIGH | **Fixed (QW-2)** |
| No CSRF protection for state-changing operations | MEDIUM | Open — mitigated by SameSite=lax cookies |
| Rate limiting in-memory only (breaks on horizontal scaling) | MEDIUM | Open |
| Citizen registration returns `email_exists` / `no_match` errors | MEDIUM | Open |
| Password policy: length-only (12 chars), no complexity | LOW | Open |
| JWT_SECRET falls back to NEXTAUTH_SECRET | LOW | Open |
| No login notifications or suspicious activity detection | LOW | Open |
| ROeID partially implemented, security unknown if enabled | LOW | Open |

**What's working well:**
- bcryptjs cost factor 12 for password hashing
- Account lockout (5 attempts, 15-minute lock)
- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy)
- Citizen JWT with httpOnly, secure, SameSite=lax cookies
- Stripe webhook signature verification
- Rate limiting per route with configurable thresholds
- CNP encrypted at rest (AES-256-GCM) with per-tenant hashing

### Privacy

| Finding | Severity | Status |
|---------|----------|--------|
| AI chatbot sends unredacted user queries to external LLM | MEDIUM | Open |
| No GDPR DSAR (Data Subject Access Request) export | MEDIUM | Open |
| No data retention policy or auto-purge | MEDIUM | Open |
| PII may appear in console.error logs | LOW | Open |
| No DPA (Data Processing Agreement) validation for AI gateway | LOW | Open — process question |

**What's working well:**
- CNP encrypted in DB (AES-256-GCM), masked to last 4 digits in documents
- Per-tenant CNP hash salt prevents cross-tenant correlation
- Consent tracking model (Consimtamant) per channel with IP/timestamp
- Citizen email verification required before account activation

### Auditability

| Finding | Severity | Status |
|---------|----------|--------|
| Payment creation not logged to AuditLog | HIGH | **Fixed (QW-1)** |
| Payment distribution not logged | MEDIUM | Open |
| Tax calculation changes not logged | MEDIUM | Open |
| AuditLog has no DB-level immutability constraint | LOW | Open |
| No automated audit logging (manual per-action) | LOW | Open |

**What's working well:**
- AuditLog model has no `deletedAt` (append-only by convention)
- Captures action, entityType, entityId, old/new values, userId, IP, user agent
- Indexed by (tenantId, entityType, entityId, createdAt) for efficient querying

### Payments

| Finding | Severity | Status |
|---------|----------|--------|
| Cash payment had no server-side receipt number generation | HIGH | **Fixed (QW-4)** |
| Cash payment lacked Zod validation | MEDIUM | **Fixed (QW-3)** |
| Webhook dedup check was outside transaction (race window) | MEDIUM | **Fixed (QW-5)** |
| No payment reversal/storno model | HIGH | Open |
| No reconciliation endpoint or daily balance check | MEDIUM | Open |
| Mock payment confirm not transactional (dev-only risk) | LOW | Open |
| Overpayment handled as return value but no credit model | MEDIUM | Open |

**What's working well:**
- Stripe webhook signature verification (constructEvent)
- Stripe event deduplication via unique stripeEventId
- Row-level locking (FOR UPDATE) on OnlinePayment and Impozit in webhook + bank-confirm
- Atomic ChitantaSequence (INSERT ON CONFLICT UPDATE) for production receipt numbering
- Transaction isolation via withTenantScope for critical payment paths
- Amount validation with ±0.01 RON tolerance
- Overpayment guard per debt
- Auto-distribution: oldest debts first, penalties before principal (per Cod Procedură Fiscală)

### AI Integration

| Finding | Severity | Status |
|---------|----------|--------|
| No PII redaction before sending to LLM | MEDIUM | Open |
| Prompt injection defenses recently added (XML delimiters) | — | Implemented |
| No conversation persistence (no PII retention risk) | — | Good |
| HTML sanitization on streaming chunks | — | Implemented |
| Streaming fallback on empty response | — | Implemented |
| Gateway provider routing fix | — | Implemented |

### Data Integrity

| Finding | Severity | Status |
|---------|----------|--------|
| Document number generation not atomic (COUNT+1 race) | HIGH | Open |
| No DB CHECK constraints on financial amounts | MEDIUM | Open |
| Polymorphic FKs (proprietateType/Id) lack referential integrity | MEDIUM | Open |
| Soft-delete filter manual (easy to forget) | MEDIUM | Open |
| No DB trigger for derived fields (sumaPlatita) | LOW | Open |
| No constraint preventing UPDATE on Plata.suma | LOW | Open |

**What's working well:**
- All currency fields use Decimal(12,2) (no floating-point issues)
- Foreign key constraints with CASCADE on all tenant-scoped tables
- 11 unique constraints enforcing business rules
- UUID primary keys for distributed generation
- Soft delete pattern on all mutable entities
- Comprehensive timestamps (createdAt, updatedAt) on all tables

### Operations

| Finding | Severity | Status |
|---------|----------|--------|
| No structured logging (uses console.log/error) | MEDIUM | Open |
| No correlation IDs for request tracing | MEDIUM | Open |
| No metrics/monitoring integration | MEDIUM | Open |
| No backup/restore documentation | LOW | Open |
| Health check endpoint exists (/api/health) | — | Good |
| Deploy script and Cloud Build config exist | — | Good |
| Pre-deployment checks exist (db-release-preflight.sh) | — | Good |

---

## Recommended Roadmap

### Now (This Sprint) — Critical Security + Compliance

1. **Implement MFA for staff** — Use `otplib` with the existing `totpSecret` column. Enforce for super_admin and primaria_admin roles.
2. **Fix document number atomicity** — Create a `DocumentSequence` table (like `ChitantaSequence`) for all document types. Replace `getNextDocumentNumber()` COUNT query.
3. **Add audit logging to remaining payment operations** — Distribution, online payment confirmation, status changes.
4. **Fix citizen registration enumeration** — Return generic error instead of `email_exists` / `no_match`.

### Next (Next 2 Sprints) — Compliance Foundations

5. **Implement cashier session model** — Session open/close, operator assignment, daily borderou generation, balance verification.
6. **Implement payment storno/reversal flow** — Append-only correction records, negative Plata entries with reason and authorization.
7. **Move rate limiting to Redis** — Use the existing Redis instance for distributed rate limiting across Cloud Run instances.
8. **Add PII redaction before AI gateway** — Strip CNP patterns, names from chatbot queries before sending to LLM.
9. **Automate soft-delete filtering** — Prisma middleware or client extension to auto-inject `deletedAt: null`.

### Later (Backlog) — Hardening + Polish

10. **Add DB CHECK constraints** — Positive amounts, valid date ranges, status enums.
11. **Structured logging with correlation IDs** — Replace console.log with pino/winston, add request ID propagation.
12. **Reconciliation endpoint** — Daily/monthly payment totals vs tax reductions report.
13. **GDPR DSAR export** — Citizen self-service data export.
14. **Data retention policy** — Configurable per entity type, auto-archive after retention period.
15. **DB triggers for audit log** — AFTER INSERT/UPDATE/DELETE triggers instead of manual logging.
16. **Password complexity requirements** — Add rules for uppercase, lowercase, digits, symbols.

---

## Quick Wins Implemented

| QW | Change | File(s) |
|----|--------|---------|
| QW-1 | Audit log on payment creation | `src/app/api/plati/record/route.ts` |
| QW-2 | Role check (staff roles only can record payments) | `src/app/api/plati/record/route.ts` |
| QW-3 | Zod schema validation on payment input | `src/app/api/plati/record/route.ts` |
| QW-4 | Atomic receipt number auto-generation for cash payments | `src/app/api/plati/record/route.ts` |
| QW-5 | Webhook dedup moved inside transaction | `src/app/api/payments/webhook/route.ts` |
| QW-6 | Audit log integrity tests | `src/__tests__/audit/audit-log-integrity.test.ts` (new) |
| QW-7 | Payment validation tests | `src/__tests__/payments/payment-recording.test.ts` (new) |

### Verification

- `npm run type-check` — passes (0 errors)
- `npm test` — 149/149 tests pass (13 test files, including 2 new)
- No database migrations required
- No breaking API changes

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/plati/record/route.ts` | Role check, Zod validation, auto-receipt number, audit log |
| `src/app/api/payments/webhook/route.ts` | Transactional dedup guard |
| `src/__tests__/audit/audit-log-integrity.test.ts` | New test file |
| `src/__tests__/payments/payment-recording.test.ts` | New test file |
| `docs/audit/PLATFORM_AUDIT.md` | This report |
| `docs/audit/REPO_MAP.md` | Repository component map |
| `docs/audit/WORKFLOW_SCHEMES.md` | Mermaid diagrams |
| `docs/audit/COMPLIANCE_BY_DESIGN_CHECKLIST.md` | Compliance checklist |
| `docs/audit/QUICK_WINS.md` | Quick wins summary |

---

## Handoff to Tax Engine Audit (Codex Agent)

The following items are out of scope for this audit and should be covered by the Codex agent:

1. **Tax calculation correctness** — Verify building-tax.ts, land-tax.ts, vehicle-tax.ts formulas against Cod Fiscal L227/2015 Titlul IX
2. **Edge cases** — Proration logic for mid-year acquisitions/disposals, mixed-use building splits, Euro norm boundaries
3. **Rate table application** — Verify correct lookup from TaxRateTable given zone, category, construction type
4. **Exemption application** — Verify discount calculation and stacking rules from ScutireRegula
5. **Penalty calculation** — Verify interest rate and accrual logic in penalty.ts
6. **Decimal precision** — Verify all intermediate calculations use Decimal.js (not JavaScript floats)
7. **Installment calculation** — Verify rata1/rata2 split and deadline assignment

Key files for the Codex agent:
- `src/lib/tax-engine/index.ts` (orchestration)
- `src/lib/tax-engine/building-tax.ts`
- `src/lib/tax-engine/land-tax.ts`
- `src/lib/tax-engine/vehicle-tax.ts`
- `src/lib/tax-engine/penalty.ts`
- `src/lib/tax-engine/types.ts`
- `src/__tests__/tax-engine/` (existing tests)
