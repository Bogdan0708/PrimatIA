# Repository Guidelines

## Project Structure & Module Organization
- `src/app/`: Next.js App Router entrypoints. Most product routes live under `src/app/[locale]/...`; API handlers live in `src/app/api/**/route.ts`.
- `src/components/`: shared UI, layout primitives, portal widgets, and client providers.
- `src/lib/`: business logic and integrations such as tax calculation, ANAF/PatrimVen, payments, auth, chatbot/AI, documents, notifications, and reporting.
- `src/messages/`: locale message bundles used by `next-intl`.
- `src/__tests__/`: Vitest suites grouped by domain (`tax-engine`, `anaf`, `payments`, `audit`, `import`, etc.).
- `e2e/`: Playwright specs plus authenticated storage state in `e2e/.auth/`.
- `prisma/`: schema, migrations, and seed logic.
- `docs/`: architecture, release governance, audits, and operational runbooks.
- `scripts/`: DB preflight, staging gate, release evidence, diagnostics, and migration helpers.
- `deploy/`, `docker/`: deployment and local infrastructure assets.

## Build, Test, and Development Commands
- `npm run dev`: start the local Next.js app.
- `npm run build` / `npm run start`: production build and runtime.
- `npm run lint`: run Next.js ESLint checks.
- `npm run type-check`: run strict TypeScript checks with `tsc --noEmit`.
- `npm test` / `npm run test:watch` / `npm run test:coverage`: run Vitest once, watch mode, or coverage.
- `npm run test:e2e`, `npm run test:e2e:headed`, `npm run test:e2e:ui`: run Playwright suites.
- `npm run db:generate`, `npm run db:push`, `npm run db:migrate`, `npm run db:migrate:status`, `npm run db:seed`, `npm run db:studio`, `npm run db:reset`: Prisma lifecycle commands.
- `npm run db:preflight` / `npm run db:preflight:strict`: release-oriented database safety checks.
- `npm run ops:import-rehearsal`, `npm run ops:staging-gate`, `npm run ops:release-evidence:new`: release and rollback governance helpers.
- Local services: `docker compose up -d` for PostgreSQL, PgBouncer, Redis, and MinIO when the feature under test needs them.

## Coding Style & Naming Conventions
- TypeScript runs with `strict: true`; keep public APIs explicitly typed.
- Use the `@/*` import alias for `src/*`.
- Follow existing formatting: 2-space indentation, semicolons, and double quotes in TS/TSX.
- Prefer server components in `src/app/` unless client interactivity is required.
- Keep file naming consistent with the area you touch:
  - route and utility modules are usually `kebab-case`,
  - shared UI files in `src/components/ui/` are also mostly `kebab-case`,
  - React component exports remain `PascalCase`.
- Keep domain logic in `src/lib/**`; avoid pushing business rules into route handlers or components.
- Reuse existing validation/utilities before adding parallel helpers (`src/lib/validations.ts`, `src/lib/utils.ts`, `src/lib/formatting/**`).

## Testing Guidelines
- Vitest runs in a Node environment and discovers `src/__tests__/**/*.test.ts`.
- Coverage is explicitly focused on `src/lib/tax-engine/**`, `src/lib/patrimven/**`, `src/lib/payments/**`, and `src/lib/anaf/**`.
- Prefer deterministic unit and integration tests; mock Stripe, email, AI, and other external systems.
- Playwright is configured against a deployed `baseURL` by default, not a local dev server. Do not assume `npm run test:e2e` targets `localhost` unless you first change config or override it intentionally.
- Authenticated E2E projects depend on `e2e/auth.setup.ts` and persisted state under `e2e/.auth/`.
- Generated artifacts such as `playwright-report/` and `test-results/` should stay out of intentional source edits.

## Database & Release Notes
- Prisma targets PostgreSQL and expects `DATABASE_URL` plus `DIRECT_DATABASE_URL`; strict drift checks also require `SHADOW_DATABASE_URL`.
- Read `docs/DB_RELEASE_RUNBOOK.md` before changing migrations or import/rollback behavior.
- Keep migration files immutable after merge. Use `prisma migrate dev` for local development and `prisma migrate deploy` only in deployment flows.
- When release governance is relevant, also consult `docs/BRANCH_PROTECTION.md`, `docs/RELEASE_EVIDENCE.md`, and `.github/workflows/staging-release-gate.yml`.

## Commit & Pull Request Guidelines
- Follow Conventional Commits already used in history: `feat:`, `fix:`, `chore:`, `docs:`, etc.
- Use `.github/pull_request_template.md` as written:
  - summarize what changed and why,
  - report validation (`type-check`, `test`, `lint` or a documented exception),
  - call out risk level and rollback plan.
- For RC or production-impacting work, include the required staging gate and release evidence links described in the PR template.
- If your change affects imports, rollbacks, or DB release safety, document tenant IDs and batch IDs where the runbook requires them.
