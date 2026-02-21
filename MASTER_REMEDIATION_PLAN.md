# MASTER REMEDIATION PLAN
## PrimatIA & EuFund — Multi-Agent Security Audit Synthesis

**Date:** February 20, 2026  
**Synthesized by:** Claude Opus (Master Orchestrator)  
**Sources:** 5 independent audit reports from Codex CVE, Opus Tenant, Gemini AI/BL, Codex Security, Gemini Technical  

---

## 1. Executive Summary

### Total Unique Vulnerabilities: 27

| Severity | Count | Examples |
|----------|-------|---------|
| **Critical** | 5 | Next.js RCE (CVE-2025-66478/55182), EuFund RLS not enforced, Payment race condition, Prompt injection bypass |
| **High** | 9 | No DB-level RLS (PrimatIA), Stripe webhook cross-tenant queries, Tax floating-point precision, Password policy missing, Chatbot prompt injection |
| **Medium** | 8 | CSRF cookie not httpOnly, Email verification token unhashed, JWT secret fallback, ILIKE wildcard escaping, In-memory rate limiter |
| **Low** | 5 | Dev Docker exposed services, trustHost:true, Error message leakage, AI audit trail missing, Regex HTML sanitization |

### Auditor Agreement Summary

**High consensus (3+ auditors confirmed):**
- EuFund RLS not enforced — Codex Security, Opus Tenant, Gemini AI/BL all flagged
- Next.js RSC RCE vulnerability — Codex CVE, Perplexity Research, Security Research all confirmed
- PrimatIA payment race condition — Codex Security, Gemini AI/BL, Opus Tenant all identified
- PrimatIA chatbot prompt injection — Codex Security, Gemini AI/BL both flagged

**Single-auditor findings (needs verification):**
- Tax floating-point precision attacks — Gemini AI/BL only
- Novel multi-stage attack chains — Gemini AI/BL only (theoretical)
- Training data leakage risk — Gemini AI/BL only

### Overall Risk Assessment

| Platform | Risk Level | Rationale |
|----------|-----------|-----------|
| **PrimatIA** | **HIGH** | Unpatched Next.js RCE (CVSS 10.0), no DB-level RLS, Stripe webhook cross-tenant queries, payment race conditions. Financial data at risk. |
| **EuFund** | **CRITICAL** | Unpatched Next.js RCE + RLS policies are dead code (false sense of security) + extensive AI attack surface. EU funding fraud possible. |

---

## 2. Cross-Validation Matrix

| # | Finding | Codex CVE | Opus Tenant | Gemini AI/BL | Codex Security | Gemini Tech | Severity | Confidence |
|---|---------|-----------|-------------|--------------|----------------|-------------|----------|------------|
| 1 | Next.js RSC RCE (CVE-2025-66478/55182) | ✅ Primary | — | — | — | — | Critical | **Very High** (CVE confirmed, actively exploited) |
| 2 | EuFund RLS policies never activated | — | ✅ Primary | ✅ Noted | ✅ Primary | — | Critical | **Very High** (3 auditors) |
| 3 | Payment race condition (double-spend) | — | ✅ Noted | ✅ Primary | ✅ Primary | — | Critical | **Very High** (3 auditors) |
| 4 | PrimatIA no DB-level RLS | — | ✅ Primary | — | — | — | Critical | **High** (1 auditor, clear evidence) |
| 5 | Prompt injection delimiter bypass | — | — | ✅ Primary | ✅ Noted | — | Critical | **High** (2 auditors) |
| 6 | Stripe webhook cross-tenant queries | — | ✅ Primary | — | — | — | High | **High** (detailed code evidence) |
| 7 | PrimatIA chatbot prompt injection | — | — | ✅ Noted | ✅ Primary | — | High | **High** (2 auditors) |
| 8 | Tax calculation floating-point | — | — | ✅ Primary | — | — | High | **Medium** (1 auditor, needs verification) |
| 9 | No password strength validation | — | — | — | ✅ Primary | — | High | **High** (clear code evidence) |
| 10 | Tenant ID from client header | — | — | — | ✅ Primary | — | High | **High** (clear code evidence) |
| 11 | Cross-tenant admin login | — | ✅ Primary | — | — | — | High | **High** (clear code evidence) |
| 12 | EuFund AI routes missing org auth | — | ✅ Primary | ✅ Noted | — | — | High | **High** (2 auditors) |
| 13 | RAG system poisoning | — | — | ✅ Primary | — | — | High | **Medium** (1 auditor, theoretical) |
| 14 | CSRF token not httpOnly | — | — | — | ✅ Primary | — | Medium | **High** (clear code evidence) |
| 15 | Email verification token unhashed | — | — | — | ✅ Primary | — | Medium | **High** |
| 16 | EuFund password reset token unhashed | — | — | — | ✅ Primary | — | Medium | **High** |
| 17 | JWT secret fallback chain | — | — | — | ✅ Primary | — | Medium | **High** |
| 18 | ILIKE wildcard unescaped | — | — | — | ✅ Primary | — | Medium | **Medium** |
| 19 | In-memory rate limiter (chatbot) | — | — | — | ✅ Primary | — | Medium | **High** |
| 20 | Document upload no size/type validation | — | — | — | ✅ Primary | — | Medium | **Medium** |
| 21 | Portal profile queries before tenant context | — | ✅ Primary | — | — | — | Medium | **High** |
| 22 | Payment state transition validation | — | — | ✅ Primary | — | — | Medium | **Medium** (1 auditor) |
| 23 | Dev Docker services exposed | — | — | — | ✅ Primary | — | Low | **High** |
| 24 | trustHost:true in NextAuth | — | — | — | ✅ Primary | — | Low | **High** |
| 25 | Error messages leak internals | — | — | — | ✅ Primary | — | Low | **High** |
| 26 | AI audit trail missing (EuFund) | — | — | — | ✅ Primary | — | Low | **High** |
| 27 | Chatbot HTML sanitization regex-based | — | — | — | ✅ Primary | — | Low | **Medium** |

