# TAX ENGINE TEST PLAN

## Goals
- Keep tax computations deterministic and reproducible.
- Prevent regressions in known high-risk integration paths.
- Make municipality rule changes testable with explicit fixtures.

## Current Coverage Baseline
- Existing unit tests:
  - building tax
  - land tax
  - vehicle tax
- Added in this audit:
  - utility boundary tests (proration/rounding/installments)
  - anomaly regression tests for outlier grouping/entity linking

## Test Layers

1. Pure unit tests (mandatory on each rule change)
- Target:
  - `src/lib/tax-engine/utils.ts`
  - per-asset calculators in `src/lib/tax-engine/*.ts`
- Validate:
  - rounding behavior
  - date boundaries and proration month count
  - installments split and due dates
  - exemption cap and stacking behavior
  - category/rate routing

2. Service/integration tests with mocked infra (current practical layer)
- Target:
  - anomaly detection service
  - mass calculation action orchestration (recommended next extension)
- Validate:
  - input grouping logic
  - entity link correctness
  - partial failure handling
  - no silent mutation behavior beyond explicit upserts

3. DB-backed flow tests (recommended next phase)
- Use a dedicated test DB schema and migrations.
- Key flows:
  - asset edit -> recalc -> impozit changed
  - exemption apply/remove -> recalc deltas
  - payment distribution -> tax status transitions (including penalties)
  - repeated webhook/event processing idempotency

## Golden Scenarios (Reference Cases)

1. PF with one residential building, full-year ownership.
2. PF acquires property mid-year; verify month-start rule.
3. PF sells property mid-year; verify disposal month included.
4. PJ non-residential with recent vs stale revaluation.
5. Land category switching (`curti` vs `intravilan` vs `extravilan`).
6. Vehicle taxes:
- car brackets + euro norm adjustments
- truck/trailer weight-table branch
7. Multiple exemptions with cap at total due.
8. Payment partial, full, and overpayment across multiple years.
9. Backdated asset correction requiring recompute.

## How To Run

- Type check:
  - `npm run type-check`
- All tests:
  - `npx vitest`
- Tax + AI anomaly focused:
  - `npx vitest src/__tests__/tax-engine src/__tests__/ai/anomaly-detection.test.ts`

## How To Add Municipality Rule Variants

1. Add/adjust HCL + rate fixtures for a variant municipality/year.
2. Keep fixture names explicit:
- `tenant_{name}_hcl_{year}`
3. Add golden tests using same raw input across variants, assert expected deltas.
4. Record expected formula path in test names, not just output.
5. If legal interpretation changes, add a dedicated “legal-confirmed” test case and keep legacy case for migration safety until cutover.

## Gaps To Close Next

1. Add DB integration tests for `runMassCalculation`.
2. Unify payment allocation logic into a shared service and test once.
3. Add property/scutire write-trigger recalc tests (or job-queue trigger tests if adopted).
