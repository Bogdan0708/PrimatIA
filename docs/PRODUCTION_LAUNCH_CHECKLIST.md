# Production Launch Checklist

Consolidated checklist for production deployment of PrimarIA. Each item references the relevant artifact.

## Pre-Launch

### Code Quality
- [ ] CI pipeline is green on main ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml))
- [ ] Security PR merged and passing ([PR #6](https://github.com/Bogdan0708/PrimatIA/pull/6))
- [ ] `npm run type-check` — 0 errors
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — clean production build
- [ ] `npx prisma validate` — schema is valid

### Security
- [ ] All OWASP Top 10 mitigations in place (CSP, HSTS, XSS, CSRF)
- [ ] Rate limiting active on sensitive endpoints ([`src/middleware.ts`](../src/middleware.ts))
- [ ] CNP encryption with AES-256-GCM ([`src/lib/crypto.ts`](../src/lib/crypto.ts))
- [ ] TOTP 2FA available for staff accounts
- [ ] Stripe webhook signature verification active
- [ ] Payment amount validation (Stripe vs DB) in webhook handler
- [ ] Prompt injection detection on chatbot route

### Infrastructure
- [ ] Cloud Run service configured (1Gi memory, 1 CPU, 0-10 instances)
- [ ] Cloud SQL PostgreSQL accessible from Cloud Run
- [ ] Cloud Run revision wired to the intended Cloud SQL instance and VPC connector
- [ ] All secrets configured in Secret Manager:
  - `DATABASE_URL`, `DIRECT_DATABASE_URL`
  - `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `AI_GATEWAY_URL`, `AI_GATEWAY_KEY`
  - `CNP_ENCRYPTION_KEY`, `CNP_TENANT_SALT_SECRET`
- [ ] `AUTH_TRUST_HOST=true` set for NextAuth behind Cloud Run proxy
- [ ] `NEXTAUTH_URL` matches the Cloud Run service URL

### Database
- [ ] Migrations applied: `npx prisma migrate deploy`
- [ ] RLS policies active: check with `SELECT * FROM pg_policies`
- [ ] Seed data loaded for demo tenant (if applicable)
- [ ] Backup schedule configured in Cloud SQL

## Health Verification

### Endpoints
- [ ] `GET /api/health` returns `{"status": "ok"}` ([`src/app/api/health/route.ts`](../src/app/api/health/route.ts))
- [ ] `GET /api/health/deep` returns `status: "ok"` with database OK, Redis OK, and AI not error ([`src/app/api/health/deep/route.ts`](../src/app/api/health/deep/route.ts))
- [ ] Canary promotion uses deep health, not liveness only ([`deploy/deploy-canary.sh`](../deploy/deploy-canary.sh))
- [ ] `npm run ops:post-deploy-smoke` succeeds against the deployed URL

### Smoke Tests
- [ ] Staff login works (NextAuth)
- [ ] Citizen portal login works (custom JWT)
- [ ] Tax assessment page loads
- [ ] Payment flow (test mode Stripe) completes
- [ ] Document generation works
- [ ] One authenticated chatbot or OCR request succeeds against the configured AI gateway
- [ ] `npm run ops:ai-smoke` succeeds with staging/prod tenant inputs

## Observability

### Logging
- [ ] Structured logging active (pino) — JSON in prod, pretty in dev ([`src/lib/logger.ts`](../src/lib/logger.ts))
- [ ] Request-ID correlation via `x-request-id` header
- [ ] PII redaction configured (cnp, password, token fields)

### Monitoring
- [ ] Cloud Monitoring dashboard imported ([`deploy/monitoring/dashboard.json`](../deploy/monitoring/dashboard.json))
- [ ] Alert policies created ([`deploy/monitoring/alerts.json`](../deploy/monitoring/alerts.json)):
  - P1: Service Down (0 instances 2min)
  - P1: High Error Rate (5xx > 5% for 5min)
  - P2: High Latency (p95 > 3s for 10min)
  - P1: DB Unreachable (health 503 for 1min)

### SLOs
- [ ] SLO targets documented ([`docs/SLO.md`](./SLO.md)):
  - Availability: 99.5%
  - API latency p95: < 500ms
  - Error rate: < 1%
  - AI availability: 95%

## Deployment

### Deploy Process
- [ ] Git SHA tagging active in deploy.sh ([`deploy/deploy.sh`](../deploy/deploy.sh))
- [ ] Canary deploy script tested ([`deploy/deploy-canary.sh`](../deploy/deploy-canary.sh))
- [ ] Rollback script tested ([`deploy/rollback.sh`](../deploy/rollback.sh))
- [ ] Release gate checklist followed ([`docs/RELEASE_GATE_CHECKLIST.yml`](./RELEASE_GATE_CHECKLIST.yml))

### Operational Readiness
- [ ] Ops runbook reviewed ([`docs/OPS_RUNBOOK.md`](./OPS_RUNBOOK.md))
- [ ] Incident response plan current ([`docs/INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md))
- [ ] PR template includes migration and AI gateway checklists
- [ ] On-call / escalation contacts documented

## Post-Launch

- [ ] Monitor error budget for first 24 hours
- [ ] Verify structured logs appear in Cloud Logging
- [ ] Confirm alerts fire on test conditions (optional)
- [ ] Schedule first SLO review (1 week post-launch)