---

## 3. Deduplicated Findings (Ranked)

### F-001: Next.js RSC Remote Code Execution (CVE-2025-66478 / CVE-2025-55182)
- **Severity:** CRITICAL (CVSS 10.0) | **Projects:** PrimatIA, EuFund
- **Auditors:** Codex CVE (primary), Perplexity Research, Security Research
- **Description:** Both projects run Next.js 14.2.35 with React ~18.3.1. The "React2Shell" vulnerability allows unauthenticated RCE via crafted RSC Flight protocol payloads. Actively exploited in the wild by China-nexus threat groups and the RondoDox botnet since Dec 2025. Every page load using server components is an attack surface.
- **Current state:** UNPATCHED. Both projects are on vulnerable versions.
- **Remediation:**
  1. `npm install next@14.2.39+ react@18.3.5+ react-dom@18.3.5+` in both projects
  2. Rebuild and redeploy Docker images
  3. Rotate ALL secrets (assume potential compromise since Dec 2025)
  4. Review access logs for suspicious RSC requests since Dec 2025
  5. Deploy WAF rules for RSC protocol payload inspection
- **Effort:** 2-4 hours (upgrade + test + deploy) + 2-4 hours (secret rotation)

### F-002: EuFund RLS Policies Are Dead Code
- **Severity:** CRITICAL | **Project:** EuFund
- **Auditors:** Codex Security (primary), Opus Tenant (primary), Gemini AI/BL (noted)
- **Description:** `rls.sql` defines comprehensive RLS policies referencing `current_setting('app.user_id', true)::uuid`, but the application NEVER calls `set_config('app.user_id', ...)`. The Drizzle DB client connects without user context. RLS either silently blocks everything (DoS) or is bypassed entirely (if app user is table owner/superuser). Authorization relies solely on application-layer Drizzle `where` clauses — a single missing filter = full data breach. Creates dangerous false sense of security.
- **Current state:** RLS is dead code. App-layer filtering works but has no defense-in-depth.
- **Remediation:**
  1. Run `SELECT relname, relrowsecurity, relforcerowlevel FROM pg_class` to verify actual state
  2. Either: implement `set_config` in a Drizzle transaction wrapper for every request, OR remove RLS policies and document app-layer-only isolation
  3. Audit ALL Drizzle queries for missing org filters (especially `/api/ai/*` routes)
  4. Add integration tests that attempt cross-org data access
- **Effort:** 8-16 hours (implement proper RLS activation) or 4 hours (remove + document)

