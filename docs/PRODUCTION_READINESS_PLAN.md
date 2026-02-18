# PrimarIA Production Readiness Plan

Date: 2026-02-18

## Goal
Take the platform from demo/beta to production-safe rollout for municipalities with auditable controls.

## Phase 1: Security and Production Guardrails
Status: completed

- Enforce Stripe-only payment mode in production.
- Disable mock payment confirmation when payment mode is not `mock`.
- Require citizen authentication and tenant ownership checks for mock payment confirmation.
- Normalize citizen JWT secret resolution to `JWT_SECRET` first.
- Remove hardcoded citizen JWT fallback secret.
- Normalize CNP encryption secret resolution (`CNP_ENCRYPTION_KEY` with `ENCRYPTION_KEY` fallback).
- Normalize CNP hash salt resolution (`CNP_TENANT_SALT_SECRET` with `TENANT_SALT_SECRET` fallback).
- Update production env template and deployment docs for consistent secret names.

## Phase 2: Access Control Consistency
Status: completed

- Restrict admin server actions to `requireAdmin()` in:
- `admin/hcl`
- `admin/scutiri`
- `admin/import`
- `admin/patrimven`
- `admin/calcul`
- Restrict admin pages previously using staff-level guard to `requireAdmin()`.
- Remove static default tenant admin password from tenant creation flow.
- Require explicit admin password (`min 12 chars`) when creating a tenant.

## Phase 3: CI and Quality Gates
Status: in progress

- Added committed ESLint config to remove interactive setup blocker.
- `npm run lint` now runs non-interactively and reports existing baseline issues.
- Added CI workflow with stable check names: `type-check`, `test`, `lint`.

Remaining work:
- Triage and fix lint baseline incrementally (no-explicit-any, unused vars, minor code quality issues).
- Add CI blocking gates for `type-check`, `test`, `lint`.

## Phase 4: Password Recovery
Status: completed

- Added DB-backed token model `password_reset_tokens` with expiry and one-time use.
- Implemented staff forgot/reset API and UI flows.
- Implemented citizen forgot/reset API and UI flows.
- Added token invalidation after successful reset and lockout counter reset on password update.

## Phase 5: Database Release Safety
Status: in progress

- Added migration lock metadata: `prisma/migrations/migration_lock.toml`.
- Added release preflight script: `scripts/db-release-preflight.sh`.
- Added npm commands: `db:migrate:status`, `db:preflight`, `db:preflight:strict`.
- Updated deployment runbook with preflight and strict drift-check workflow.

Remaining work:
- Move full schema ownership to versioned Prisma migrations.
- Keep `init.sql` for role/bootstrap only.
- Add tested rollback/recovery procedure.

## Phase 6: Billing and Tenant Lifecycle
Status: completed

- Enforced tenant status checks (`active`, `trial`) on:
- staff login (`src/lib/auth.ts`)
- staff access guard (`src/lib/auth-utils.ts`)
- citizen login/registration (`src/lib/citizen-auth.ts`)
- citizen token-based access validation (`src/lib/portal-auth.ts`)
- Added Stripe tenant subscription bootstrap on tenant creation (`src/lib/billing/tenant-subscription.ts`).
- Added Stripe webhook handlers for:
- `customer.subscription.created|updated|deleted`
- `invoice.payment_succeeded|payment_failed`
- Added tenant status sync based on Stripe subscription/invoice outcomes.
- Added super-admin lifecycle controls on tenant detail page:
- manual `active` / `suspended` / `cancelled` status updates
- billing metadata visibility (`customer/subscription/invoice status`)
- Added audit logs for manual and webhook-driven tenant status transitions.
- Added automatic email alerts to tenant admins when invoices fail and tenant is suspended.

Remaining work:
- Monitor billing analytics in production and tune alert thresholds.

## Phase 7: Integrations
Status: in progress

- ROeID controlled feature flag with explicit OFF behavior and fail-closed config checks.
- Bulk import v2 foundation implemented:
- Preview step with suggested column mapping
- Manual mapping override in admin UI
- Per-row idempotency ledger (`import_row_ledgers`)
- Precise rollback based on imported record IDs

Remaining work:
- Periodically review/adjust CODEOWNERS coverage for release-governance assets as team ownership evolves.
- Keep GitHub branch protection settings aligned with `docs/BRANCH_PROTECTION.md`.

## Release Gates
Production launch should require all gates below to pass:

- Security review sign-off for auth/RBAC/payment endpoints.
- Automated checks green: `npm run type-check`, `npm test`, `npm run lint`.
- Migration deployment rehearsal on staging from a fresh and an upgraded database.
- Backup/restore drill completed and documented.
- Incident response runbook test completed.
