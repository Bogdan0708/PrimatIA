# Production Readiness Audit — Bogdan0708/PrimatIA

> **Date**: 2026-03-04
> **Triggered by**: External migration risk review that flagged "PrimarIA" as HIGH RISK
> **Conclusion**: All 5 audit findings are **false positives** — they target a different repo (SanityCode-group/PrimarIA). This repo's infrastructure is production-ready. 6 business logic gaps remain.

---

## External Audit Findings vs This Repo

The audit targeted **SanityCode-group/PrimarIA** (confirmed: separate repo at `github.com/SanityCode-group/PrimarIA`), not **Bogdan0708/PrimatIA**.

| Audit Claim | Verified Against This Repo | Status |
|---|---|---|
| "DROP TABLE IF EXISTS in raw SQL scripts" | No DROP TABLE in any migration. All 3 migrations are additive CREATE TABLE only. Searched repo + full git history. | **FALSE** |
| "BBDDprimarIA_script.sql" | Does not exist. Not in repo, not in git history. | **FALSE** |
| "No versioned migration framework" | Prisma Migrate with timestamped dirs, `migration_lock.toml`, `_prisma_migrations` tracking table. | **FALSE** |
| "No rollback runbook" | `docs/DB_RELEASE_RUNBOOK.md` (6-phase process), `scripts/import-rollback-rehearsal.mjs` (verify-import + verify-rollback modes). | **FALSE** |
| "DB changes bundled in regular commits without controlled migration gating" | Migrations in dedicated `prisma/migrations/` dir, gated by `db:preflight:strict` script, staging release gate workflow. | **FALSE** |

---

## Infrastructure — Production Ready

| Area | Status | Evidence |
|---|---|---|
| Migration safety | READY | Prisma 6 versioned migrations, preflight + drift checks, shadow DB |
| Rollback path | READY | DB Release Runbook, import/rollback rehearsal scripts, staging gate workflow |
| Secrets management | READY | No hardcoded creds, GCP Secret Manager integration, `.env` templates with CHANGE_ME |
| Deployment flow | READY | Docker multi-stage, migrations before app, health checks, Cloud Run |
| Tenant isolation | READY | PostgreSQL RLS, AsyncLocalStorage proxy, 3-role system (app/admin/service) |
| FK/constraints | READY | All 36 models with proper @relation, 11 unique constraints, Decimal(12,2) for money |
| Soft deletes | READY | Consistent `deletedAt: null` filtering verified across queries |
| Auth | READY | Bcrypt, 5-attempt lockout, JWT with fallback chain, session validation |

---

## Business Logic Gaps — Must Fix Before Handling Real Taxpayer Money

| # | Gap | Severity | Impact | Fix Scope |
|---|---|---|---|---|
| 1 | **No MFA for staff** — TOTP column exists in TenantUser but is unused | CRITICAL | Super admin accessible with password only | ~2 days |
| 2 | **Document number race condition** — `COUNT+1` pattern in `src/lib/documents/generator.ts` | HIGH | Duplicate document numbers under concurrent PDF generation | ~1 day (ChitantaSequence pattern exists) |
| 3 | **No payment reversal/storno flow** | HIGH | Incorrect payments can't be formally corrected | ~3 days |
| 4 | **In-memory rate limiter** — state lost on deploy/scale | MEDIUM | Burst abuse during Cloud Run rolling deploys | ~1 day (move to Redis) |
| 5 | **No PII redaction before AI gateway** — CNP/names sent to external LLM | MEDIUM | Privacy risk if AI Gateway logs inputs | ~1 day |
| 6 | **Citizen registration leaks account existence** — different error for existing vs non-existing email | MEDIUM | Email enumeration attack vector | ~0.5 day |

---

## Repo Blockers (as of 2026-03-04)

| # | Issue | Action | PR |
|---|---|---|---|
| B-1 | CI pipeline broken (DB health check mismatch) | Merge CI fix | [PR #4](https://github.com/Bogdan0708/PrimatIA/pull/4) |
| B-2 | `master` 2 commits ahead of `main` | Sync branches after PR #4 | — |
| B-3 | 26 security fixes blocked by broken CI | Rebase onto fixed CI | [PR #3](https://github.com/Bogdan0708/PrimatIA/pull/3) |

---

## EuFund Note

The audit also flagged **Bogdan0708/EuFund** for migration collision risk (Drizzle metadata drift, duplicate object creation in migrations 0008/0009). That repo exists and is under the same account — it needs its own separate audit.

---

## Verification Method

- `git log --all -- '**/BBDD*'` — no results
- `grep -r "DROP TABLE" prisma/migrations/` — no results
- All 3 migration SQL files read and verified as additive-only
- `docker/postgres/init.sql` reviewed — role setup only, no destructive DDL
- GitHub remote state fetched and compared to local
- SanityCode-group/PrimarIA confirmed as separate repo via `gh repo view`