### F-003: Payment Processing Race Condition (Double-Spend)
- **Severity:** CRITICAL | **Project:** PrimatIA
- **Auditors:** Codex Security (primary), Gemini AI/BL (primary), Opus Tenant (noted)
- **Description:** Stripe webhook `stripeEventId` dedup check happens OUTSIDE the `withTenantScope` transaction. Two concurrent webhook deliveries can both pass the dedup check before either writes. Results in double payment recording, corrupting financial records. Additionally, amount validation occurs after status update, and no state transition validation exists (expired→confirmed is possible).
- **Current state:** Vulnerable. `FOR UPDATE` locks exist on `Impozit` rows but dedup is outside transaction.
- **Remediation:**
  1. Move dedup check inside the transaction
  2. Add UNIQUE constraint on `stripeEventId` with `ON CONFLICT DO NOTHING`
  3. Add payment state machine validation (only `initiated→confirmed` is valid)
  4. Move amount validation before any status updates
- **Effort:** 4-8 hours

### F-004: PrimatIA Has No Database-Level RLS
- **Severity:** CRITICAL | **Project:** PrimatIA
- **Auditors:** Opus Tenant (primary)
- **Description:** Zero SQL RLS policies exist. All tenant isolation relies on application code calling `setTenantContext()`/`withTenantScope()`. While the app-layer pattern is well-implemented (using `SET LOCAL` in transactions, PgBouncer-safe), a single missed call = full cross-tenant data access. No defense-in-depth at the database layer.
- **Current state:** App-layer isolation is thorough but no DB-layer backup.
- **Remediation:**
  1. Create RLS policies on all tenant-scoped tables using `current_setting('app.current_tenant_id')`
  2. Enable RLS with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`
  3. Ensure app DB role has `NOBYPASSRLS`
  4. Test that unscoped queries return zero rows
- **Effort:** 8-16 hours (policy creation + testing for all tables)

### F-005: Advanced Prompt Injection Bypass (EuFund)
- **Severity:** CRITICAL | **Project:** EuFund
- **Auditors:** Gemini AI/BL (primary), Codex Security (noted)
- **Description:** EuFund's `wrapUserInput()` delimiter system is bypassed by Unicode normalization attacks, homoglyph substitution, and nested instruction injection. Document upload pipeline passes unsanitized extracted text to AI. Combined with missing org auth on AI routes, this enables cross-org data exfiltration via AI.
- **Current state:** Basic delimiter protection exists but is insufficient for sophisticated attacks.
- **Remediation:**
  1. Add Unicode normalization (NFKC) before delimiter detection
  2. Implement ML-based prompt injection detection (classification model)
  3. Sanitize all document-extracted text before AI processing
  4. Add human-in-the-loop for critical AI decisions (compliance reports)
  5. Log all AI interactions for audit trail
- **Effort:** 16-24 hours

### F-006: Stripe Webhook Cross-Tenant Queries
- **Severity:** HIGH | **Project:** PrimatIA
- **Auditors:** Opus Tenant (primary)
- **Description:** Webhook handler queries `onlinePayment` table without tenant filtering. Line 114: `findMany({ where: { status: "initiated" } })` scans ALL tenants' payments. Leaks existence/gateway refs of other tenants' payments. Other lines update by `gatewayRef` without tenant filter.
- **Current state:** Vulnerable. Metadata contains tenantId but it's not used for pre-checks.
- **Remediation:** Add `tenantId` filter to ALL webhook queries using Stripe metadata.
- **Effort:** 2-4 hours

### F-007: PrimatIA Chatbot Prompt Injection
- **Severity:** HIGH | **Project:** PrimatIA
- **Auditors:** Codex Security (primary), Gemini AI/BL (noted)
- **Description:** No input sanitization, no delimiter wrapping, no injection detection. History messages have no content sanitization. Attacker can inject system-altering instructions via crafted history to manipulate chatbot responses, potentially generating misleading tax advice.
- **Current state:** Only defense is 1000-char limit on current message.
- **Remediation:**
  1. Port EuFund's `wrapUserInput()` pattern
  2. Add injection detection with logging
  3. Add length limits on history message content
  4. Add disclaimer that AI responses are not legal/tax advice
- **Effort:** 4-8 hours

### F-008: Tax Calculation Floating-Point Precision
- **Severity:** HIGH | **Project:** PrimatIA
- **Auditors:** Gemini AI/BL (primary only — needs verification)
- **Description:** Tax calculations use JavaScript floating-point arithmetic. Division/multiplication chains can accumulate precision errors. Co-ownership fractional percentages and large area values amplify the issue. Could enable tax evasion through precision manipulation.
- **Current state:** Uses native JS arithmetic with `roundToLei()` at the end.
- **Remediation:**
  1. Verify actual precision impact with test cases (may be theoretical)
  2. If confirmed: replace with `Decimal.js` or integer arithmetic (cents)
  3. Add property-based tests for calculation correctness
- **Effort:** 8-16 hours (if confirmed necessary)

### F-009: No Password Strength Validation (Citizen Registration)
- **Severity:** HIGH | **Project:** PrimatIA
- **Auditors:** Codex Security (primary)
- **Description:** Registration accepts any password including "1". Bcrypt(12) hashing doesn't help if password is trivially guessable.
- **Remediation:** Add Zod schema with min 8 chars, mixed case/numbers. Consider `zxcvbn`.
- **Effort:** 1-2 hours

### F-010: Citizen Tenant ID from Client Header
- **Severity:** HIGH | **Project:** PrimatIA
- **Auditors:** Codex Security (primary)
- **Description:** `x-tenant-id` header trusted from client. Enables cross-tenant brute-force.
- **Remediation:** Derive tenant from domain/subdomain, or add rate limiting per tenant+IP.
- **Effort:** 4-8 hours

### F-011: Cross-Tenant Admin Login (Email Collision)
- **Severity:** HIGH | **Project:** PrimatIA
- **Auditors:** Opus Tenant (primary)
- **Description:** Login queries `tenantUser` by email without tenant filtering. `findFirst` returns arbitrary tenant if same email exists in multiple tenants.
- **Remediation:** Enforce globally unique emails OR require tenant selection at login.
- **Effort:** 2-4 hours

### F-012: EuFund AI Routes Missing Org Authorization
- **Severity:** HIGH | **Project:** EuFund
- **Auditors:** Opus Tenant (primary), Gemini AI/BL (noted)
- **Description:** ~20 AI API routes may accept `projectId` without verifying org membership. Any authenticated user could potentially analyze any project.
- **Remediation:** Audit all `/api/ai/*` routes; add `requireOrgRole()` checks.
- **Effort:** 4-8 hours

### F-013: RAG System Poisoning
- **Severity:** HIGH | **Project:** EuFund
- **Auditors:** Gemini AI/BL (primary only)
- **Description:** No validation of document provenance before inclusion in AI context. Poisoned documents could alter AI recommendations.
- **Remediation:** Validate document sources, add content integrity checks, tenant-scope all RAG retrieval.
- **Effort:** 8-16 hours

### F-014: CSRF Token Cookie Not httpOnly
- **Severity:** MEDIUM | **Project:** EuFund
- **Auditors:** Codex Security (primary)
- **Description:** CSRF cookie readable by JS. If XSS exists, CSRF protection is fully bypassed. Client already gets token via `X-CSRF-Token` header.
- **Remediation:** Set `httpOnly: true` on CSRF cookie.
- **Effort:** 30 minutes

### F-015: Email Verification Token Stored Unhashed
- **Severity:** MEDIUM | **Project:** PrimatIA
- **Auditors:** Codex Security (primary)
- **Remediation:** Hash with SHA-256 before storage (same pattern as password reset tokens).
- **Effort:** 1-2 hours

### F-016: EuFund Password Reset Token Stored Unhashed
- **Severity:** MEDIUM | **Project:** EuFund
- **Auditors:** Codex Security (primary)
- **Remediation:** Store SHA-256 hash, compare hashes on verification.
- **Effort:** 1-2 hours

### F-017: JWT Secret Fallback Chain
- **Severity:** MEDIUM | **Project:** PrimatIA
- **Auditors:** Codex Security (primary)
- **Description:** Three env vars can serve as JWT secret. Weak-link-in-chain risk.
- **Remediation:** Use dedicated mandatory `CITIZEN_JWT_SECRET` with no fallback. Validate entropy on startup.
- **Effort:** 1-2 hours

### F-018: ILIKE Wildcard Unescaped
- **Severity:** MEDIUM | **Project:** EuFund
- **Auditors:** Codex Security (primary)
- **Remediation:** Escape `%` and `_` in search input.
- **Effort:** 30 minutes

### F-019: In-Memory Rate Limiter (Chatbot)
- **Severity:** MEDIUM | **Project:** PrimatIA
- **Auditors:** Codex Security (primary)
- **Description:** Per-instance Map. Useless in multi-instance deployment.
- **Remediation:** Use Redis-based rate limiting (Redis already in stack).
- **Effort:** 2-4 hours

### F-020: Document Upload Missing Size/Type Validation
- **Severity:** MEDIUM | **Project:** PrimatIA
- **Auditors:** Codex Security (primary)
- **Remediation:** Add maxFileSize (10MB), MIME type allowlist, streaming for large files.
- **Effort:** 1-2 hours

### F-021: Portal Profile Queries Before Tenant Context
- **Severity:** MEDIUM | **Project:** PrimatIA
- **Auditors:** Opus Tenant (primary)
- **Remediation:** Move `setTenantContext()` before first query in all handlers.
- **Effort:** 1-2 hours

### F-022: Payment State Transition Validation Missing
- **Severity:** MEDIUM | **Project:** PrimatIA
- **Auditors:** Gemini AI/BL (primary)
- **Remediation:** Add state machine validation (only valid transitions allowed).
- **Effort:** 2-4 hours

### F-023–F-027: Low Severity Findings
- **F-023:** Dev Docker services bound to 0.0.0.0 → bind to 127.0.0.1 (30 min)
- **F-024:** `trustHost: true` in NextAuth → set explicit domain (30 min)
- **F-025:** Error messages leak internals → return generic messages (1 hour)
- **F-026:** AI audit trail missing (EuFund) → add logging for AI interactions (2-4 hours)
- **F-027:** Regex-based HTML sanitization in chatbot → use DOMPurify or ensure no dangerouslySetInnerHTML (1 hour)

---

## 4. Remediation Roadmap

### Sprint 1 — Week 1: Critical P0s (Production Safety)

| Task | Finding | Effort | Parallelizable |
|------|---------|--------|----------------|
| **Upgrade Next.js + React** (both projects) | F-001 | 4h | Yes (per project) |
| **Rotate all secrets** (both projects) | F-001 | 4h | Yes (per project) |
| **Fix payment race condition** (PrimatIA) | F-003 | 6h | Yes |
| **Resolve EuFund RLS** (decide: activate or remove) | F-002 | 8h | Yes |
| **Add tenant filter to Stripe webhook** | F-006 | 3h | Yes |
| **Deploy WAF rules for RSC** | F-001 | 2h | Yes |

**Sprint 1 Total: ~27 hours** (parallelizable to ~12h with 3 developers)

**Dependencies:** F-001 must complete before any code changes can be safely deployed (no point fixing code on a compromised server).

### Sprint 2 — Week 2: High-Severity Issues

| Task | Finding | Effort | Parallelizable |
|------|---------|--------|----------------|
| **PrimatIA DB-level RLS** | F-004 | 12h | Yes |
| **Password strength validation** | F-009 | 2h | Yes |
| **Chatbot prompt injection hardening** | F-007 | 6h | Yes |
| **EuFund AI route org authorization** | F-012 | 6h | Yes |
| **Fix tenant ID from header** | F-010 | 6h | Yes |
| **Fix cross-tenant admin login** | F-011 | 3h | Yes |
| **Verify tax calculation precision** | F-008 | 4h | Yes |

**Sprint 2 Total: ~39 hours** (parallelizable to ~14h with 3 developers)

### Sprint 3 — Weeks 3-4: Medium Issues + Hardening

| Task | Finding | Effort |
|------|---------|--------|
| **CSRF cookie httpOnly** | F-014 | 0.5h |
| **Hash verification tokens** (PrimatIA) | F-015 | 2h |
| **Hash reset tokens** (EuFund) | F-016 | 2h |
| **JWT secret fallback removal** | F-017 | 2h |
| **ILIKE wildcard escaping** | F-018 | 0.5h |
| **Redis rate limiter** (chatbot) | F-019 | 3h |
| **File upload validation** | F-020 | 2h |
| **Portal pre-scope queries** | F-021 | 2h |
| **Payment state machine** | F-022 | 3h |
| **EuFund prompt injection hardening** | F-005 | 16h |
| **RAG system poisoning mitigation** | F-013 | 12h |

**Sprint 3 Total: ~45 hours**

### Backlog: Low-Severity + Improvements

| Task | Finding | Effort |
|------|---------|--------|
| Dev Docker bind to localhost | F-023 | 0.5h |
| Remove trustHost:true | F-024 | 0.5h |
| Generic error messages | F-025 | 1h |
| AI audit trail logging | F-026 | 4h |
| Proper HTML sanitization | F-027 | 1h |
| Automated dependency scanning in CI/CD | — | 4h |
| Runtime security monitoring | — | 8h |
| Network segmentation (app ↔ DB) | — | 8h |

---

## 5. Architecture Recommendations

### Structural Changes

1. **Database-Level RLS for Both Projects**
   - PrimatIA: Add RLS policies to complement existing app-layer isolation
   - EuFund: Either properly activate existing policies or implement new ones with Drizzle transaction wrapper
   - This is the single most impactful architectural change for data safety

2. **Centralized Auth Middleware Pattern**
   - Both projects should establish tenant/org context BEFORE any DB query
   - Create a wrapper that makes it impossible to query without context
   - Pattern: `withAuth(handler)` that sets context and passes scoped DB client

3. **AI Security Layer (EuFund)**
   - Dedicated AI gateway that sanitizes inputs, validates outputs, enforces org isolation
   - All AI routes go through this gateway — no direct model access from API routes
   - Audit logging built into the gateway

4. **Payment Processing Hardening (PrimatIA)**
   - Idempotency keys with DB unique constraints
   - State machine with DB-enforced valid transitions
   - Reconciliation job that detects inconsistencies

### Upgrade Paths

| Component | Current | Target | Priority |
|-----------|---------|--------|----------|
| Next.js | 14.2.35 | 14.2.39+ (immediate), 15.x (Q2 2026) | **P0** |
| React | 18.3.1 | 18.3.5+ (immediate) | **P0** |
| Node.js | 20-alpine | 22-alpine (LTS) | P2 |
| Prisma | Current | Latest + configure connection pooling | P2 |
| Docker base images | alpine | Pin with SHA digests | P3 |

### Infrastructure Improvements

1. **CI/CD Pipeline:**
   - Add `npm audit --audit-level=critical` as blocking step
   - Add container image scanning (Trivy/Grype)
   - Add bundle size budgets
   - Automated RLS integration tests

2. **Monitoring:**
   - Application Performance Monitoring (OpenTelemetry)
   - Security event logging (failed auth, cross-tenant attempts, AI injection attempts)
   - Financial reconciliation alerts (payment sum mismatches)

3. **Docker Hardening:**
   - Read-only root filesystem
   - Resource limits (CPU/memory) on all containers
   - Non-root user verification
   - Seccomp profiles

---

## 6. Disagreements & Open Questions

### Auditor Disagreements

1. **Tax calculation precision (F-008):** Only Gemini AI/BL flagged floating-point issues as HIGH. Other auditors didn't examine the tax engine in detail. **Action:** Needs manual verification with test cases — could be theoretical if `roundToLei()` already handles precision adequately.

2. **Novel attack chains:** Gemini AI/BL described 3 multi-stage attack chains (AI-assisted tax evasion, document-to-payment fraud, cross-platform data exfiltration). These are theoretically sound but require multiple vulnerabilities to be exploited in sequence. **Action:** Treat individual component vulnerabilities as the priority; the chains are useful for threat modeling but not actionable as discrete fixes.

3. **PrimatIA RLS severity:** Opus Tenant rated "no DB-level RLS" as P0-Critical. Codex Security noted the app-layer isolation is "well-implemented" and "sophisticated." **Resolution:** The app-layer pattern IS solid, but defense-in-depth demands DB-level RLS. Rate as CRITICAL for the gap but acknowledge the existing mitigation.

### Findings Needing Manual Verification

| Finding | Why Verification Needed |
|---------|------------------------|
| F-008: Tax floating-point | Run actual tax calculations with edge-case values to measure drift |
| F-002: EuFund RLS state | Run `SELECT relrowsecurity FROM pg_class` on production to confirm actual state |
| F-012: AI route org auth | Manually audit each of the ~20 `/api/ai/*` routes |
| F-013: RAG poisoning | Test whether document content actually reaches AI context |
| EuFund DB user role | Check if app connects as superuser (bypassing RLS entirely) |

### Areas Not Covered by Any Auditor

1. **Backup and disaster recovery** — No audit examined backup security, encryption, or restoration procedures
2. **GDPR data subject rights** — No audit tested right-to-erasure, data export, or consent management implementation
3. **Accessibility (WCAG 2.2)** — Mentioned in planning but not audited
4. **Load testing / DoS resilience** — No performance testing under load was performed
5. **GCP IAM and cloud security** — Service account permissions, Cloud Build pipeline security not reviewed
6. **Third-party integration security** — Stripe, AI provider API key rotation, webhook signature verification depth
7. **Logging and incident response** — No audit evaluated whether existing logging is sufficient for forensics

---

*This document supersedes all individual audit reports as the authoritative source of findings and remediation priorities. Individual reports remain valuable for detailed technical context.*

**Next review:** After Sprint 1 completion (target: Week 2)
