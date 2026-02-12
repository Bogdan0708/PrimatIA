# PrimărIA — Architecture & Completeness Review

**Reviewer**: Technical Architecture Review (automated)  
**Date**: 2026-02-12  
**Documents Reviewed**: PRD.md, ARCHITECTURE.md, IMPLEMENTATION.md, DATA_MODEL.md, RESEARCH_REPORT.md  
**Comparison**: hospitality-saas codebase  

---

## 1. Data Model Completeness

### ✅ What's Covered
- All major Title IX tax types are in the registry (buildings residential/non-residential/mixed, land intravilan/extravilan/curti, vehicles, taxa firma, taxa hotelieră, taxa spectacole, taxa utilizare domeniu public, alte taxe locale)
- Building model captures destinație, tip construcție, suprafață, an, zonă, cotă parte — solid
- Vehicle model has cilindree, putere kW, norma poluare, masă totală — covers Art. 470

### ⚠️ Gaps & Issues

**Missing entities:**

1. **`proprietati_firma` (Business signage/advertising)** — Taxa firmă (Art. 475) needs a table for business signage dimensions, location, type. Currently no entity captures the physical signage attributes needed for calculation.

2. **`cazare_turistica` (Tourist accommodation)** — Taxa hotelieră (Art. 478) requires tracking accommodation units, capacity, nightly rates, and occupancy for calculation. No entity exists for this.

3. **`spectacole` (Events/shows)** — Taxa spectacole (Art. 480) requires ticket revenue tracking per event. No entity for event declarations.

4. **`contribuabil_relatii` (Taxpayer relationships)** — PRD mentions "legături familiale, mandate" but there's no join table for co-ownership, family relationships, or legal representative mandates across taxpayers.

5. **`penalitati` (Penalties detail table)** — `impozite.suma_penalitati` is a single field. The Cod de Procedură Fiscală requires tracking penalty accrual daily (0.01%/day for delay interest + 0.01%/day for penalties). A separate `penalitati` table with `data_start`, `data_stop`, `rata_zilnica`, `suma` is needed for audit compliance.

6. **`adrese` (Normalized address table)** — Addresses are scattered as TEXT fields across multiple tables. PatrimVen requires structured addresses (strada, numar, bloc, scara, etaj, apartament, localitate, judet, cod_postal). A shared `adrese` table would solve PatrimVen mapping AND deduplication.

7. **`zone_fiscale` (Fiscal zone definitions)** — Zones A/B/C/D are referenced as VARCHAR(1) but there's no table defining zone boundaries per tenant. Admins need to map streets/sectors to zones.

8. **History/versioning for properties** — When a building is renovated (changes `tip_constructie` or `suprafata`), the old values are lost. Need a `proprietati_cladiri_istoric` table or use a temporal pattern. This is critical for mid-year changes and retroactive calculations.

**Relationship gaps:**
- No explicit link between `contribuabili` for co-ownership of the same property (e.g., spouses owning 50/50). `cota_parte` exists on the property but there's no way to link the same physical building to two taxpayers.
- `somatii.impozit_ids UUID[]` — using an array of UUIDs instead of a proper join table breaks referential integrity. Use `somatii_impozite` join table.

### 🔧 Recommendations

```sql
-- Co-ownership: allow same physical property, multiple contribuabili
-- Add a "physical property" concept and link contribuabili to it
CREATE TABLE proprietati_detinatori (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    proprietate_type VARCHAR(20) NOT NULL, -- cladire, teren, vehicul
    proprietate_id UUID NOT NULL,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    cota_parte DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    valid_from DATE NOT NULL,
    valid_to DATE,
    UNIQUE(proprietate_id, contribuabil_id, valid_from)
);

-- Penalties accrual
CREATE TABLE penalitati (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    impozit_id UUID NOT NULL REFERENCES impozite(id),
    tip VARCHAR(20) NOT NULL, -- dobanda_intarziere, penalitate_intarziere
    data_start DATE NOT NULL,
    data_stop DATE NOT NULL,
    baza_calcul DECIMAL(12,2) NOT NULL,
    rata_zilnica DECIMAL(8,6) NOT NULL,
    nr_zile INTEGER NOT NULL,
    suma DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Structured addresses
CREATE TABLE adrese (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    strada VARCHAR(255),
    numar VARCHAR(20),
    bloc VARCHAR(20),
    scara VARCHAR(10),
    etaj VARCHAR(10),
    apartament VARCHAR(10),
    localitate VARCHAR(100) NOT NULL,
    judet VARCHAR(50) NOT NULL,
    cod_postal VARCHAR(10),
    zona_fiscala VARCHAR(1), -- A/B/C/D
    coordonate POINT, -- optional GPS
    UNIQUE(tenant_id, strada, numar, bloc, scara, apartament, localitate)
);
```

