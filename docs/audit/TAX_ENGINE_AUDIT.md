# TAX ENGINE AUDIT (Correctness and Integration)

## Top Risks (Highest First)

1. Payment status/outstanding logic is inconsistent across flows.
- Staff payment distribution includes penalties in debt coverage (`sumaDatorata + sumaPenalitati`).
- Multiple online confirmation paths update status using only `sumaDatorata`.
- Portal debt views also use `sumaDatorata - sumaPlatita` in some places.
- Risk: liabilities shown in portal/admin diverge; taxes marked `platit` while penalties remain.

2. Recalculation is primarily manual, not strongly event-driven.
- Asset/scutire/HCL edits do not consistently trigger automatic recomputation of impacted liabilities.
- Risk: stale `Impozit` rows until staff runs mass calculation.

3. Time/date behavior is local JS `Date` based with no explicit Europe/Bucharest normalization.
- Proration uses `getFullYear()/getMonth()` and `new Date(year, month, day)`.
- DB fields are mix of `@db.Date` and `@db.Timestamptz`.
- Risk: edge behavior around timezone conversion when parsing user dates and server/runtime locale.

4. Duplicate business rules across modules.
- Distribution logic appears in staff action + multiple API routes.
- Risk: logic drift and partial fixes (one path patched, others left inconsistent).

5. Idempotency/concurrency protections are uneven.
- Some online payment flows use row locks and event dedupe (`stripeEventId`, `FOR UPDATE`), others are less strict.
- Mass calculation is not guarded by explicit mutex/lease for same tenant/year.
- Risk: concurrent runs or repeated callbacks can produce inconsistent state transitions.

6. Legal/rule provenance is only partially persisted.
- `Impozit` stores `hclDecisionId` and `rateTableId`, and computed totals.
- Intermediate breakdown steps are generated on-demand in explainer, not persisted as immutable calculation snapshot.
- Risk: replayability/audit explainability depends on current source rows and mutable related data.

## Implemented Rules (as encoded today)

- Rounding:
  - whole-leu rounding with `Math.round` (`roundToLei`)
  - per-exemption amount also rounded before sum
- Proration:
  - starts month after acquisition; ends at disposal month-end
  - `nrLuni` capped to `[0..12]`
- Installments:
  - split into 2 installments; first gets odd remainder
  - due dates: March 31 / September 30
- Bonification:
  - computed as 10% of `sumaDatorata` (rounded)
- Building:
  - PF: age coefficient + commune rank multiplier + co-ownership + proration
  - PJ non-residential: revaluation-date-based rate fallback logic
- Land:
  - tax type inferred from category (`curti` / `intravilan` / `extravilan`)
  - supports `lei/mp` and `lei/ha`
- Vehicle:
  - category/bracket routing
  - euro norm adjustments for non-weight-table paths
  - truck/trailer weight-table paths with hardcoded tables

## Ambiguities / Assumptions in Current Code

- Exemption aggregation policy:
  - current code rounds each exemption amount before summing
  - may differ from “sum raw discounts then round once” interpretation
- Mixed building handling:
  - mixed path currently uses one base/rate path; area split details are limited
- HCL status compatibility:
  - engine still accepts both `active` and legacy `activ`
- Penalty lifecycle:
  - penalty calculator exists but no clearly wired recurring accrual trigger in current flow
- Overpayment handling:
  - remainder returned by distribution in some paths; no explicit persistent “credit ledger” model in tax core

## Explainability and Audit Trail

Current support:
- `Impozit` persists critical inputs/results references:
  - property reference, tax type, fiscal year
  - `hclDecisionId`, `rateTableId`
  - base/rate/intermediate totals and installments
- `generateTaxExplanation()` produces human-readable step breakdown with legal labels.

Gap:
- Breakdown is generated dynamically, not immutable per-calculation snapshot.

Recommended structure (minimal, backward-compatible):
- Add optional JSON snapshot on `Impozit`, e.g. `calculationBreakdown Json?`
- Store at computation time:
  - input snapshot (asset fields used, taxpayer type, tenant rank, fiscal year)
  - rule snapshot (`hclDecisionId`, `rateTableId`, engineVersion)
  - ordered steps (formula + numeric intermediate values)
  - final totals and installment schedule
- Benefits:
  - deterministic replay evidence
  - audit trace resilient to later edits in related entities

## Needs Legal Confirmation (Validation Questions)

1. Exemption rounding:
- Should each exemption be rounded individually, or only the final combined exemption value?

2. Payment allocation with penalties:
- In all channels, must status transition to `platit` require full coverage of debit + accrued penalties?

3. Bonification mechanics:
- Is bonification always 10% for all tax types and municipalities, or should it be tenant/HCL configurable?

4. PJ revaluation timing:
- Are year thresholds (`<=3`, `3-5`, `>5`) and rates fixed globally or dependent on HCL/local policy?

5. Mixed-use building formula:
- Is proportional split by residential/non-residential area required in all mixed cases?

6. Weight-table vehicle taxes:
- Are hardcoded bracket values intended as defaults only, or must all production rates come strictly from HCL tables?

7. Backdated edits:
- For asset/scutire changes effective in past periods, what is the mandatory recomputation scope (current year only vs historical years)?

8. Overpayment crediting:
- Is overpayment required to be tracked as explicit taxpayer credit balance with formal carry-forward/refund workflow?
