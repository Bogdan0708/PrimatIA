## Summary
- What changed:
- Why:

## Validation
- [ ] `npm run type-check`
- [ ] `npm test`
- [ ] `npm run lint` (or documented exception)

## Risk & Rollback
- Risk level: `low` / `medium` / `high`
- Rollback plan:

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

## AI Gateway Checklist (if PR touches `src/lib/ai/`)
- [ ] Fallback chain still works (gateway > claude > openai > lm_studio > none)
- [ ] `npm test -- src/__tests__/ai/gateway-compat.test.ts` passes
- [ ] No hardcoded API keys or model names

## Notes for Reviewers
- Areas to focus on:
- Known limitations:

