# DB Release Runbook

## Purpose
Safe, repeatable migration rollout with preflight checks and rollback readiness.

## Required Environment
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `SHADOW_DATABASE_URL` (required for strict drift checks)

## Preflight
```bash
npm run db:preflight:strict
```

## Deploy Migrations
```bash
npx prisma migrate deploy
```

## Post-Deploy Validation
```bash
npx prisma migrate status
npm run type-check
npm test
```

## Staging Import/Rollback Rehearsal
Use this flow before production cutover when import/rollback behavior changes:

1. Print checklist:
```bash
npm run ops:import-rehearsal -- --mode checklist --tenant-id <tenantId>
```
2. Run import from Admin UI (preview + confirm), copy resulting `batchId`.
3. Verify imported batch invariants:
```bash
npm run ops:import-rehearsal -- --mode verify-import --tenant-id <tenantId> --batch-id <batchId>
```
4. Execute rollback from batch detail page.
5. Verify rollback invariants:
```bash
npm run ops:import-rehearsal -- --mode verify-rollback --tenant-id <tenantId> --batch-id <batchId>
```

## CI Gate (Optional but Recommended)
Manual workflow: `.github/workflows/staging-release-gate.yml`

- Runs strict preflight + type-check + tests.
- Optionally verifies import/rollback invariants when `tenant_id` and batch IDs are provided.
- Auto-generates a release evidence draft and uploads it as workflow artifact (`release-evidence-<run_number>`).
- Required GitHub secrets:
- `STAGING_DATABASE_URL`
- `STAGING_DIRECT_DATABASE_URL`
- `STAGING_SHADOW_DATABASE_URL`
- `STAGING_NEXTAUTH_SECRET`
- `STAGING_JWT_SECRET`
- `STAGING_CNP_ENCRYPTION_KEY`
- `STAGING_CNP_TENANT_SALT_SECRET`

PR enforcement:
- `.github/pull_request_template.md` includes mandatory release-evidence checklist for RC/production-impacting changes.
- `.github/CODEOWNERS` requires platform-owner review for release-governance assets.
- Branch protection baseline is defined in `docs/BRANCH_PROTECTION.md`.

## Release Evidence
Record every RC gate outcome in:

- `docs/RELEASE_EVIDENCE.md`
- release notes entry that includes:
- GitHub Actions run link
- `release-evidence-<run_number>` artifact link

Create a new RC evidence file from template:

```bash
npm run ops:release-evidence:new -- --rc RC-YYYY-MM-DD-01 --env staging
```

## Rollback Strategy
1. Stop writes to app.
2. Restore latest tested DB backup.
3. Redeploy previous app version.
4. Run health checks (`/api/health`) and smoke tests.

## Notes
- Do not run `prisma migrate dev` in production.
- Keep migration files immutable after merge.
