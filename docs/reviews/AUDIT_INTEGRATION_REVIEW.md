# Romanian Software Audit — Integration Review for PrimărIA

**Date:** 2026-02-13  
**Reviewer:** Codex (GPT-5.2) via OpenClaw  
**Input:** `ROMANIAN_SOFTWARE_AUDIT.md` (Gemini audit of legacy ItAS/ContAS/AgrAS software)  
**Target:** PrimărIA — Next.js 14 + Prisma + PostgreSQL local tax management system

---

## Executive Assessment

**PrimărIA's current architecture is remarkably well-aligned with the audit findings.** The schema already has `codRol`, `tip` (PF/PJ), `zona`, year-versioned HCL decisions, and the full Romanian address structure. The tax engine calculators follow the correct legal articles. The document templates exist as React PDF components.

**What's missing is data, not structure.** The rate tables are empty placeholders, the vehicle calculator lacks truck/trailer axle-weight logic, and the chitanță template doesn't have number-to-words. These are **enhancement tasks, not architectural rewrites**.

---

## Priority Matrix

### 🟢 P0 — High Value, Low Complexity (Do This Week)

| Finding | Effort | Value | Notes |
|---------|--------|-------|-------|
| **Seed vehicle tax rate tables** | 2-3h | ★★★★★ | 5 car brackets + motorcycle + bus already match `CAR_BRACKETS` in code. Just need `TaxRateTable` seed data |
| **Seed building tax rate tables** | 2-3h | ★★★★★ | Base rates per sqm by construction type + zone. Current calculator already uses `findRateTableEntry(taxType, tipConstructie, zona)` |
| **Seed land tax rate tables** | 2-3h | ★★★★★ | 11 categories × 4 zones × intravilan/extravilan. Calculator already has category + zone lookup |
| **Romanian number-to-words** | 3-4h | ★★★★★ | Port PascalScript algorithm → TypeScript utility in `src/lib/formatting.ts`. Used in chitanță `sumaInLitere` field (already wired!) |
| **Add `sat` field to `Adresa`** | 30min | ★★★★ | Missing village field for rural communes. Simple migration + form update |

### 🟡 P1 — High Value, Medium Complexity (Next Sprint)

| Finding | Effort | Value | Notes |
|---------|--------|-------|-------|
| **Truck/trailer axle-weight calculator** | 1-2d | ★★★★★ | Current `camion` branch is oversimplified (flat per-ton). Need C2/C3/C4 + pneumatic/other suspension + weight step tables |
| **Building zone multipliers** | 4-6h | ★★★★ | Audit shows 2.5x→0.9x by urban rank. Add `communeRank`-based multiplier lookup to building calculator |
| **Enhance chitanță template** | 1d | ★★★★ | Add: serie/numar fields, budget classification codes per line, ANULAT/COPIE watermarks, 10-line distribution table matching legacy format |
| **Certificat fiscal template upgrade** | 1d | ★★★★ | Current `certificat-atestare.tsx` exists but needs: all property types listed, outstanding debts, enforcement status, legal language from audit |
| **PJ building tax path** | 4-6h | ★★★★ | `valoareInventar` field exists in schema. Calculator has PJ branch stub. Need: date-bounded rate lookup, 1.5% standard rate logic |
| **Decizie de impunere enhancement** | 1d | ★★★★ | Template exists. Add: per-property breakdown, rate justification, HCL reference, installment schedule |

### 🔵 P2 — Medium Value, Medium Complexity (Month 2)

| Finding | Effort | Value | Notes |
|---------|--------|-------|-------|
| **Budget classification codes** | 2-3d | ★★★ | New `BudgetCode` table. Map each tax type to Romanian budget classification. Used in chitanță lines + treasury reporting |
| **Somație/Titlu executoriu upgrade** | 1-2d | ★★★ | Template exists (`somatie.tsx`). Add: legal basis text, property listing, interest calculation breakdown |
| **ANAF PatrimVen XML export** | 3-5d | ★★★ | `ExportJob` model + `PatrimvenCodeMapping` already in schema. Need: P2000 XML schema implementation, field mapping |
| **Year-over-year rate comparison** | 1d | ★★ | Dashboard showing rate changes between HCL decisions. Nice for transparency |

