# Sprint 2 Security Audit (Final)

Date: 2026-02-21
Auditor: Codex (Security Review)
Scope: F-004, F-007, F-008, F-009, F-010, F-011

## Findings (ordered by severity)

### 1) HIGH - RLS migration ordering can break deployment / prevent policy rollout
- Evidence:
  - `prisma/migrations/20260221_add_rls_policies/migration.sql:39` includes `stripe_webhook_events` in the RLS loop.
  - Same migration executes `ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY` for each listed table at `prisma/migrations/20260221_add_rls_policies/migration.sql:46` and `prisma/migrations/20260221_add_rls_policies/migration.sql:52`.
  - `stripe_webhook_events` is created later in `prisma/migrations/20260221_stripe_webhook_dedup/migration.sql:1`.
- Impact:
  - On a fresh migration run, `add_rls_policies` can attempt `ALTER TABLE public.stripe_webhook_events` before the table exists, causing migration failure and blocking release.
- Recommendation:
  - Reorder migrations so table creation runs before RLS policy application, or guard each table with existence checks (`to_regclass(...) IS NOT NULL`) before `ALTER TABLE`.

### 2) HIGH - Tax integer math introduces silent precision truncation
- Evidence:
  - Rates are stored at up to 6 decimal places: `prisma/schema.prisma:446` (`Decimal(12, 6)`).
  - `src/lib/tax-engine/utils.ts:75` converts percent with `Math.round(percent * 100)`, effectively reducing percent precision to 2 decimals.
  - `src/lib/tax-engine/utils.ts:71` rounds lei to bani (`Math.round(amountLei * 100)`), truncating any finer precision.
  - Those rounded values are then used in core calculations: `src/lib/tax-engine/utils.ts:87`.
- Impact:
  - Rates using >2 decimal percent are silently altered before computation.
  - This violates the "no silent truncation" requirement and can produce incorrect tax values.
- Recommendation:
  - Use a higher fixed-point scale (for example parts-per-million / micro-lei) or Decimal math end-to-end, then round once at legal boundaries.

### 3) MEDIUM - Tenant resolution still trusts `x-forwarded-host` directly
- Evidence:
  - `src/lib/tenant-resolution.ts:115` resolves host via `headers.get("x-forwarded-host") ?? headers.get("host")`.
  - This resolver is used in auth-critical routes:
    - `src/app/api/portal/auth/login/route.ts:32`
    - `src/app/api/portal/auth/register/route.ts:52`
    - `src/app/api/portal/auth/forgot-password/route.ts:11`
    - `src/lib/auth.ts:41`
- Impact:
  - If upstream infra does not strip/overwrite forwarded headers, tenant selection can be spoofed by header injection.
- Recommendation:
  - Prefer trusted server URL host (`request.nextUrl.hostname` at the edge) or strictly trust only proxy-sanitized headers.

### 4) MEDIUM - Chatbot defenses improved but regex-based injection/output filters are bypassable
- Evidence:
  - Unicode normalization is present (`NFKC`): `src/app/api/chatbot/route.ts:69`.
  - Prompt injection detection relies on a finite regex list: `src/app/api/chatbot/route.ts:19`.
  - Output blocking also relies on finite regex list: `src/app/api/chatbot/route.ts:30`.
  - Blocking decision path: `src/app/api/chatbot/route.ts:291`.
- Impact:
  - Semantically equivalent paraphrases and obfuscations not in regex patterns can pass the gate.
  - This is partial hardening, not robust injection prevention.
- Recommendation:
  - Keep delimiter wrapping/system constraints, but add stronger classifier-based or policy-engine checks and deny-list/allow-list tests with adversarial suites.

## Checklist Results

1. F-004 RLS
- Coverage: PASS
  - Migration table list matches all Prisma models containing `tenantId` (32/32).
- FORCE RLS: PASS (`prisma/migrations/20260221_add_rls_policies/migration.sql:52`).
- `current_setting` name: PASS (`app.current_tenant_id` in migration at line 67, matches `set_config('app.current_tenant_id', ...)` in `src/lib/db.ts:61`, `src/lib/db.ts:113`, `src/lib/db.ts:155`).
- Overall status: FAIL (due migration ordering defect above).

2. F-007 Chatbot
- Prompt injection defenses bypassable: YES (partial hardening only).
- Unicode normalization handled: YES (`NFKC` at `src/app/api/chatbot/route.ts:69`).
- Overall status: PARTIAL / FAIL.

3. F-008 Tax
- Integer math strategy present: YES.
- No silent truncation: NO (precision loss in percent/bani conversions).
- Rounding correctness: PARTIAL (rounding exists, but precision is reduced earlier than required).
- Decimal handling safety: PARTIAL (`toSafeNumber` validates finite values, but not precision/safe-integer range).
- Overall status: FAIL.

4. F-009 Password
- Registration validation: PASS (`strongPasswordSchema` used in `src/app/api/portal/auth/register/route.ts:15`).
- Password reset validation:
  - Citizen reset: PASS (`src/app/api/portal/auth/reset-password/route.ts:8`).
  - Staff reset: PASS (`src/app/api/auth/reset-password/route.ts:8`).
- Overall status: PASS.

5. F-010 Tenant header
- No direct `tenantId` read from request headers (`x-tenant-id`) remains in `src` (search returned no matches).
- Overall status: PASS with hardening caveat (forwarded-host trust issue above).

6. F-011 Cross-tenant login
- Citizen login query includes tenant: PASS (`src/lib/citizen-auth.ts:24`, composite `tenantId_email`).
- Staff/admin login query includes tenant: PASS (`src/lib/auth.ts:52` with `tenantId` in `where`).
- Overall status: PASS.

## Final Verdict

Sprint 2 resolves major portions of F-009, F-010, and F-011, and adds substantial controls for F-004/F-007/F-008. However, release should be blocked until Findings #1 and #2 are fixed, and Findings #3/#4 are hardened.
