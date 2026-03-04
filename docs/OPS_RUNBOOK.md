# Operations Runbook — PrimarIA

## Playbook 1: CI Pipeline Failure

### Symptoms
- GitHub Actions workflow fails on PR or push to main
- `npm run build` or `npm run type-check` fails in CI

### Diagnostic Commands
```bash
# Check the failed workflow
gh run list --limit 5
gh run view <run-id> --log-failed

# Reproduce locally
npm run type-check
npm test
npm run build
```

### Remediation
1. Check if it's a missing CI env var — see `.github/workflows/ci.yml` `env:` block
2. Check for Prisma schema drift: `npx prisma validate`
3. If test-only failure: run the failing test locally with `npx vitest <file> --reporter=verbose`
4. If build failure: check for ESLint errors in the output, fix unused imports/vars

### Escalation
- If CI infra issue (GitHub runner problems): check [GitHub Status](https://www.githubstatus.com/)
- If persistent: create an issue with the full CI log attached

---

## Playbook 2: Database Migration Failure (Production)

### Symptoms
- Deploy fails at the migration step
- Application starts but throws Prisma errors about missing columns/tables
- `/api/health` returns 503

### Diagnostic Commands
```bash
# Check migration status
npx prisma migrate status

# Check what migrations are pending
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma

# Check DB connectivity
psql "$DIRECT_DATABASE_URL" -c "SELECT 1"
```

### Remediation
1. **If migration failed mid-way**: Check `_prisma_migrations` table for failed entries
2. **Mark as rolled back**: `npx prisma migrate resolve --rolled-back <migration_name>`
3. **Re-apply**: `npx prisma migrate deploy`
4. **If schema is corrupted**: Restore from latest Cloud SQL backup, then re-apply migrations

### Post-Incident
- Add the migration to the release gate checklist for pre-deploy testing
- Consider if the migration needs to be backward-compatible (for zero-downtime deploys)

### Escalation
- If Cloud SQL is unreachable: Check GCP Console > Cloud SQL > Instance status
- If backup restore needed: Follow GCP Cloud SQL point-in-time recovery docs

---

## Playbook 3: AI Gateway Unreachable

### Symptoms
- `/api/health/deep` shows AI component as "error"
- Chatbot returns fallback responses or errors
- Revenue forecasts fail to generate

### Diagnostic Commands
```bash
# Check AI gateway health
curl -s "$AI_GATEWAY_URL/health" | jq .

# Check AI config
# In the app, getLLMConfig() determines the active provider

# Check fallback chain
curl -s http://localhost:3000/api/health/deep | jq .components.ai
```

### Remediation
1. **Gateway unreachable**: Check if the gateway service is running, verify URL and API key
2. **Fallback to direct provider**: Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to bypass gateway
3. **All providers down**: The app gracefully degrades — AI features return structured error messages
4. **Rate limited**: Check provider usage dashboards, consider increasing limits

### Impact
- AI features degrade gracefully; core tax/payment functionality is unaffected
- SLO target: 95% AI availability (lower than overall 99.5%)

---

## Playbook 4: Rate Limiter Reset During Deploy

### Symptoms
- After Cloud Run deploy, rate limits reset (new instances = empty in-memory map)
- Potential burst of traffic from previously rate-limited clients

### Diagnostic Commands
```bash
# Check current instance count
gcloud run services describe primaria --region europe-central2 --format 'value(status.traffic)'

# Check request rates in logs
gcloud logging read 'resource.type="cloud_run_revision" AND severity>=WARNING' --limit 20
```

### Remediation
1. This is **expected behavior** with in-memory rate limiting
2. The rate limit window is 60 seconds, so impact is brief
3. If abuse is detected: add IP to Cloud Armor WAF deny list
4. Long-term: migrate rate limiting to Redis (tracked as future improvement)

### Prevention
- Canary deploys limit blast radius (only 10% traffic initially)
- Cloud Run min-instances=0 means cold starts are normal

---

## Playbook 5: Tenant Data Leak Suspected

### Symptoms
- User reports seeing data from another municipality
- Audit logs show cross-tenant access patterns
- RLS policy violation detected in logs

### Diagnostic Commands
```bash
# Check RLS policies are active
psql "$DIRECT_DATABASE_URL" -c "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public'"

# Check if tenant context is being set
# Search logs for missing withTenantScope or setTenantContext calls
grep -r "prisma\.\(contribuabil\|impozit\|plata\)" src/app/api/ | grep -v "withTenantScope\|setTenantContext"

# Verify specific query isolation
psql "$DIRECT_DATABASE_URL" -c "SET app.tenant_id = '<tenant_uuid>'; SELECT count(*) FROM \"Contribuabil\";"
```

### Immediate Actions
1. **Isolate**: If confirmed, disable the affected API endpoint immediately
2. **Assess scope**: Query audit logs to determine which tenants were exposed
3. **Preserve evidence**: Export relevant audit log entries and database snapshots
4. **Notify**: Follow Incident Response Plan (docs/INCIDENT_RESPONSE.md) — this is a P1/P2

### Remediation
1. Fix the missing tenant context in the affected code path
2. Add the missing `withTenantScope()` wrapper
3. Add integration test to prevent regression
4. Review all API routes for similar patterns

### Regulatory
- If personal data was exposed cross-tenant: GDPR Art. 33 notification required (72h)
- See docs/INCIDENT_RESPONSE.md Section 5, Phase 3
