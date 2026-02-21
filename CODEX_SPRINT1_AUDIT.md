# Security Audit — Sprint 1 Patch Review

Date: 2026-02-21
Auditor: Codex (security-focused code audit)

Scope:
- Plan sections reviewed: `F-002`, `F-003`, `F-006` from `MASTER_REMEDIATION_PLAN.md`
- Patch Set 1 (PrimatIA): payment webhook + Stripe metadata + migration `20260221_stripe_webhook_dedup`
- Patch Set 2 (EuFund): RLS activation via `withUserScope()` + proxy DB + document route updates + new RLS tests

## Findings (ordered by severity)

### 1) CRITICAL — F-002 is only partially remediated; RLS remains effectively optional
**Why this matters:** The plan issue was that RLS policies were dead because `set_config('app.user_id', ...)` was never consistently activated. The patch adds `withUserScope()`, but most authenticated routes still do not use it.

**Evidence:**
- `withUserScope()` exists: `EuFund/app/src/lib/db/index.ts:114`
- New helper `withAuthScope()` exists but is not used outside comments: `EuFund/app/src/lib/auth/helpers.ts:49`, `EuFund/app/src/lib/auth/helpers.ts:42`
- In API routes, `withUserScope()` appears only in one file (`documents/[id]`): `EuFund/app/src/app/api/documents/[id]/route.ts:56`, `EuFund/app/src/app/api/documents/[id]/route.ts:118`
- Other sensitive routes still do `requireAuth()` + direct `db` calls without scope, e.g.:
  - `EuFund/app/src/app/api/v1/projects/[id]/route.ts:20`, `EuFund/app/src/app/api/v1/projects/[id]/route.ts:23`
  - `EuFund/app/src/app/api/v1/projects/[id]/compliance/ai-score/route.ts:17`, `EuFund/app/src/app/api/v1/projects/[id]/compliance/ai-score/route.ts:20`

**Impact:** Any missing app-layer authorization check in unscoped routes is still a potential cross-org data breach. Defense-in-depth is still incomplete.

**Required fix:** Enforce scoped execution for *all* authenticated DB handlers (e.g., `withAuthScope` wrapper in every protected route, or a shared route utility that makes unscoped `db` access impossible).

---

### 2) HIGH — Document authorization gaps remain outside the patched endpoint
**Why this matters:** `documents/[id]` now validates membership, but other document endpoints still bypass equivalent checks.

**Evidence:**
- Patched endpoint enforces scoped access + org/project checks: `EuFund/app/src/app/api/documents/[id]/route.ts:56`, `EuFund/app/src/app/api/documents/[id]/route.ts:67`
- `documents/[id]/analyze` still fetches by ID and processes content without `withUserScope()` or `requireDocumentAccess()`:
  - fetch: `EuFund/app/src/app/api/documents/[id]/analyze/route.ts:25`
  - no org/project authorization before read/analyze/update: `EuFund/app/src/app/api/documents/[id]/analyze/route.ts:33`, `EuFund/app/src/app/api/documents/[id]/analyze/route.ts:68`
- `documents/upload` is also unscoped and only validates `orgId` if provided; `projectId` ownership is not validated at insert path:
  - auth check only for `orgId`: `EuFund/app/src/app/api/documents/upload/route.ts:59`
  - direct insert of user-provided `projectId`: `EuFund/app/src/app/api/documents/upload/route.ts:98`

**Impact:** Cross-org document operations can still occur via endpoints not covered by the patch.

**Required fix:** Port `requireDocumentAccess` + `withAuthScope/withUserScope` pattern to `documents/[id]/analyze` and validate `projectId` ownership on upload.

---

### 3) HIGH — PrimatIA still has a payment status race in `payment_intent.payment_failed`
**Why this matters:** The `checkout.session.completed` race was fixed, but another state transition race remains and can corrupt payment state.

**Evidence:**
- Failed-intent path updates payment to `failed` without guarding current status:
  - `PrimatIA/src/app/api/payments/webhook/route.ts:153`
- Confirmed path sets `confirmed` in a transaction:
  - `PrimatIA/src/app/api/payments/webhook/route.ts:314`

**Race scenario:** Out-of-order/concurrent webhook delivery (`checkout.session.completed` vs `payment_intent.payment_failed`) can end with a previously confirmed payment flipped back to `failed`.

**Required fix:** In failed-intent branch, add state guard (`status IN ('initiated','pending')`) and/or lock row in tenant-scoped transaction before transition.

---