**Severity: HIGH** — The missing entities for taxa firmă, taxa hotelieră, and taxa spectacole mean 3 of 11 tax types cannot actually be calculated at launch.

---

## 2. Tax Engine Design

### ✅ Strengths
- Configurable rate tables tied to HCL decisions — correct approach
- Legal min/max bounds on rates — important for validation
- Exemption rules engine with conditions JSON — flexible
- Two-installment split (Mar 31 / Sep 30) — legally correct
- Inflation indexation via `hcl_decisions.inflation_index`

### ⚠️ Edge Cases Not Addressed

1. **Partial year ownership** — If a taxpayer acquires a building on June 15, they owe tax starting from July 1 (first of the following month per Art. 461). The calculation flow doesn't show partial year proration. The `impozite` table has no `data_start_calcul` / `data_stop_calcul` fields.

2. **Mid-year rate changes** — If an HCL is amended mid-year (rare but legal), the system needs to handle two rate periods for the same fiscal year. `hcl_decisions.valid_from/valid_to` supports this but the calculation flow (step 1: "resolve latest active HCL") would pick only one.

3. **Exemption stacking** — Can a taxpayer have both a veteran exemption (100%) and a handicap reduction (50%)? The rules engine needs a `stacking_policy`: are they additive (capped at 100%), or does the highest win, or tenant-configurable? Not defined.

4. **Building age coefficient** — Art. 457 applies a reduction coefficient based on building age (ranges from 1.00 for new buildings to 0.85 for 100+ years). Not captured in the data model or calculation flow.

5. **Vehicle tax brackets** — Art. 470 has complex brackets: per 200cm³ for cars, per seat for buses, per ton for trucks, flat for motorcycles. The `rate_tables.category` field tries to capture this but the calculation engine needs different formulas per vehicle type, not just `rate × base_value`.

6. **Rounding rules** — Art. 489 specifies rounding to whole lei. Step 6 mentions this but it's unclear if rounding happens before or after installment splitting (it should be: round total, then split; or round each installment — need to verify legal interpretation).

7. **Agricultural land categories** — Art. 465 has 4 categories for intravilan (curti-construcții, arabil, pășuni, forestier) and 4 for extravilan (arabil, pășuni, forestier, ape/drumuri). The `proprietati_terenuri.categorie` field exists but there's no enum validation or seed data.

8. **Multiple buildings/vehicle bonus** — Some communes offer discounts for early payment (bonificație) per Art. 462: 10% discount if both installments paid by March 31. This is not in the calculation flow.

### 🔧 Recommendations

```typescript
// Add to impozite table
data_start_calcul DATE, -- Start of taxable period (may differ from Jan 1)
data_stop_calcul DATE,  -- End of taxable period
nr_luni INTEGER NOT NULL DEFAULT 12, -- Months of ownership in fiscal year
bonificatie DECIMAL(12,2) DEFAULT 0, -- Early payment discount

// Vehicle calculation needs polymorphic formula
interface TaxFormula {
  type: 'percent_of_value' | 'per_unit_bracket' | 'flat' | 'percent_of_revenue';
  // percent_of_value: buildings (rate% × taxable_value)
  // per_unit_bracket: vehicles (rate × units_in_bracket)
  // flat: motorcycles, some fixed taxes
  // percent_of_revenue: taxa spectacole (2-5% of ticket revenue)
}
```

**Severity: HIGH** — Partial year calculation and bonificație are mandatory features that affect every taxpayer who buys/sells property.

---

## 3. PatrimVen Integration

### ✅ Covered
- F3001 (Property), F3002 (Vehicle), F3101 (Fiscal certificates) identified
- Basic field mapping provided
- DUKIntegrator format mentioned

