# 30-Day Operational Hardening Plan — PrimărIA

> **Date**: 2026-03-03
> **Scope**: Release safety, CI reliability, AI-Gateway compatibility, migration safety, observability, incident response
> **Constraint**: PR-only changes. No destructive commands. Deployable on GCP Cloud Run.

---

## Executive Summary

| Area | Current State | Target State (Day 30) |
|------|--------------|----------------------|
| **CI** | Broken (DB name mismatch), no DIRECT_DATABASE_URL in CI, lint not blocking | Green CI on every PR, deterministic gate, migration preflight in CI |
| **Observability** | `console.error()` only, /api/health checks DB only | Structured logging, health checks DB+Redis+AI, SLO dashboard |
| **AI Gateway** | Config works but no compatibility test, no health check | CI smoke test against gateway contract, health route checks AI |
| **Migration Safety** | Preflight script exists but not in CI pipeline | Preflight runs on every PR with schema changes |
| **Incident Response** | Comprehensive doc exists, but no runbook for common ops failures | Ops runbook with top-5 failure playbooks |
| **Rollout/Rollback** | Manual deploy.sh, no canary | Traffic-split rollout via Cloud Run revisions, 1-command rollback |

---

## BLOCKERS (Check GitHub — Action Required)

| # | Blocker | Impact | Resolution |
|---|---------|--------|------------|
| B-1 | **CI is broken on `security/remediation-sprint-1-3` branch** — PostgreSQL service DB is `primaria_test` but health check uses `-U test` which tries to connect to DB `test` (default). The `DIRECT_DATABASE_URL` and `NEXTAUTH_SECRET` are not set in CI env, so `prisma migrate deploy` and build fail. | PR #3 (26 security fixes) cannot merge | Fix `ci.yml`: add `DIRECT_DATABASE_URL`, add required dummy env vars for build |
| B-2 | **`master` vs `main` branch confusion** — CI triggers on `master`, but main branch is `main`. Local `master` is 1 commit ahead of `main`. | PRs to `main` don't trigger CI | Align CI triggers to `main`, or set default branch to `master` |
| B-3 | **PR #3 has 5 root-level audit markdown files** (`CODEX_*.md`, `MASTER_REMEDIATION_PLAN.md`) committed to repo root | Clutters repo, not in `/docs` | Move to `docs/audits/` or `.github/` before merge |

---

## Top 5 Failure Modes & Mitigations