### ⚪ P3 — Lower Priority / Future (Month 3+)

| Finding | Effort | Value | Notes |
|---------|--------|-------|-------|
| **Agricultural registry (AgrAS)** | 2-3w | ★★ | Separate domain. Only relevant for rural communes with APIA reporting needs |
| **FOREXEBUG integration** | 1-2w | ★★ | National budget execution system. Complex XML schemas. Most communes outsource this |
| **D112 salary declarations** | 1w | ★ | Out of scope for tax management — belongs in payroll module |
| **Social assistance module** | 2-3w | ★ | Entirely separate domain from tax management |

---

## Technical Implementation Plan

### 1. Tax Rate Seed Data (P0)

**File:** `prisma/seed/tax-rates-2025.ts` (new)

The current `TaxRateTable` model is perfect. Create seed data organized by tax type:

```typescript
// Vehicle rates — matches existing CAR_BRACKETS labels
const vehicleRates2025 = [
  { taxType: 'impozit_mijloace_transport', category: 'autoturism_sub_1600', rateValue: 8, unit: 'lei/200cmc' },
  { taxType: 'impozit_mijloace_transport', category: 'autoturism_1601_2000', rateValue: 18, unit: 'lei/200cmc' },
  { taxType: 'impozit_mijloace_transport', category: 'autoturism_2001_2600', rateValue: 72, unit: 'lei/200cmc' },
  { taxType: 'impozit_mijloace_transport', category: 'autoturism_2601_3000', rateValue: 144, unit: 'lei/200cmc' },
  { taxType: 'impozit_mijloace_transport', category: 'autoturism_peste_3000', rateValue: 290, unit: 'lei/200cmc' },
  // ... motorcycles, buses, trucks (from audit config files)
];

// Building rates — by tipConstructie + zona
const buildingRatesPF2025 = [
  { taxType: 'impozit_cladiri_rezidentiala', category: 'cadre_beton', zona: 'A', rateValue: 0.08, unit: 'percent' },
  { taxType: 'impozit_cladiri_rezidentiala', category: 'cadre_beton', zona: 'B', rateValue: 0.08, unit: 'percent' },
  // ... per construction material × zone
];

// Land rates — by categorie + zona
const landRatesIntravilan2025 = [
  { taxType: 'impozit_teren_intravilan', category: 'cu_constructii', zona: 'A', rateValue: 1.10, unit: 'lei/mp' },
  { taxType: 'impozit_teren_intravilan', category: 'arabil', zona: 'A', rateValue: 0.0032, unit: 'lei/mp' },
  // ... 11 categories × 4 zones × intravilan/extravilan
];
```

**Impact:** Zero schema changes. Just `prisma db seed` with real data from audit configs.

### 2. Romanian Number-to-Words (P0)

**File:** `src/lib/formatting.ts` (extend existing)

```typescript
export function numberToWordsRo(n: number): string {
  // Port the proven PascalScript algorithm from audit
  // Handle: gender agreement (una mie vs un milion), 
  // teens (unsprezece), special concatenation (douămii)
  // Returns: "o sută douăzeci și trei lei și patruzeci și cinci bani"
}
```

**Integration:** The chitanță template already uses `data.sumaInLitere`. Just wire the function into the document generator.

### 3. Truck/Trailer Axle-Weight Calculator (P1)

**File:** `src/lib/tax-engine/vehicle-tax.ts` (extend)

The current `camion` branch does flat per-ton. The audit reveals trucks use **axle configuration × suspension type × weight range** tables:

```typescript
// New vehicle subtypes from audit
type TruckAxleConfig = 'C2' | 'C3' | 'C4' | 'C2+1' | 'C2+2' | 'C2+3' | 'C3+2' | 'C3+3';
type SuspensionType = 'pneumatic' | 'other';

// Rate lookup changes from flat to:
// category = `camion_${axleConfig}_${suspension}_${weightRange}`
// e.g., "camion_C2_pneumatic_12t_13t"
```

