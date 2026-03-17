## Summary
- What changed:
- Why:

## Validation
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes (or documented exception)

## Migration Checklist (if `prisma/` changed)
- [ ] `npm run db:preflight:strict` passes
- [ ] `npx prisma migrate diff` shows expected changes only
- [ ] Migration is backward-compatible or rollback steps are documented

## AI / External Service Checklist (if relevant)
- [ ] AI/payment/storage env assumptions documented
- [ ] Failure path tested or described
- [ ] No new production fallback silently downgrades to unsafe defaults

## Risk & Rollback
- Risk level: `low` / `medium` / `high`
- Rollback plan:
- Estimated blast radius:

## Release Evidence (Required for RC/Prod-impacting PRs)
- [ ] Staging gate workflow run completed (`.github/workflows/staging-release-gate.yml`)
- [ ] Link to workflow run added in PR description
- [ ] Link to `release-evidence-<run_number>` artifact added in PR description
- [ ] `docs/releases/<timestamp>-<RC_ID>.md` filled from template (or attached artifact reviewed)
- [ ] If import/rollback touched: tenant ID + batch IDs recorded
- [ ] Approver explicitly confirms evidence reviewed before merge

## Migration Checklist (if PR touches `prisma/`)
- [ ] Migration tested locally with `npx prisma migrate deploy`
- [ ] Migration is backward-compatible (old code works with new schema)
- [ ] Rollback plan documented (can old revision run on new schema?)
- [ ] No destructive operations without data backup confirmation
- [ ] If adding a baseline migration: `prisma migrate resolve --applied <name>` run on all existing databases before deploy (see `docs/DB_RELEASE_RUNBOOK.md`)

## AI Gateway Checklist (if PR touches `src/lib/ai/`)
- [ ] Fallback chain still works (gateway > claude > openai > lm_studio > none)
- [ ] `npm test -- src/__tests__/ai/gateway-compat.test.ts` passes
- [ ] No hardcoded API keys or model names

## Notes for Reviewers
- Areas to focus on:
- Known limitations:
