# TAX ENGINE MAP (Code-Based)

## Scope
This map describes only what is implemented in code/config today.

## 1) Calculation Entrypoints

- Primary batch entrypoint:
  - `runMassCalculation(fiscalYear)` in `src/app/[locale]/(authenticated)/admin/calcul/_actions/calcul-actions.ts`
  - Auth: `requireAdmin()`
  - Context: `setTenantContext(tenantId)`
  - Flow:
    - resolves active HCL
    - loads active taxpayers
    - calls `calculateAllTaxesForContribuabil(...)` per taxpayer
    - upserts `Impozit` rows
    - clears anomaly cache
- Tax engine orchestrator:
  - `calculateAllTaxesForContribuabil(tenantId, contribuabilId, fiscalYear)` in `src/lib/tax-engine/index.ts`
  - Loads active assets (building/land/vehicle), exemptions, taxpayer type, tenant rank
  - Executes per-asset calculators with per-asset error isolation
- Per-asset calculators:
  - `calculateBuildingTax(...)` in `src/lib/tax-engine/building-tax.ts`
  - `calculateLandTax(...)` in `src/lib/tax-engine/land-tax.ts`
  - `calculateVehicleTax(...)` in `src/lib/tax-engine/vehicle-tax.ts`
- Explainability endpoint:
  - `generateTaxExplanation(impozitId)` in `src/lib/tax-engine/tax-explainer.ts`
  - Exposed at `src/app/api/portal/taxes/[id]/explain/route.ts`
- Penalty module (not wired into regular recalculation flow):
  - `calculatePenalties(impozitId, asOfDate?)` in `src/lib/tax-engine/penalty.ts`

## 2) Core Inputs and Outputs

- Inputs (engine-level):
  - Asset data: `ProprietateCladire`, `ProprietateTeren`, `ProprietateVehicul`
  - Taxpayer data: `Contribuabil.tip` (`PF`/`PJ`)
  - Tenant config: `Tenant.communeRank`
  - HCL decision: `HclDecision` (`status` active variants)
  - Rates: `TaxRateTable`
  - Exemptions: `ScutireContribuabil` + `ScutireRegula`
- Outputs:
  - `TaxCalculationResult` (base, rate, calculated amount, exemptions, due, installments, period bounds, HCL/rate references)
  - persisted to `Impozit` rows by mass calculation action

## 3) Data Dependencies (Main Tables)

- Rule/config tables:
  - `hcl_decisions` (`HclDecision`)
  - `tax_rate_tables` (`TaxRateTable`)
  - `scutiri_reguli` (`ScutireRegula`)
  - `scutiri_contribuabil` (`ScutireContribuabil`)
  - `tax_type_registry` (`TaxTypeRegistry`)
- Domain tables:
  - `contribuabili` (`Contribuabil`)
  - `proprietati_cladiri`, `proprietati_terenuri`, `proprietati_vehicule`
  - `impozite` (`Impozit`)
  - `plati`, `plati_distributie`, `online_payments`
  - `penalitati`
  - `documente`, `somatii`, `somatii_impozite`

## 4) Configuration Sources

- DB-managed configuration:
  - HCL decision selection by tenant/year/status
  - Rate entries in `TaxRateTable`
  - Exemption rules and per-taxpayer application
  - Tax type registry lookup by `code`
- Code constants and formulas:
  - rounding, installments, bonification, proration rules in `src/lib/tax-engine/utils.ts`
  - vehicle bracket/weight tables and euro norm factors in `src/lib/tax-engine/vehicle-tax.ts`
  - building age/commune multiplier logic in `building-tax.ts`/`utils.ts`
- Environment:
  - no engine-specific env for formula behavior found
  - payment mode/gateway env affects collection paths, not tax base formulas

## 5) Recalculation Triggers

- Manual/admin trigger:
  - Mass calculation form -> `runMassCalculation(...)`
- Not automatically triggered on asset write:
  - property update actions (`contribuabili/_actions/property-actions.ts`) update assets and revalidate UI paths only
  - no synchronous or queued recalculation hook found in these write paths
- Exemption/HCL writes:
  - admin actions for scutiri/HCL primarily revalidate paths; no automatic recompute of existing `Impozit`
- Scheduled jobs / cron / event bus:
  - no active cron/event-bus-driven tax recalculation path found in current scan

## 6) Payment-to-Liability Integration

- Staff payment path (`plata-actions.ts`):
  - distributes oldest debts first, penalties first, updates `Impozit.sumaPlatita` and status
- API payment paths:
  - `api/plati/record` has similar distribution logic
  - `api/portal/payments/confirm`, `api/payments/webhook`, `api/payments/bank-transfer/confirm` create `Plata` and `PlataDistributie`, then update `Impozit`
- Notable divergence:
  - several online confirm/webhook flows compute `totalOwed` as `sumaDatorata` (without penalties) when setting status

## 7) Tenant/Isolation Dependency

- DB access relies on proxy in `src/lib/db.ts`
  - `withTenantScope(...)`: one transaction + `SET LOCAL app.current_tenant_id`
  - `setTenantContext(...)`: backward-compat mode; each query auto-wrapped in mini-transaction
  - tax flows use both patterns depending on module