| # | Failure Mode | Likelihood | Impact | Mitigation |
|---|-------------|-----------|--------|------------|
| **F-1** | **Broken CI blocks all merges** — DB name mismatch, missing env vars. Currently happening. | **Active** | P1 — no code can ship | Fix ci.yml (PR #1 below) |
| **F-2** | **Migration runs without preflight** — `prisma migrate deploy` in CI runs after build, but no `db:preflight:strict` in the CI pipeline. Drift could ship. | High | P1 — schema/data corruption | Add preflight step before migrate in CI |
| **F-3** | **AI Gateway goes down, no fallback telemetry** — Gateway is first in fallback chain but no health signal. App silently degrades to keyword search with no alert. | Medium | P2 — degraded citizen experience, no one notices | Add AI provider to health check; add fallback-triggered metric |
| **F-4** | **In-memory rate limiter resets on deploy** — Cloud Run spins new instances; rate limit state is lost. Burst abuse possible during rolling deploys. | Medium | P2 — auth endpoint abuse during deploy window | Migrate rate limiter to Redis (already in PR #3 for chatbot; extend to auth) |
| **F-5** | **No structured logs → blind in production** — All error handling is `console.error()`. Cloud Logging captures it but no structured fields for filtering, no request IDs, no tenant context in logs. | High | P2 — MTTR increases 3-5x during incidents | Add pino + request-id middleware |

---

## 30-Day Execution Plan

### Week 1: Unblock CI & Release Safety (Days 1-7)

**Priority**: Get CI green so PR #3 (security fixes) can merge.

| Day | Task | Files | Depends On |
|-----|------|-------|------------|
| 1-2 | **PR #1: Fix CI workflow** — add `DIRECT_DATABASE_URL`, `NEXTAUTH_SECRET`, `JWT_SECRET`, `CNP_ENCRYPTION_KEY`, `CNP_TENANT_SALT_SECRET` as dummy env vars for build; fix health check user; add `db:preflight` step | `.github/workflows/ci.yml` | None |
| 2-3 | **PR #2: Migration guard in CI** — run `npx prisma validate` + `npx prisma migrate diff` on PRs that touch `prisma/` | `.github/workflows/ci.yml` | PR #1 |
| 3-4 | **PR #3: Unblock security PR** — rebase `security/remediation-sprint-1-3` onto fixed CI, resolve conflicts if any | Branch: `security/remediation-sprint-1-3` | PR #1 merged |
| 5-7 | **PR #4: Improved PR template** — add migration checklist, AI-Gateway checklist, observability checklist | `.github/pull_request_template.md` | None |

### Week 2: Observability Foundation (Days 8-14)

| Day | Task | Files | Depends On |
|-----|------|-------|------------|
| 8-9 | **PR #5: Structured logging** — add `pino` logger, request-id middleware, replace top-20 `console.error` calls in API routes | `src/lib/logger.ts`, `src/middleware.ts`, API routes | None |
| 10-11 | **PR #6: Enhanced health check** — check DB + Redis + AI Gateway availability; add `/api/health/deep` for full check, keep `/api/health` lightweight for probes | `src/app/api/health/route.ts`, new `src/app/api/health/deep/route.ts` | None |
| 12-13 | **PR #7: AI Gateway compatibility test** — CI step that validates gateway config contract (env vars present, endpoint schema matches expected OpenAI-compatible format) | `src/__tests__/ai/gateway-compat.test.ts`, `.github/workflows/ci.yml` | PR #1 |
| 14 | **PR #8: SLO definition doc** — define availability, latency, error rate targets | `docs/SLO.md` | None |

### Week 3: Safe Rollout & Rollback (Days 15-21)

| Day | Task | Files | Depends On |
|-----|------|-------|------------|
| 15-16 | **PR #9: Cloud Run traffic-split deploy script** — deploy new revision with 10% traffic, promote to 100% after health check passes | `deploy/deploy-canary.sh` | None |
| 17-18 | **PR #10: Rollback script** — 1-command rollback to previous Cloud Run revision | `deploy/rollback.sh` | PR #9 |
| 19-20 | **PR #11: Release gate checklist (machine-readable)** — YAML checklist consumed by staging-release-gate workflow | `docs/RELEASE_GATE_CHECKLIST.yml`, `.github/workflows/staging-release-gate.yml` | PR #1 |
| 21 | **PR #12: Ops runbook — top 5 failure playbooks** — concrete steps for each failure mode above | `docs/OPS_RUNBOOK.md` | None |

### Week 4: Polish & Drill (Days 22-30)

| Day | Task | Files | Depends On |
|-----|------|-------|------------|
| 22-23 | **PR #13: GCP Cloud Monitoring dashboard (Terraform or gcloud)** — request count, error rate, p50/p95 latency, DB connection pool, Redis hit rate | `deploy/monitoring/dashboard.json` | PR #8 (SLO targets) |
| 24-25 | **PR #14: Alert policies** — PagerDuty/email alerts for SLO breaches | `deploy/monitoring/alerts.json` | PR #13 |
| 26-27 | **PR #15: Incident runbook skeleton update** — add "Service degraded" and "Migration failed" playbooks to existing `INCIDENT_RESPONSE.md` | `docs/INCIDENT_RESPONSE.md` | PR #12 |
| 28-30 | **Drill**: Execute canary deploy → observe dashboard → trigger rollback → verify recovery. Document results. | `docs/releases/drill-<date>.md` | All above |

---

## Required CI Improvements (Detail)

### 1. Deterministic Release Gate Checks

```yaml
# .github/workflows/ci.yml — target state
jobs:
  ci:
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: primaria_test
          POSTGRES_PASSWORD: primaria_test
          POSTGRES_DB: primaria_test
        options: >-
          --health-cmd="pg_isready -U primaria_test -d primaria_test"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

    env:
      DATABASE_URL: postgresql://primaria_test:primaria_test@localhost:5432/primaria_test
      DIRECT_DATABASE_URL: postgresql://primaria_test:primaria_test@localhost:5432/primaria_test
      NEXTAUTH_SECRET: ci-test-secret-not-real
      NEXTAUTH_URL: http://localhost:3000
      JWT_SECRET: ci-test-jwt-secret-not-real
      CNP_ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
      CNP_TENANT_SALT_SECRET: ci-test-salt-not-real
      AUTH_SECRET: ci-test-secret-not-real

    steps:
      # ... checkout, setup-node, npm ci, prisma generate ...

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Build
        run: npm run build
        env:
          NEXTAUTH_URL: http://localhost:3000

      - name: DB Preflight
        run: npx prisma validate

      - name: Run database migrations
        run: npx prisma migrate deploy

      - name: Run tests
        run: npm test
```

### 2. Migration Guard (PR-level)

Add a conditional step that detects schema changes and runs drift detection:

```yaml
      - name: Check for schema changes
        id: schema-check
        run: |
          if git diff --name-only origin/main...HEAD | grep -q "^prisma/"; then
            echo "schema_changed=true" >> $GITHUB_OUTPUT
          else
            echo "schema_changed=false" >> $GITHUB_OUTPUT
          fi

      - name: Migration drift check
        if: steps.schema-check.outputs.schema_changed == 'true'
        run: npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --exit-code
```

### 3. AI Gateway Compatibility Verification

New test file `src/__tests__/ai/gateway-compat.test.ts`:

```typescript
// Validates that getLLMConfig() returns a valid config for each provider
// Validates gateway endpoint format matches OpenAI-compatible /v1/chat/completions
// Validates fallback chain: gateway → claude → openai → lm_studio → none
// Validates no provider returns undefined apiKey when URL is set
```

---

## Required Repository Docs & Templates

### File: `.github/pull_request_template.md` (Enhanced)

```markdown
## Summary
- What changed:
- Why:

## Validation
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes (or documented exception)

## Migration Checklist (if `prisma/` changed)
- [ ] `npx prisma validate` passes
- [ ] Migration is backward-compatible (no column drops without deprecation)
- [ ] `npx prisma migrate diff` shows expected changes only
- [ ] Rollback SQL documented (for destructive migrations)

## AI Gateway Checklist (if `src/lib/ai/` changed)
- [ ] Fallback chain preserved (gateway → claude → openai → lm_studio → none)
- [ ] No hardcoded API keys or URLs
- [ ] Streaming + non-streaming paths tested
- [ ] Prompt injection defenses maintained

## Risk & Rollback
- Risk level: `low` / `medium` / `high`
- Rollback plan:
- Estimated blast radius (users/tenants affected):

## Release Evidence (Required for RC/Prod PRs)
- [ ] Staging gate workflow run completed
- [ ] Link to workflow run:
- [ ] Link to artifact:
- [ ] `docs/releases/<timestamp>-<RC_ID>.md` filled
- [ ] Approver sign-off:

## Notes for Reviewers
- Areas to focus on:
- Known limitations:
```

### File: `docs/RELEASE_GATE_CHECKLIST.yml`

```yaml
release_gate:
  version: "1.0"

  automated_checks:
    - name: type-check
      command: "npm run type-check"
      required: true
      blocker: true

    - name: unit-tests
      command: "npm test"
      required: true
      blocker: true

    - name: lint
      command: "npm run lint"
      required: true
      blocker: false  # warn only until baseline clean

    - name: build
      command: "npm run build"
      required: true
      blocker: true

    - name: prisma-validate
      command: "npx prisma validate"
      required: true
      blocker: true

    - name: migration-deploy
      command: "npx prisma migrate deploy"
      required: true
      blocker: true
      requires: [prisma-validate]

  conditional_checks:
    - name: migration-drift
      command: "npm run db:preflight:strict"
      trigger: "prisma/ files changed"
      required: true
      blocker: true

    - name: import-verification
      command: "npm run ops:import-rehearsal -- --mode verify-import"
      trigger: "manual (import batch present)"
      required: false

    - name: rollback-verification
      command: "npm run ops:import-rehearsal -- --mode verify-rollback"
      trigger: "manual (rollback batch present)"
      required: false

  manual_checks:
    - name: health-endpoint
      description: "GET /api/health returns 200"
      required: true

    - name: smoke-test
      description: "Login as staff + citizen, verify dashboard loads"
      required: true
      for: [rc, production]

    - name: rollback-tested
      description: "Previous revision accessible via Cloud Run traffic split"
      required: true
      for: [production]
```

### File: `docs/OPS_RUNBOOK.md` (Skeleton)

```markdown
# Operational Runbook — PrimărIA

## Playbook 1: CI Pipeline Failure
**Symptoms**: PR checks fail, merges blocked
**Steps**:
1. Check GitHub Actions run log for the failing step
2. Common causes:
   - PostgreSQL service container failed to start → check `options` health check
   - Missing env vars → compare ci.yml env block against .env.example
   - Prisma migration drift → run `npx prisma migrate diff` locally
3. Fix in a branch, push, verify CI goes green

## Playbook 2: Database Migration Failure (Production)
**Symptoms**: Deploy fails at migration step, app returns 503
**Steps**:
1. DO NOT retry blindly — check `npx prisma migrate status` first
2. If migration partially applied: check for DDL transaction support
3. Connect directly (not PgBouncer): use DIRECT_DATABASE_URL
4. If rollback needed: apply reverse SQL (must be pre-written)
5. Verify: `npx prisma migrate status` shows clean state

## Playbook 3: AI Gateway Unreachable
**Symptoms**: Chatbot returns generic fallback, no AI-powered features
**Steps**:
1. Check `/api/health/deep` — look for `ai: { status: "error" }`
2. Verify gateway URL: `curl -s $AI_GATEWAY_URL/health`
3. Check GCP service status for AI Gateway Cloud Run service
4. If gateway is down: app auto-falls back to keyword search (degraded but functional)
5. No user action needed unless gateway outage > 1 hour

## Playbook 4: Rate Limiter Reset During Deploy
**Symptoms**: Spike in auth attempts during rolling deploy
**Steps**:
1. In-memory rate limiter resets when Cloud Run spins new instances
2. Monitor `/api/portal/auth/login` request volume in Cloud Logging
3. If abuse detected: temporarily reduce max-instances to 1 to consolidate state
4. Long-term fix: migrate rate limiter to Redis (see PR backlog)

## Playbook 5: Tenant Data Leak Suspected
**Symptoms**: User reports seeing another tenant's data
**Steps**:
1. IMMEDIATELY: Activate incident response (docs/INCIDENT_RESPONSE.md, P1)
2. Check audit log: `SELECT * FROM "AuditLog" WHERE ... ORDER BY "createdAt" DESC`
3. Verify RLS: `SHOW app.current_tenant_id` in suspected query context
4. Check PgBouncer mode: must be `transaction` (not `session` or `statement`)
5. If confirmed: isolate tenant, rotate credentials, notify per GDPR Art. 33
```

---

## Minimal Observability Package

### Core SLOs

| SLO | Target | Measurement | Alert Threshold |
|-----|--------|-------------|-----------------|
| **Availability** | 99.5% (monthly) | `(200 responses) / (total requests)` on `/api/health` | < 99% over 5min window |
| **Latency (p95)** | < 2s for page loads | Cloud Run request latency metric | p95 > 3s for 5min |
| **Latency (p95)** | < 500ms for API calls | Cloud Run request latency (filtered to `/api/*`) | p95 > 1s for 5min |
| **Error Rate** | < 1% of requests return 5xx | Cloud Run `response_code_class=5xx` / total | > 2% for 5min |
| **AI Availability** | 95% (monthly) | `/api/health/deep` AI check success rate | AI down for > 10min |
| **DB Connection Pool** | < 80% utilization | PgBouncer `cl_active / max_client_conn` | > 90% for 2min |

### Dashboard Requirements

**GCP Cloud Monitoring Dashboard** (`deploy/monitoring/dashboard.json`):

| Panel | Metric | Visualization |
|-------|--------|---------------|
| Request Rate | `run.googleapis.com/request_count` | Time series, by response code |
| Error Rate | 5xx / total | Percentage line, with 1% threshold |
| Latency p50/p95/p99 | `run.googleapis.com/request_latencies` | Heatmap + percentile lines |
| Instance Count | `run.googleapis.com/container/instance_count` | Line (correlate with load) |
| DB Health | Custom metric from `/api/health` | Status indicator (green/red) |
| AI Gateway Health | Custom metric from `/api/health/deep` | Status indicator |
| Memory Usage | `run.googleapis.com/container/memory/utilizations` | Line with 80% threshold |
| CPU Usage | `run.googleapis.com/container/cpu/utilizations` | Line with 80% threshold |

### Alert Thresholds

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| **Service Down** | 0 healthy instances for 2min | P1 Critical | PagerDuty + Email |
| **High Error Rate** | 5xx > 5% for 5min | P1 Critical | PagerDuty + Email |
| **Elevated Error Rate** | 5xx > 2% for 10min | P2 Warning | Email |
| **High Latency** | p95 > 3s for 10min | P2 Warning | Email |
| **DB Unreachable** | `/api/health` returns 503 for 1min | P1 Critical | PagerDuty |
| **AI Gateway Down** | `/api/health/deep` AI check fails for 10min | P3 Info | Email |
| **Memory Pressure** | Container memory > 85% for 5min | P2 Warning | Email |
| **Connection Pool Exhaustion** | PgBouncer active > 90% for 2min | P1 Critical | PagerDuty |

---

## Safe Rollout Pattern

### Deploy (Canary → Promote)

```bash
# deploy/deploy-canary.sh

# 1. Build & push image (same as current deploy.sh)
docker build -t $IMAGE:$SHA .
docker push $IMAGE:$SHA

# 2. Deploy new revision with 0% traffic (no-traffic flag)
gcloud run deploy primaria \
  --image=$IMAGE:$SHA \
  --region=europe-central2 \
  --no-traffic \
  --tag=canary

# 3. Run migrations against production DB (from new revision)
gcloud run jobs execute primaria-migrate --wait

# 4. Smoke test canary URL
CANARY_URL=$(gcloud run services describe primaria --format='value(status.traffic[1].url)')
curl -sf "$CANARY_URL/api/health" || { echo "CANARY HEALTH FAILED"; exit 1; }

# 5. Shift 10% traffic to canary
gcloud run services update-traffic primaria \
  --to-tags=canary=10

# 6. Wait + observe (manual or automated)
echo "Observe dashboard for 10min. Then promote:"
echo "  gcloud run services update-traffic primaria --to-latest"
```

### Rollback (1-command)

```bash
# deploy/rollback.sh

# Get previous revision
PREV=$(gcloud run revisions list --service=primaria \
  --region=europe-central2 \
  --sort-by=~creationTimestamp \
  --limit=2 --format='value(name)' | tail -1)

# Route 100% traffic to previous revision
gcloud run services update-traffic primaria \
  --region=europe-central2 \
  --to-revisions=$PREV=100

echo "Rolled back to $PREV"
echo "IMPORTANT: If migration was applied, manual DB rollback may be needed"
echo "See docs/OPS_RUNBOOK.md Playbook 2"
```

---

## Exact File/Path Checklist

### Files to CREATE

| Path | PR | Purpose |
|------|-----|---------|
| `src/lib/logger.ts` | #5 | Pino structured logger with request-id |
| `src/app/api/health/deep/route.ts` | #6 | Deep health check (DB + Redis + AI) |
| `src/__tests__/ai/gateway-compat.test.ts` | #7 | AI Gateway contract test |
| `docs/SLO.md` | #8 | SLO definitions |
| `deploy/deploy-canary.sh` | #9 | Canary deployment script |
| `deploy/rollback.sh` | #10 | 1-command rollback |
| `docs/RELEASE_GATE_CHECKLIST.yml` | #11 | Machine-readable gate checklist |
| `docs/OPS_RUNBOOK.md` | #12 | Top-5 failure playbooks |
| `deploy/monitoring/dashboard.json` | #13 | GCP Cloud Monitoring dashboard |
| `deploy/monitoring/alerts.json` | #14 | GCP alert policies |

### Files to MODIFY

| Path | PR | Change |
|------|-----|--------|
| `.github/workflows/ci.yml` | #1, #2 | Fix DB config, add env vars, add preflight step, add migration guard |
| `.github/pull_request_template.md` | #4 | Add migration + AI Gateway + observability checklists |
| `src/middleware.ts` | #5 | Add request-id generation + logging hooks |
| `src/app/api/health/route.ts` | #6 | Keep lightweight but add version/revision info |
| `docs/INCIDENT_RESPONSE.md` | #15 | Add service-degraded + migration-failed playbooks |

### Files to MOVE (in PR #3 cleanup)

| From | To |
|------|-----|
| `CODEX_FINAL_AUDIT.md` | `docs/audits/CODEX_FINAL_AUDIT.md` |
| `CODEX_SPRINT1_AUDIT.md` | `docs/audits/CODEX_SPRINT1_AUDIT.md` |
| `CODEX_SPRINT2_AUDIT.md` | `docs/audits/CODEX_SPRINT2_AUDIT.md` |
| `CODEX_SPRINT3_AUDIT.md` | `docs/audits/CODEX_SPRINT3_AUDIT.md` |
| `MASTER_REMEDIATION_PLAN.md` | `docs/audits/MASTER_REMEDIATION_PLAN.md` |

---

## FIRST_3_PRS

### PR #1: `fix(ci): unbreak CI pipeline — DB config, env vars, preflight`

**Scope**: `.github/workflows/ci.yml` only (1 file)
**Size**: ~30 lines changed
**Impact**: Unblocks ALL merges including PR #3 (26 security fixes)

Changes:
- Fix PostgreSQL service: `POSTGRES_USER: primaria_test`, health check `-U primaria_test -d primaria_test`
- Add `DIRECT_DATABASE_URL` env var (same as `DATABASE_URL` in CI — no PgBouncer in CI)
- Add dummy build-time env vars: `NEXTAUTH_SECRET`, `JWT_SECRET`, `CNP_ENCRYPTION_KEY`, `CNP_TENANT_SALT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_URL`
- Add `npx prisma validate` step before `prisma migrate deploy`
- Fix branch trigger: `main` instead of (or in addition to) `master`

---

### PR #2: `feat(ci): migration guard — detect drift on PRs touching prisma/`

**Scope**: `.github/workflows/ci.yml` (1 file, ~15 lines added)
**Size**: ~15 lines
**Impact**: Prevents shipping schema drift; catches migration conflicts before merge

Changes:
- Add conditional step: if `prisma/` files changed in PR, run `npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --exit-code`
- Fails CI if schema and migrations are out of sync

---

### PR #3: `docs: enhanced PR template with migration & AI checklists`

**Scope**: `.github/pull_request_template.md` (1 file)
**Size**: ~25 lines added
**Impact**: Every future PR gets structured review prompts for migrations, AI, and risk

Changes:
- Add "Migration Checklist" section (conditional)
- Add "AI Gateway Checklist" section (conditional)
- Add "Estimated blast radius" to risk section
- Keep existing release evidence section unchanged

---

## Dependency Graph

```
PR #1 (Fix CI) ─────┬──→ PR #2 (Migration guard)
                     ├──→ PR #7 (AI Gateway test)
                     └──→ Unblock PR #3 (Security, already open)

PR #4 (PR template) ──→ (independent, can land anytime)

PR #5 (Logging) ──→ PR #6 (Health check) ──→ PR #8 (SLO doc)

PR #9 (Canary deploy) ──→ PR #10 (Rollback)

PR #11 (Gate checklist) ──→ (independent)
PR #12 (Ops runbook) ──→ PR #15 (Incident response update)

PR #13 (Dashboard) ──→ PR #14 (Alerts)
```

---

## Success Criteria (Day 30)

- [ ] CI is green on `main` with every PR
- [ ] PR #3 (security fixes) is merged
- [ ] Every PR that touches `prisma/` gets automatic drift detection
- [ ] `/api/health/deep` checks DB + Redis + AI Gateway
- [ ] Structured logs with request-id in Cloud Logging
- [ ] SLO document reviewed and accepted
- [ ] Canary deploy tested at least once
- [ ] Rollback tested at least once
- [ ] Ops runbook covers top-5 failure modes
- [ ] Dashboard with core panels deployed to GCP Cloud Monitoring
- [ ] At least 1 alert policy active (Service Down)
