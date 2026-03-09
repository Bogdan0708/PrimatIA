# Branch Protection Baseline

This document defines required GitHub branch protection settings for `main` (and any release branch used for production deployments).

## 1. Required Pull Request Rules
- Require a pull request before merging.
- Require approvals: minimum `1` (recommended `2` for production-impacting changes).
- Dismiss stale approvals when new commits are pushed.
- Require review from Code Owners.
- Require conversation resolution before merge.

## 2. Required Status Checks
Enable "Require status checks to pass before merging" and require:
- `CI / ci`
- `staging-gate` workflow (manual/conditional for release candidates)

If check names differ in CI, update this list to exact names shown in GitHub.

Current CI workflow file:
- `.github/workflows/ci.yml` (job: `ci`)

## 3. Merge Strategy
- Disallow force pushes.
- Disallow branch deletion.
- Restrict direct pushes to protected branches.
- Allow only squash merge or merge commit based on team standard (pick one and document here).

Current standard:
- Squash merge for feature branches.

## 4. Governance Scope
Release-governance assets are protected via CODEOWNERS:
- `.github/workflows/staging-release-gate.yml`
- `.github/pull_request_template.md`
- `.github/CODEOWNERS`
- `docs/DB_RELEASE_RUNBOOK.md`
- `docs/RELEASE_EVIDENCE.md`
- `docs/PRODUCTION_READINESS_PLAN.md`
- `scripts/staging-release-gate.sh`
- `scripts/import-rollback-rehearsal.mjs`
- `scripts/new-release-evidence.sh`

## 5. Verification Checklist
- [ ] Branch protection enabled on `main`.
- [ ] Required status checks match active CI jobs.
- [ ] CODEOWNERS review requirement enabled.
- [ ] Admin bypass policy explicitly decided and documented.
- [ ] Settings reviewed quarterly or after major team/process changes.
