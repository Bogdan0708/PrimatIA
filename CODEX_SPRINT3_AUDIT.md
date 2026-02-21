# Sprint 3 Security Audit (Final)

Date: 2026-02-21  
Auditor: Codex (Security Audit)

Scope reviewed from `MASTER_REMEDIATION_PLAN.md`: F-005, F-007, F-013, F-014..F-022.

## Executive Verdict

- PASS: 3 controls
- PARTIAL: 5 controls
- FAIL: 2 controls

Critical unresolved items remain (CSRF cookie exposure, unhashed reset tokens, unescaped ILIKE wildcard query, partial prompt-injection bypasses).

## Spot-Check Coverage

PrimatIA (sample >=5, reviewed 13):
- `src/lib/citizen-auth.ts`
- `src/lib/portal-auth.ts`
- `src/app/api/portal/auth/login/route.ts`
- `src/app/api/chatbot/route.ts`
- `src/lib/rate-limit/chatbot-rate-limit.ts`
- `src/app/api/documents/process/route.ts`
- `src/app/api/payments/webhook/route.ts`
- `src/app/api/portal/payments/confirm/route.ts`
- `src/app/api/payments/bank-transfer/confirm/route.ts`
- `src/lib/payments/online-payment-state-machine.ts`
- `src/app/api/portal/profile/route.ts`
- `src/app/api/portal/auth/register/route.ts`
- `src/middleware.ts`

EuFund (sample >=5, reviewed 14):
- `src/middleware.ts`
- `src/lib/csrf/client.ts`
- `src/lib/email/password-reset.ts`
- `src/lib/email/verification.ts`
- `src/lib/db/schema.ts`
- `src/app/api/v1/projects/route.ts`
- `src/lib/ai/sanitize.ts`
- `src/lib/rag/pipeline.ts`
- `src/lib/ai/proposal-generator.ts`
- `src/lib/ai/enhanced-proposal-generator.ts`
- `src/app/api/documents/upload/route.ts`
- `src/app/api/ai/analyze-document/route.ts`
- `src/lib/middleware/auth.ts`
- `src/lib/redis/client.ts`

## Checklist Results

### 1) F-014: CSRF cookie `httpOnly`
Verdict: **FAIL**

Evidence:
- `src/middleware.ts:187` sets `csrf-token` cookie with `httpOnly: false`.
- `src/lib/csrf/client.ts:9` reads CSRF token from `document.cookie`, confirming browser-readable token design.

Impact:
- Any XSS can read CSRF cookie token and bypass double-submit defense.

### 2) F-015/F-016: Token hashing before storage + hash-to-hash comparison
Verdict: **PARTIAL**

F-015 (PrimatIA email verification): **PASS**
- `src/lib/citizen-auth.ts:6-8` SHA-256 hashing helper.
- `src/lib/citizen-auth.ts:127-140` stores hash, returns raw token only for email delivery.
- `src/lib/citizen-auth.ts:162-166` verifies by hashing presented token and comparing hash.

F-016 (EuFund password reset): **FAIL**
- `src/lib/email/password-reset.ts:16-20` stores raw `token`.
- `src/lib/email/password-reset.ts:30` queries by raw token.
- `src/lib/db/schema.ts:78` column is `token` (not hash).

### 3) F-017: App fails to start without JWT secret, no fallbacks
Verdict: **PASS (with caveat)**

Evidence:
- `src/lib/portal-auth.ts:8-12` throws if `JWT_SECRET` is missing.
- `src/app/api/portal/auth/login/route.ts:6-10` same behavior.
- No fallback chain for citizen JWT secret found.

Caveat:
- Validation is module-load based, not one centralized boot validator.

### 4) F-018: All ILIKE queries escaped (both projects)
Verdict: **FAIL**

PrimatIA:
- No `ilike(`/`ILIKE` usage found in `src` via audit grep.

EuFund:
- `src/app/api/v1/projects/route.ts:57` uses `ilike(projects.title, `%${search}%`)` without escaping `%`/`_`.

Impact:
- Wildcard expansion allows uncontrolled broad matches and query manipulation of search semantics.

### 5) F-019: Persistent rate limiter (Redis/DB), multi-instance safe
Verdict: **PARTIAL**

Positive:
- PrimatIA chatbot path is Redis-backed (`src/lib/rate-limit/chatbot-rate-limit.ts:133-163`) and fail-closed in production on Redis failure (`:137-139`, `:171-173`).

Gap:
- PrimatIA global middleware rate limiting still uses in-memory `Map` (`src/middleware.ts:15`), not cross-instance persistent.

### 6) F-020: File upload magic-byte validation + size limits
Verdict: **PARTIAL**

PrimatIA: **PASS**
- Size limit enforced at `src/app/api/documents/process/route.ts:100-104`.
- Magic-byte/type detection at `:47-60`, enforcement at `:110-117`.

EuFund: **MIXED**
- `src/app/api/documents/upload/route.ts` has size + magic-byte checks (`:47-52`, `:67-79`).
- `src/app/api/ai/analyze-document/route.ts` accepts uploaded files by MIME/type branch only (`:47-65`) without magic-byte verification.

### 7) F-021: All portal queries after tenant context set
Verdict: **PARTIAL**

Fixed where originally targeted:
- `src/app/api/portal/profile/route.ts:11` sets tenant context before first query.

Remaining unscope paths:
- `src/app/api/portal/auth/login/route.ts` performs auth flow without `setTenantContext`/`withTenantScope`.
- `src/app/api/portal/auth/register/route.ts:97` performs `prisma.tenant.findUnique` outside tenant scope.
- `src/lib/citizen-auth.ts` uses explicit tenant filters, but no enforced tenant context wrapper.

### 8) F-022: Payment state machine on all transition paths (not just webhook)
Verdict: **PASS**

Evidence:
- State machine defined in `src/lib/payments/online-payment-state-machine.ts:12-50`.
- Webhook transitions guarded with `allowedFromStatusesFor`/`canTransition` in `src/app/api/payments/webhook/route.ts:73`, `:150`, `:269`, `:352`.
- Portal mock confirm guarded in `src/app/api/portal/payments/confirm/route.ts:63`, `:86`.
- Bank transfer confirm guarded in `src/app/api/payments/bank-transfer/confirm/route.ts:47`, `:77`.

### 9) F-005: `sanitize.ts` adversarial tests (Unicode, invisible chars, delimiter injection)
Verdict: **PARTIAL (bypasses still present)**

Runtime tests executed directly against `src/lib/ai/sanitize.ts` via Node TS strip mode.

Observed:
- PASS: Full-width Unicode normalization catches injection.
- PASS: Zero-width + bidi controls are stripped; injection detected.
- PASS: Direct internal delimiter tokens are stripped by `wrapUserInput`.
- FAIL: Cyrillic homoglyph bypass (`іgnore previous instructions`) is not detected.
- FAIL: ASCII lookalike delimiters (`---BEGIN...---`) are not stripped/detected.

Relevant implementation lines:
- Normalization: `src/lib/ai/sanitize.ts:92-97`
- Injection detection regexes: `src/lib/ai/sanitize.ts:55-71`, `:145-148`
- Delimiter stripping logic: `src/lib/ai/sanitize.ts:279-283`

### 10) F-013: RAG provenance tracking + chunk validation before LLM ingestion
Verdict: **PARTIAL**

Validated chunk controls:
- Retrieval validation: `src/lib/rag/pipeline.ts:58-74`, enforced at `:180-201`.
- Ingestion-time chunk validation: `src/lib/rag/pipeline.ts:260-287`.
- Source metadata enrichment exists (`sourceId`, `sourceDocumentId`) at `:109-113`, `:195-197`, `:280-282`.

Provenance gap:
- Downstream proposal generators inject chunk text but drop source identifiers in prompt context:
  - `src/lib/ai/proposal-generator.ts:132-134`
  - `src/lib/ai/enhanced-proposal-generator.ts:255`
- They return only count (`ragSourcesUsed`) not explicit provenance list (`:215` in proposal-generator).

## Additional Note (F-007)
PrimatIA chatbot hardening is substantially improved (input normalization, delimiter wrapping, injection heuristics, output filtering) in `src/app/api/chatbot/route.ts` with Redis-backed limiter.

## Priority Remediation (Blockers)

1. CSRF: set `csrf-token` cookie `httpOnly: true` and migrate client token propagation to header/bootstrap flow (remove `document.cookie` dependency).
2. EuFund reset tokens: store SHA-256 hash only; query/consume by hashed token.
3. Escape ILIKE inputs in EuFund project search (`%` and `_` with explicit escape clause).
4. Expand prompt-injection detection for mixed-script homoglyphs and delimiter lookalikes.
5. Expose/stash RAG source provenance IDs end-to-end (prompt + API output + audit trail).