### 4) MEDIUM — Migration is functionally correct but operationally risky for production scale
**Why this matters:** The migration is idempotent and addresses duplicate event IDs, but it may cause write blocking and drops historical linkage data.

**Evidence:**
- Duplicate cleanup nulls all but one historical `stripe_event_id`: `PrimatIA/prisma/migrations/20260221_stripe_webhook_dedup/migration.sql:12`
- Unique index creation is non-concurrent: `PrimatIA/prisma/migrations/20260221_stripe_webhook_dedup/migration.sql:29`

**Impact:**
- Potential lock/write contention on `online_payments` during index build.
- Loss of duplicate historical `stripe_event_id` values (audit trace reduced unless preserved elsewhere).

**Required fix:** Run in maintenance window or split into phased migration (pre-cleanup + concurrent index strategy outside Prisma transaction constraints) and capture dropped duplicate mappings before nulling.

---

### 5) MEDIUM — Test coverage does not prove end-to-end RLS safety in CI
**Why this matters:** Unit tests are mostly mocked; real DB/RLS behavior is optional.

**Evidence:**
- Integration tests are gated and skipped unless `INTEGRATION=true`: `EuFund/app/src/lib/db/__tests__/rls-isolation.test.ts:336`, `EuFund/app/src/lib/db/__tests__/rls-isolation.test.ts:338`
- Unit tests mock DB modules heavily, so they do not validate real query routing or policy enforcement.

**Impact:** Regressions in real RLS activation can ship undetected.

**Required fix:** Run integration RLS tests in CI against a real Postgres instance with `rls.sql` applied.

## Checklist Answers

1. **Do the fixes prevent the attacks in the plan?**
- **F-003 (double-spend race):** **Mostly yes** for `checkout.session.completed` (row lock + in-transaction dedup + state machine + pre-write amount checks).
- **F-006 (cross-tenant webhook queries):** **Yes** for patched query paths (`checkout.session.expired`, `payment_intent.payment_failed`, `checkout.session.completed`) with tenant metadata filtering.
- **F-002 (dead RLS):** **Partially only**. Mechanism exists, but not broadly adopted; many routes still run unscoped.

2. **Can attacker bypass new protections?**
- **Yes (EuFund):** Hit authenticated routes that are still unscoped (`withUserScope` not used), so RLS remains inactive there.
- **Yes (EuFund documents):** `documents/[id]/analyze` still lacks equivalent authorization enforcement.
- **PrimatIA:** Primary double-spend bypass is significantly reduced, but payment state can still be corrupted by race in failed-intent path.

3. **SQL injection vectors in new code?**
- No direct SQL injection found in the new patch code. New raw SQL uses parameterized APIs (`Prisma.sql` / Drizzle `sql` templates).

4. **Transaction isolation correctness (`SET LOCAL`, savepoint behavior)?**
- **PrimatIA:** `withTenantScope` transaction + `set_config(..., true)` usage remains correct for transaction-local tenant context (`PrimatIA/src/lib/db.ts:154`).
- **EuFund:** `withUserScope` correctly sets `app.user_id` transaction-locally and proxy routes calls through scoped tx (`EuFund/app/src/lib/db/index.ts:114`).
- Savepoint behavior is conceptually correct when nested transactions are executed through scoped tx.

5. **Race conditions in new code itself?**
- `checkout.session.completed` race remediation is good.
- Remaining race: failed-intent path can overwrite confirmed status (see Finding #3).

6. **Is the Prisma migration safe for production?**
- **Logical correctness:** acceptable.
- **Operational safety:** needs rollout caution (table locks + duplicate-ID nulling behavior). Not “unsafe by design,” but risky without deployment controls.

7. **What did authors miss that still needs fixing?**
- Enforce `withUserScope/withAuthScope` across all authenticated routes (not just one endpoint).
- Patch document analyze/upload authorization and project ownership checks.
- Fix payment state race in `payment_intent.payment_failed`.
- Add CI-enforced integration tests for real RLS behavior.
- Validate production DB role posture for RLS (`NOBYPASSRLS`, non-owner/superuser, FORCE RLS coverage).

## Positive Notes

- PrimatIA webhook hardening for `checkout.session.completed` is materially improved: in-transaction dedup insertion, row lock, strict transition checks, and earlier amount validation.
- Stripe payment intent metadata propagation was added (`PrimatIA/src/lib/payments/stripe-provider.ts:39`), supporting tenant-scoped failed-intent handling.
- EuFund introduced a sound technical foundation (`withUserScope` + proxied DB) for real RLS activation; rollout completeness is the main remaining gap.
