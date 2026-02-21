# CODEX FINAL AUDIT — Sprint 1 Security Patches

Date: 2026-02-21  
Auditor: Codex (Security Review)  
Scope: `MASTER_REMEDIATION_PLAN.md` findings **F-002**, **F-003**, **F-006**

## Executive Verdict

**PARTIAL PASS (Not ready to close all items).**

- PrimatIA F-003/F-006 remediations are materially improved and close the original race/cross-tenant gaps.
- EuFund patch set has **2 concrete compliance/security integrity misses** and **1 design caveat**.

## Requested Audit Checks

1. **Verify ALL 30 EuFund routes use `withAuthScope`**: **FAIL (29/30)**
- Verified 30 changed route files from `git diff`.
- `src/app/api/documents/[id]/route.ts` uses `withUserScope` directly, not `withAuthScope`:
  - `src/app/api/documents/[id]/route.ts:56`
  - `src/app/api/documents/[id]/route.ts:118`
- All other 29 changed routes have handler-to-wrapper parity.

2. **Verify audit logs are outside transactions**: **FAIL (10/11 routes with audit logging are correct, 1 is not)**
- Correct pattern (outside scoped tx): `auditData` set inside `withAuthScope`, `logAudit()` called after callback returns.
- Exception: `src/app/api/documents/[id]/route.ts` calls `logAudit()` inside `withUserScope` transaction:
  - `src/app/api/documents/[id]/route.ts:73`
  - `src/app/api/documents/[id]/route.ts:136`

3. **Check Proxy pattern correctness (savepoints, nested transactions)**: **PARTIAL PASS (caveat found)**
- Good:
  - `SET LOCAL app.user_id` is set in transaction scope (`src/lib/db/index.ts:116`).
  - Proxy routes `db.*` to scoped tx when scope exists (`src/lib/db/index.ts:80`).
  - `db.transaction()` is routed to `tx.transaction()` (savepoint path) via proxy property routing.
- Caveat:
  - AsyncLocalStorage scope always stores the **outer** tx (`src/lib/db/index.ts:117`), so inside nested `db.transaction()` callbacks, `db.*` calls still resolve to outer tx unless developers use nested callback `tx` directly.
  - This weakens expected savepoint rollback semantics for nested blocks.
- Current patch usage appears safe where nested tx is used (`src/app/api/documents/upload/route.ts:94` uses `tx.*` directly).

4. **Check PrimatIA `payment_failed` state guard completeness**: **PARTIAL PASS**
- Guard against invalid downgrade is in place:
  - Failure updates restricted to `status IN ('initiated','pending')` (`src/app/api/payments/webhook/route.ts:152`, `src/app/api/payments/webhook/route.ts:177`).
  - Confirm path enforces `initiated -> confirmed` only (`src/app/api/payments/webhook/route.ts:255`, `src/app/api/payments/webhook/route.ts:258`).
- Residual gap:
  - Matching logic for `payment_intent.payment_failed` may miss checkout-created records:
    - Checkout creation stores `gatewayRef = session.id` without storing `paymentIntentId` in `gatewayResponse` (`src/app/api/payments/create-checkout/route.ts:62`, `src/app/api/payments/create-checkout/route.ts:65`).
    - Failure handler searches `gateway_response->>'paymentIntentId'` or `gateway_ref = paymentIntent.id` (`src/app/api/payments/webhook/route.ts:153`, `src/app/api/payments/webhook/route.ts:176`).
  - This is primarily a state-sync reliability gap, not a cross-tenant bypass.

5. **Bypasses / new vulnerabilities introduced**

### Finding 1 (Medium): Wrapper drift on one route
- File: `src/app/api/documents/[id]/route.ts`
- Issue: direct `requireAuth + withUserScope` instead of standardized `withAuthScope`.
- Risk: consistency drift; easier future omission of auth/scope invariants.

### Finding 2 (Medium): Audit trail durability gap on one route
- File: `src/app/api/documents/[id]/route.ts`
- Issue: `logAudit()` inside scoped transaction.
- Risk: audit entries tied to transaction lifecycle; can be lost on rollback paths, violating intent of patch-wide audit move.

### Finding 3 (Medium, design caveat): Nested transaction semantics can be surprising
- File: `src/lib/db/index.ts`
- Issue: proxy routes `db.*` to outer tx even within nested transaction callbacks unless nested `tx` object is used explicitly.
- Risk: savepoint rollback expectations can be violated in future code.

## PrimatIA-Specific Verification (F-003 / F-006)

### Confirmed Improvements
- In-transaction dedup insert with `ON CONFLICT DO NOTHING`:
  - `src/app/api/payments/webhook/route.ts:265`
- Tenant filtering in webhook queries:
  - expired session update (`src/app/api/payments/webhook/route.ts:66`)
  - completed session lock query (`src/app/api/payments/webhook/route.ts:238`)
  - failed intent query tenant filter (`src/app/api/payments/webhook/route.ts:151`)
- New dedup table + migration present:
  - `prisma/migrations/20260221_stripe_webhook_dedup/migration.sql:1`
  - Prisma model `StripeWebhookEvent` added (`prisma/schema.prisma:1142`)
- Stripe payment intent metadata includes tenant context:
  - `src/lib/payments/stripe-provider.ts:37`

## EuFund Spot-Check Evidence (>=10 routes)

`withAuthScope` confirmed in:
- `src/app/api/billing/checkout/route.ts:40`
- `src/app/api/billing/info/route.ts:8`
- `src/app/api/billing/portal/route.ts:16`
- `src/app/api/documents/upload/route.ts:28`
- `src/app/api/integrations/cordis/route.ts:8`
- `src/app/api/v1/organizations/route.ts:17`
- `src/app/api/v1/organizations/[id]/route.ts:22`
- `src/app/api/v1/projects/route.ts:19`
- `src/app/api/v1/projects/[id]/route.ts:22`
- `src/app/api/v1/projects/[id]/risks/route.ts:15`
- `src/app/api/v1/projects/[id]/timeline/route.ts:15`
- `src/app/api/v1/projects/[id]/work-packages/[wpId]/route.ts:15`

## Testing / Validation Notes

- Attempted to run `src/lib/db/__tests__/rls-isolation.test.ts`, but local test runtime dependency was unavailable:
  - `vitest: not found`
- Static diff + code-path validation completed.

## Required Fixes Before Declaring Sprint 1 Security Complete

1. Convert `src/app/api/documents/[id]/route.ts` to `withAuthScope` (both handlers).
2. Move both `logAudit()` calls in `src/app/api/documents/[id]/route.ts` outside scoped transaction (follow `auditData` pattern used in other patched routes).
3. Document and enforce nested transaction rule in EuFund:
- Inside nested `db.transaction()`, always use callback `tx` (or update proxy/ALS logic to rebind scope per nested savepoint).