### ⚠️ Issues

1. **Address mapping is incomplete** — PatrimVen requires structured addresses (`<Judet>`, `<Localitate>`, `<Strada>`, `<Numar>`, `<Bloc>`, `<Scara>`, `<Etaj>`, `<Apartament>`). The current model stores `adresa TEXT` which requires parsing. This will fail for non-standard addresses. See the `adrese` table recommendation in §1.

2. **Missing PatrimVen codes** — The mapping shows `proprietati_cladiri.destinatie → <TipCladire>` with "Mapped to PatrimVen codes" but doesn't define the code mappings. ANAF uses specific numeric codes (e.g., 1=residential, 2=non-residential). A lookup table `patrimven_code_mappings` is needed.

3. **XSD validation** — The doc mentions "validates against ANAF XSD schema" as an acceptance criterion but there's no XSD referenced or included. Need to obtain and version the actual XSD files.

4. **Digital certificate handling** — PatrimVen upload requires qualified electronic signature. The architecture mentions Puppeteer for PDF but nothing about PKCS#11 or PKCS#12 certificate integration for XML signing.

5. **Missing forms** — PatrimVen has more than 3 forms. At minimum, also consider F3003 (other local taxes), and the bidirectional flow (receiving data FROM ANAF about taxpayer assets).

### 🔧 Recommendations

- Create `patrimven_code_mappings` table mapping internal values → ANAF codes
- Store XSD files in the repo (`/schemas/patrimven/`)
- Integrate a signing library (e.g., `xml-crypto` for Node.js) for XML digital signatures
- Plan for receiving ANAF data (not just sending) — this is how PatrimVen helps communes discover undeclared assets

**Severity: MEDIUM** — The mapping exists conceptually but implementation will hit blockers on address parsing and code mappings without the lookup tables.

---

## 4. Scalability

### ✅ Strengths
- PostgreSQL RLS — proven pattern for multi-tenant up to ~1000 tenants
- Shared database approach — operationally simpler, correct choice for this market
- Redis + BullMQ for async jobs
- Kubernetes deployment planned

### ⚠️ Concerns

1. **Shared DB is the right call** for 100+ tenants of similar size. But add connection pooling (PgBouncer) — not mentioned. With 100 tenants × 5 concurrent connections = 500 connections, PostgreSQL will struggle without a pooler.

2. **Audit logs will grow fast** — The partitioning comment is there but not implemented. For 100 tenants, each with 5,000 taxpayers, each with ~10 CRUD operations/year = 5M rows/year. **Partition by month from day one.**

3. **Mass document generation** — 1,000 decisions in <10 min is the target. With Puppeteer PDF generation (spawns a headless Chrome per render), this will be slow. Consider `@react-pdf/renderer` (pure Node, no browser) for simple templates, Puppeteer only for complex layouts. Or use a PDF worker pool.

4. **No read replicas mentioned** — For reporting-heavy workloads (400+ report types), a read replica would prevent reporting queries from impacting CRUD operations.

5. **MinIO single instance** — No HA/replication mentioned for document storage. A single MinIO instance is a SPOF.

### 🔧 Recommendations

```yaml
# Add to docker-compose.yml
pgbouncer:
  image: edoburu/pgbouncer
  environment:
    DATABASE_URL: postgres://user:pass@postgres:5432/primaria
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 50
```

- Add PgBouncer from day one
- Partition `audit_logs` and `notificari` by month
- Use `@react-pdf/renderer` for document generation (no headless Chrome overhead)
- Plan for a read replica at 50+ tenants

**Severity: MEDIUM** — Will work fine for initial 10 tenants, but needs tuning before 100+.

---

## 5. i18n Readiness

### ✅ Strengths
- RO + HU + EN as launch languages — correct decision for Transylvania market
- `next-intl` with ICU message format — good choice
- Locale detection middleware

### ⚠️ Gaps

1. **PDF documents in multiple languages** — Legal documents (decizii de impunere) MUST be in Romanian by law. But the citizen portal should show documents in their preferred language for informational copies. The template system only shows Romanian templates. Need dual-language templates: official (RO) + informational (HU/EN).