**Schema change needed:** Add to `ProprietateVehicul`:
```prisma
nrAxe          Int?     @map("nr_axe")
configAxe      String?  @map("config_axe") @db.VarChar(10)  // C2, C3, C2+1, etc.
tipSuspensie   String?  @map("tip_suspensie") @db.VarChar(20) // pneumatic, other
```

**Migration:** Non-breaking addition of nullable columns.

### 4. Zone Multiplier System (P1)

The audit shows building/land rates are adjusted by commune rank (urban ranking A-D → multipliers 2.5x to 0.9x). The `Tenant` model already has `communeRank`. 

**File:** `src/lib/tax-engine/utils.ts` (extend)

```typescript
// Art. 457 zone correction coefficients by commune rank
const ZONE_MULTIPLIERS: Record<number, Record<string, number>> = {
  0: { A: 2.50, B: 2.40, C: 2.30, D: 2.20 }, // Rank 0 (București)
  1: { A: 2.40, B: 2.30, C: 2.20, D: 2.10 }, // Rank I
  2: { A: 2.30, B: 2.20, C: 2.10, D: 2.00 }, // Rank II
  3: { A: 1.10, B: 1.05, C: 1.00, D: 0.95 }, // Rank III
  4: { A: 1.05, B: 1.00, C: 0.95, D: 0.90 }, // Rank IV
  5: { A: 1.00, B: 0.95, C: 0.90, D: 0.90 }, // Rank V (comuna)
};

export function getZoneMultiplier(communeRank: number, zona: string): number {
  return ZONE_MULTIPLIERS[communeRank]?.[zona] ?? 1.0;
}
```

**Impact:** Add one multiplier step in `calculateBuildingTax` and `calculateLandTax` after the base rate lookup.

### 5. Chitanță Template Enhancement (P1)

**File:** `src/lib/documents/templates/chitanta.tsx` (enhance)

Current template is functional but basic. Needed additions from audit:

1. **Serie + Numar** — Add `serieChitanta` field (currently only has `documentNumber`)
2. **Budget classification codes** per distribution line (add `cod` column to the distributions table)
3. **Restante vs debit curent** split per line (current `distributions` doesn't distinguish)
4. **Dobânzi/penalități** per line
5. **Bonificații** total row
6. **ANULAT watermark** — Red diagonal text overlay when `chitantaAnulata === true`
7. **COPIE watermark** — Gray diagonal text for reprints

```tsx
// Watermark implementation
{data.isAnulat && (
  <View style={styles.watermark}>
    <Text style={{ color: 'red', fontSize: 72, opacity: 0.3, 
      transform: 'rotate(-45deg)', position: 'absolute' }}>
      ANULAT
    </Text>
  </View>
)}
```

### 6. Document Types Enhancement (P1-P2)

**Add `ChitantaLineItem` type to `src/lib/documents/types.ts`:**

```typescript
interface ChitantaLineItem {
  denumire: string;           // Tax name
  codBugetar: string;         // Budget classification code
  debitCurent: number;        // Current year principal
  restante: number;           // Overdue principal
  dobanzi: number;            // Interest/penalties
  total: number;              // Line total
}
```

This matches the legacy 10-line structure from the audit.

---

## Database Migration Strategy

### Migration 1: Address Enhancement (P0, non-breaking)
```sql
ALTER TABLE adrese ADD COLUMN sat VARCHAR(100);
-- Already has: strada, numar, bloc, scara, etaj, apartament, localitate, judet, cod_postal
-- Missing only: sat (village) for rural addresses
```

### Migration 2: Vehicle Detail Fields (P1, non-breaking)
```sql
ALTER TABLE proprietati_vehicule ADD COLUMN nr_axe INTEGER;
ALTER TABLE proprietati_vehicule ADD COLUMN config_axe VARCHAR(10);
ALTER TABLE proprietati_vehicule ADD COLUMN tip_suspensie VARCHAR(20);
```

### Migration 3: Budget Classification (P2)
```sql
CREATE TABLE budget_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name_ro VARCHAR(255) NOT NULL,
  category VARCHAR(50), -- venituri/cheltuieli
  parent_code VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Link tax types to budget codes
ALTER TABLE tax_type_registry ADD COLUMN budget_code_id UUID REFERENCES budget_codes(id);
```

### Migration 4: Receipt Series (P1, non-breaking)
```sql
-- Receipt numbering series
CREATE TABLE receipt_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  serie VARCHAR(10) NOT NULL,
  current_number INTEGER DEFAULT 0,
  fiscal_year INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(tenant_id, serie, fiscal_year)
);
```

### No Migration Needed For:
- **ROL system** → Already exists as `cod_rol` on `contribuabili`
- **PF/PJ dual-track** → Already exists as `tip` field (VarChar(2))
- **Year-versioned configs** → Already exists via `HclDecision.fiscalYear` → `TaxRateTable`
- **Romanian address** → Already has all fields except `sat`
- **CNP/CUI** → Already exists as `cnp` (encrypted) + `cui`
- **Zone-based rates** → `TaxRateTable` already has `zona` column

---

## Risk Assessment

### Low Risk
| Risk | Mitigation |
|------|------------|
| Rate tables from 2010 config files may be outdated | Use as baseline structure; actual rates set per-tenant via HCL decisions. The *structure* (brackets, categories) hasn't changed |
| Number-to-words edge cases | Comprehensive test suite with known Romanian amounts. The algorithm is proven in production |
| Template layout differences | Current @react-pdf templates are already close. Enhancement, not replacement |

### Medium Risk
| Risk | Mitigation |
|------|------------|
| Truck axle-weight complexity | 8 axle configs × 2 suspension types × ~10 weight ranges = ~160 rate entries per year. Needs careful seeding + admin UI for verification |
| PatrimVen XML schema changes | ANAF updates their schema periodically. Build with versioned XSD validation. Start with read-only export (no submission) |
| Budget classification code mapping | 200+ codes. Source from official Ministerul Finanțelor classifications, not legacy software alone |

### High Risk
| Risk | Mitigation |
|------|------------|
| Legal compliance of ported rates | **Never ship audit rates as defaults.** Each primărie must configure their own rates via HCL. Provide rates as *examples* in documentation only |
| ANAF integration authentication | Legacy used smart cards + Java 6. Modern ANAF APIs use different auth (SPV portal, e-Guvernare certificates). Research current ANAF API before building |

---

## Effort Estimation Summary

| Phase | Items | Estimated Effort | Business Impact |
|-------|-------|-----------------|-----------------|
| **P0 — Rate Seeding + Formatting** | 5 items | **2-3 days** | Tax engine goes from placeholder to production-ready |
| **P1 — Calculator + Template Enhancement** | 6 items | **1.5-2 weeks** | Full PF/PJ tax calculation + official document output |
| **P2 — Budget Codes + Exports** | 4 items | **2-3 weeks** | Treasury integration + ANAF compatibility |
| **P3 — Extended Modules** | 4 items | **1-2 months** | Agricultural registry, FOREXEBUG (future roadmap) |

**Total for production-ready local tax system: ~4-5 weeks** from current state.

---

## Key Insight

The audit confirms PrimărIA's architecture was designed correctly from the start. The schema models (Contribuabil with tip PF/PJ, codRol, encrypted CNP, Romanian address structure, HCL-versioned rate tables, zone-based lookups) mirror exactly what the battle-tested legacy software uses internally.

**The fastest path to a production-ready system is not architectural change — it's data population and calculator refinement.** Seed the rate tables, port the number-to-words algorithm, extend the truck calculator, and enhance the document templates. The foundation is solid.

---

## Recommended Immediate Actions

1. **Today:** Create `prisma/seed/tax-rates-default.ts` with vehicle + building + land rates from audit
2. **Today:** Implement `numberToWordsRo()` in `src/lib/formatting.ts`  
3. **Tomorrow:** Add `sat` column migration + truck vehicle fields
4. **This week:** Enhance chitanță with ANULAT/COPIE watermarks + budget code column
5. **Next week:** Implement truck axle-weight calculator + zone multipliers
6. **Next week:** Upgrade certificat fiscal + decizie de impunere templates with audit-sourced legal language
