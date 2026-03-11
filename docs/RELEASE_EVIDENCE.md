# Release Evidence Template

Date:
Release Candidate:
Environment:
Prepared by:
Approved by:

## 1. Scope
- Branch / commit:
- Change summary:
- Risk level:

## 2. Automated Gates

### 2.1 Staging Gate Run
Command:
```bash
npm run ops:staging-gate
```
Result:
- [ ] Pass
- [ ] Fail

Logs / link:

### 2.2 Post-Deploy Smoke
Command:
```bash
APP_BASE_URL=https://primaria-staging.exemplu.ro npm run ops:post-deploy-smoke
```
Result:
- [ ] Pass
- [ ] Fail

Endpoints checked:
- [ ] `/api/health`
- [ ] `/api/health/deep`
- [ ] `/ro/login`
- [ ] `/ro/portal/login`
- [ ] `/ro/portal/register`

### 2.3 Type-check / Tests / Lint
Commands:
```bash
npm run type-check
npm test
npm run lint
```
Result:
- [ ] Pass
- [ ] Fail

Notes:

## 3. DB Migration Evidence

### 3.1 Preflight Strict
Command:
```bash
npm run db:preflight:strict
```
Result:
- [ ] Pass
- [ ] Fail

### 3.2 Migration Deploy
Command:
```bash
npx prisma migrate deploy
```
Result:
- [ ] Pass
- [ ] Fail

Applied migrations:

## 4. Import/Rollback Rehearsal Evidence (Staging)

Tenant ID:
Import batch ID:
Rollback batch ID:

### 4.1 Import Verification
Command:
```bash
npm run ops:import-rehearsal -- --mode verify-import --tenant-id <tenantId> --batch-id <batchId>
```
Result:
- [ ] Pass
- [ ] Fail

Output snapshot:

### 4.2 Rollback Verification
Command:
```bash
npm run ops:import-rehearsal -- --mode verify-rollback --tenant-id <tenantId> --batch-id <batchId>
```
Result:
- [ ] Pass
- [ ] Fail

Output snapshot:

## 5. Operational Checks
- [ ] Backup/restore drill validated for this RC window
- [ ] Incident response runbook reviewed
- [ ] Monitoring/alerts healthy after deploy
- [ ] Post-deploy smoke evidence captured for the deployed URL

## 6. Final Decision
- [ ] Approved for production
- [ ] Blocked

Blocking issues / follow-ups:

## 7. Release Notes Checklist (Required Before Production Approval)
- [ ] Release notes drafted for this RC
- [ ] Link to GitHub Actions run included
- [ ] Link to uploaded `release-evidence-<run_number>` artifact included
- [ ] Import/rollback batch IDs recorded in release notes
- [ ] Approver explicitly signs off after reviewing artifact evidence