2. **Database content i18n** — The architecture mentions `_ro/_en suffixes or JSONB {ro: "...", en: "..."}` but doesn't commit to one approach. **Pick JSONB** — it's more flexible and avoids column explosion. Define a convention:

```typescript
// All translatable fields use this pattern:
type Translatable = { ro: string; en?: string; hu?: string };
// Example: scutiri_reguli.name = { ro: "Scutire veterani", hu: "Veterán mentesség", en: "Veteran exemption" }
```

3. **Error messages** — Server-side validation errors need i18n too. Zod schemas return English errors by default. Need `zod-i18n-map` or custom error maps for RO/HU.

4. **Notification templates** — Must be in the citizen's preferred language, not the tenant's default. The notification system doesn't show per-citizen language preference storage.

5. **Number/date formatting** — Hungarian uses different date format (`2026. február 12.`) vs Romanian (`12.02.2026`). The architecture mentions Romanian locale but not per-user locale formatting.

### 🔧 Recommendations

- Add `limba_preferata VARCHAR(2) DEFAULT 'ro'` to both `tenant_users` and `contribuabili` tables
- Use JSONB for all translatable database content
- Add `zod-i18n-map` for validation error translation
- Create notification templates in all 3 languages
- For PDF: always generate official RO version + optional translated informational version

**Severity: MEDIUM** — The foundation is there but needs completion for HU to be truly usable at launch.

---

## 6. Migration Strategy

### ✅ Strengths
- Staging table approach with `import_staging` — correct pattern
- Validation before import (CNP checksum, CUI verification)
- Error reporting per row
- Common mapping table provided

### ⚠️ Gaps

1. **No rollback mechanism** — If an import of 2,000 records partially fails, how do you undo? Need `import_batches` table with status and ability to delete all records from a batch.

2. **Opening balances are tricky** — Importing `suma_datorata` as a lump sum loses the history. You need to know: which fiscal years are the debts from? What penalties have accrued? The staging table maps `Sold restant → impozite.suma_datorata` but doesn't capture the year breakdown.

3. **Deduplication across imports** — What if the same taxpayer is imported twice? Or already exists from a prior import? Need upsert logic keyed on CNP/CUI + tenant_id.

4. **No field mapping UI** — Different communes use different Excel column headers. A column-mapping UI (like a CSV import wizard) would be much more practical than fixed mappings.

5. **Attachment import** — Communes have scanned documents (property deeds, exemption certificates). No strategy for bulk document import.

### 🔧 Recommendations

```sql
CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    filename VARCHAR(255),
    entity_type VARCHAR(50),
    total_rows INTEGER,
    valid_rows INTEGER,
    imported_rows INTEGER,
    error_rows INTEGER,
    status VARCHAR(20) DEFAULT 'uploading', -- uploading, validating, validated, importing, completed, rolled_back
    imported_by UUID REFERENCES tenant_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

- Add batch tracking with rollback capability
- Build a column-mapping wizard UI
- For opening balances, require at minimum: fiscal year + tax type + amount owed
- Implement upsert on CNP/CUI for repeat imports

**Severity: MEDIUM** — The staging table is a good start but migration is a make-or-break feature for onboarding. It needs to be bulletproof.

---

## 7. Offline/Low-Connectivity

### ✅ Mentioned
- PWA listed as P2 feature (Phase 5)

### ❌ Insufficient

Small communes in rural Maramureș regularly have:
- Intermittent internet (ADSL or mobile data)
- Power outages (winter storms)
- Shared computer for the entire office

PWA at P2 is too late. At minimum, the **staff UI** needs:

1. **Optimistic UI with offline queue** — Record a payment offline → syncs when connection returns. This is critical for the accountant who collects cash payments.

2. **Service worker for caching** — Cache the most-used pages (taxpayer search, payment form) so they load even with flaky internet.

3. **Local storage for draft data** — If the secretary is filling out a property form and the internet drops, the data shouldn't be lost.

4. **Graceful degradation** — Show clear "offline mode" indicator, queue actions, sync when back.

### 🔧 Recommendations

- Move basic PWA/service worker to **Phase 1** (just caching + offline indicator)
- Add offline payment recording to **Phase 2** (most critical offline workflow)
- Use TanStack Query's built-in offline mutation support
- Consider IndexedDB for local taxpayer search cache (most-recent 100 taxpayers)

**Severity: HIGH** — This is a showstopper for rural communes. If the system is unusable during internet outages, they'll go back to Excel.

---

## 8. Implementation Timeline

### Assessment: 20 weeks is **aggressive but feasible** for MVP with caveats

**Critical path:**
```
Phase 1 (Foundation) → Phase 2 (Tax Engine) → Phase 3 (Documents/PatrimVen)
                                                        ↓
                                                   MVP at Week 12
```

### Bottlenecks

1. **Tax engine complexity (Phase 2)** — 4 weeks for 11 tax types + exemptions + penalties + payments + import is extremely tight for 1-2 developers. The tax calculation edge cases alone (partial year, vehicle brackets, building age coefficients) could consume 2 weeks.

   **Recommendation:** Prioritize the 3 most common tax types for MVP (buildings, land, vehicles) and defer taxa firmă/hotelieră/spectacole to post-MVP. This removes the need for 3 missing entity tables.

2. **PatrimVen XML (Phase 3)** — Without the actual XSD files and a test environment, development is blind. ANAF documentation is notoriously sparse.

   **Recommendation:** Start ANAF liaison in Week 1. Obtain XSD files and sample XMLs from an existing commune that uses PatrimVen.

3. **Phase 4 has too many external dependencies** — Ghișeul.ro API access, ROeID integration, WhatsApp Business approval, e-Factura — all require external parties. Any one of these can slip by months.

   **Recommendation:** Mock all external integrations. Ship Phase 4 with mock Ghișeul.ro and email-only notifications. Add real integrations as they become available.

4. **Phase 5 (AI + Polish + Security Audit + Pilot)** in 4 weeks is unrealistic if Phase 4 slips at all.

   **Recommendation:** Drop AI chatbot and anomaly detection from initial release. Move security audit to an ongoing process starting Phase 3.

### Revised realistic timeline

| Phase | Weeks | Adjusted Scope |
|-------|-------|---------------|
| 1. Foundation | 1–4 | As planned (solid) |
| 2. Tax Engine | 5–10 | **6 weeks** — buildings, land, vehicles only. Others post-MVP |
| 3. Documents + PatrimVen | 11–14 | **4 weeks** — as planned |
| 4. Citizen Portal (light) | 15–18 | **4 weeks** — email notifications only, mock Ghișeul.ro |
| 5. Polish + Pilot | 19–22 | **4 weeks** — security, performance, pilot deployment |

**Total: 22 weeks** for a production-worthy MVP. Original 20 is possible if Phase 2 scope is ruthlessly cut.

**Severity: MEDIUM** — Achievable with discipline, but no room for scope creep.

---

## 9. Missing Features (vs. Competitors)

Compared to Impotax (Indeco Soft) and Avansis (Integrisoft):

| Feature | Impotax/Avansis | PrimărIA PRD | Gap |
|---------|----------------|-------------|-----|
| **400+ report types** | ✅ Full suite | ❌ "Basic" + "Advanced" (P1) | HIGH — Curtea de Conturi requires specific report formats |
| **Registru agricol** | ✅ Some offer it | ❌ Not mentioned | MEDIUM — Often bundled with tax software |
| **Stare civilă** (civil status) | ✅ Sometimes bundled | ❌ Not in scope | LOW — different product |
| **Contabilitate bugetară** | ✅ Integrated | ❌ Only Forexebug export | MEDIUM — communes need full public accounting |
| **Impozit pe spectacole** management | ✅ | ❌ No entity | See §1 |
| **Control fiscal** (tax inspections) | ✅ | ❌ Not mentioned | MEDIUM — field inspectors need mobile tools |
| **Poprire/executare silită** | ✅ Full workflow | ⚠️ Listed as P1 | OK |
| **Certificate de urbanism** | ✅ Some offer | ❌ Not in scope | LOW — different domain |
| **Bonificație plată anticipată** | ✅ | ❌ Not in calculation | HIGH — legally required per Art. 462 |
| **Multiple receipt types** | ✅ (chitanțier, borderou) | ⚠️ Basic | MEDIUM |
| **Cross-commune transfers** | ✅ | ❌ Not mentioned | LOW — rare but exists |

### Critical missing: Bonificație (early payment discount)

Art. 462 Cod Fiscal: taxpayers who pay the entire annual tax by March 31 receive a 10% discount (or as set by HCL). This is a universally expected feature.

**Severity: HIGH** for bonificație; MEDIUM for reporting depth.

---

## 10. Reuse from hospitality-saas

### ✅ Directly Reusable (~30-40%)

| Component | hospitality-saas | PrimărIA | Reuse Level |
|-----------|-----------------|----------|-------------|
| **Multi-tenant RLS pattern** | PostgreSQL RLS + `SET LOCAL` | Same pattern | **95%** — copy-paste, change table names |
| **Auth + JWT** | Express + jsonwebtoken + bcrypt | NextAuth.js (different) | **20%** — pattern similar, implementation differs (Express→Next.js) |
| **Docker Compose** | PG16 + Redis + services | Same base | **80%** — remove qdrant/n8n, add MinIO |
| **BullMQ job processing** | ✅ Used for async tasks | Same pattern | **70%** — job runner, queue setup, worker pattern |
| **Tenant CRUD** | Express controllers | Next.js API routes | **30%** — business logic reusable, transport layer different |
| **Zod validation** | ✅ Used | Same library | **50%** — patterns reusable, schemas domain-specific |
| **Stripe billing** | ✅ Implemented | Could reuse for SaaS billing | **60%** — subscription management pattern |

### ❌ Must Rebuild

| Component | Why |
|-----------|-----|
| **Tax engine** | 100% domain-specific, no equivalent in hospitality |
| **Document generation** | PDF with Romanian fiscal format — nothing to reuse |
| **PatrimVen/Ghișeul.ro** | Government integrations — new |
| **i18n** | hospitality-saas has no i18n |
| **Frontend** | hospitality-saas is Express API-only (no frontend). PrimărIA needs full Next.js UI |
| **Data model** | Completely different domain entities |

### ⚠️ Stack Mismatch

**hospitality-saas uses Express.js**, PrimărIA plans **Next.js App Router**. This means:
- Backend patterns (controllers, middleware, routes) are **not copy-pasteable**
- Auth is completely different (custom JWT vs NextAuth.js)
- API structure differs (Express routes vs Next.js API routes/Server Actions)

The reuse is more at the **pattern and knowledge level** than code level. The RLS implementation, BullMQ patterns, and Docker setup are the most concrete reuse opportunities.

### 🔧 Recommendation

**Realistic reuse: ~25-30% of infrastructure code, 0% of business logic.**

Don't overestimate reuse. The biggest value from hospitality-saas is **proven patterns** (RLS works, BullMQ works, PG16 works) rather than actual code reuse. Budget the project as if building from scratch with a head start on architecture decisions.

---

## Summary: Top 10 Action Items

| # | Priority | Action | Phase |
|---|----------|--------|-------|
| 1 | 🔴 CRITICAL | Add bonificație (early payment discount) to tax calculation | Phase 2 |
| 2 | 🔴 CRITICAL | Add partial year proration for property acquisition/disposal | Phase 2 |
| 3 | 🔴 CRITICAL | Add structured address table for PatrimVen compliance | Phase 1 |
| 4 | 🔴 CRITICAL | Add basic offline/PWA support (service worker + offline queue) | Phase 1-2 |
| 5 | 🟡 HIGH | Add entities for taxa firmă, hotelieră, spectacole (or defer to post-MVP) | Phase 2 or post |
| 6 | 🟡 HIGH | Add penalties detail table for audit compliance | Phase 2 |
| 7 | 🟡 HIGH | Add building age coefficient to tax calculation | Phase 2 |
| 8 | 🟡 HIGH | Add PgBouncer to deployment stack | Phase 1 |
| 9 | 🟠 MEDIUM | Define exemption stacking policy | Phase 2 |
| 10 | 🟠 MEDIUM | Add import batch tracking with rollback | Phase 2 |

---

**Overall Assessment:** The architecture is well-thought-out and the documents are comprehensive for an initial design. The multi-tenant RLS approach, configurable tax engine concept, and technology choices are sound. The main risks are: (a) underestimating tax calculation complexity, (b) missing entities for 3 tax types, (c) rural connectivity challenges, and (d) PatrimVen integration requiring information that isn't yet available. With the adjustments above, this is a viable product architecture.
