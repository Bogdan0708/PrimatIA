# Romanian Software Audit - PrimărIA Insights

**Date:** 2026-02-13  
**Source:** `C:\Users\godja\Desktop\romanian software\` — 4 applications, ~5,400 files  
**Analyst:** Automated audit via OpenClaw

---

## Executive Summary

The analyzed codebase consists of **four compiled Delphi/Pascal desktop applications** from a Romanian company (PFA Szász Alpár Software) targeting local government administration:

| Application | Purpose | Key Files |
|---|---|---|
| **Update_ItAS** | Local taxes & fees (Impozite și Taxe) | Tax configs, receipts, patrimony reports |
| **Update_ContAS** | Public sector accounting (Contabilitate) | Budgets, salaries, financial statements |
| **Update_AgrAS** | Agricultural registry (Registru Agricol) | Land/crop certificates, APIA reports |
| **Update_Ajutoare_Asistenta** | Social assistance | Benefits, social aid management |

**Critical finding:** These are **compiled binaries** (no source code available). However, the configuration files, report templates (.fr3), database schemas (.dbf), and data structures provide **extremely valuable domain knowledge** for PrimărIA.

### Top Insights for PrimărIA

1. **Complete Romanian tax calculation tables** extracted from config files — building, land, and vehicle taxes with exact rates
2. **Official document templates** (chitanțe, certificate fiscale, somații, titluri executorii) — all the forms primării actually use
3. **Data model patterns** — how taxpayer records (ROL, CNP/CIF, PF/PJ) are structured
4. **Romanian number-to-words algorithm** — proven PascalScript implementation for receipts
5. **ANAF PatrimVen integration** — XML/PDF export for national tax authority

---

## Reusable Components Matrix

### 🟢 Directly Reusable (Extract & Adapt)

| Component | Source | PrimărIA Use |
|---|---|---|
| Vehicle tax rate tables | `ConfigFormular_PF_AUTO_*.txt` | Tax engine lookup tables |
| Building tax coefficients | `ConfigFormular_PF_CLADIRI_*.txt` | Building tax calculator |
| Land tax rates (intravilan/extravilan) | `ConfigFormular_PF_TEREN_*.txt` | Land tax calculator |
| Heavy vehicle axle-weight tables | Auto config files | Vehicle tax for trucks/trailers |
| Romanian number-to-words | Chitanta FR3 ScriptText | Receipt generation |
| Address field structure | FR3 report data bindings | Taxpayer form design |
| Budget classification codes | ContAS Sabloane | Budget reporting |

### 🟡 Adapt for Modern Stack

| Component | Source | Adaptation Needed |
|---|---|---|
| Receipt (chitanță) layout | `Rapoarte/Chitante/*.fr3` | Convert FastReport → PDF template |
| Certificate fiscal layout | `Casierie_PF/*.fr3` | Convert to HTML/PDF generation |
| Somație/Titlu executoriu | `Casierie_PF/*.fr3` | Legal enforcement documents |
| Decizie de impunere | `Casierie_PF/*.fr3` | Tax assessment notice |
| Agricultural certificates | `AgrAS/Rapoarte/*.fr3` | APIA integration templates |
| Budget execution reports | `ContAS/Rapoarte/*.fr3` | Financial reporting |

### 🔵 Domain Inspiration

| Pattern | Insight | PrimărIA Application |
|---|---|---|
| PF/PJ separation | Every module splits Persoane Fizice/Juridice | Dual taxpayer entity model |
| ROL (Rol Nominal Unic) | Unique taxpayer roll number | Primary key strategy |
| Year-versioned configs | Tax rates change annually | Configuration versioning system |
| Matricola reports | Tax registry by category | Dashboard/reporting structure |
| Patrimoniu views | Property portfolio per taxpayer | Citizen portal design |

---

## Technical Patterns Analysis

### Architecture Insights

**1. Technology Stack (Legacy)**
- **Language:** Delphi/Object Pascal (compiled .exe/.dll)
- **Reporting:** FastReport 4.x (.fr3 XML templates)
- **Database:** DBF (dBASE/FoxPro format) with CDX indexes
- **UI:** Windows-native with custom skins (.asz files)
- **Integration:** Java 6 (JRE bundled) for ANAF PatrimVen XML/PDF export

**2. Project Organization Pattern**
```
Application/
├── App.exe                    # Main executable
├── Dll/                       # Shared libraries
├── Griduri/                   # Grid layout definitions (.grd)
├── Rapoarte/                  # Report templates (.fr3)
│   ├── Chitante/              # Receipts
│   ├── Casierie_PF/           # Cash desk - individuals
│   ├── Casierie_PJ/           # Cash desk - legal entities
│   ├── Matricola/             # Tax registries
│   ├── Patrimoniu/            # Property reports
│   ├── BorderouIncasari/      # Collection bordereau
│   └── ...
├── Configurare Formulare/     # Tax rate configurations
│   └── Import/
│       ├── Autoturisme/       # Vehicle configs
│       ├── Cladiri_PF/        # Building tax - individuals
│       ├── Cladiri_PJ/        # Building tax - legal entities
│       ├── Teren_Intra_Extra/ # Land tax configs
│       ├── TaxaFirma/         # Business tax
│       ├── AlteTaxe/          # Other taxes
│       └── Casierie/          # Cash desk config
├── Help/                      # Documentation (PDF)
├── Rtf/                       # RTF templates
├── Skins/                     # UI themes
└── Update/                    # Update packages
```

**PrimărIA Takeaway:** Mirror the report/config organization. Separate configs by tax type, reports by entity type (PF/PJ), and year-version everything.

### Data Model Patterns

**3. Taxpayer Identification**
From the FR3 templates, the core taxpayer fields are:

```
DateIdentificare:
  - Contribuabil_ROL          # Unique roll number
  - Contribuabil_CNP_CIF      # CNP (individuals) or CIF (companies)
  - Contribuabil_Nume          # Last name
  - Contribuabil_Initiala      # Middle initial
  - Contribuabil_Prenume       # First name
  - Contribuabil_FIRMA         # Company name (PJ only)
  - Contribuabil_Localitate    # City/town
  - Contribuabil_Sat           # Village
  - Contribuabil_Strada        # Street
  - Contribuabil_Numar         # Number
  - Contribuabil_Bloc          # Building block
  - Contribuabil_Scara         # Staircase
  - Contribuabil_Etaj          # Floor
  - Contribuabil_Apartament    # Apartment
  - Serie Chitanta             # Receipt series
  - Numar Chitanta             # Receipt number
  - Chitanta Anulata           # Voided flag
  - Copie Chitanta             # Copy flag
  - DecimalSeparator           # Locale-aware
  - Cod Fiscal                 # Institution's fiscal code
  - Judet                      # County
  - Unitate                    # Administrative unit name
  - Localitate                 # Institution locality
  - Telefon                    # Phone
```

**Receipt (Chitanță) line items:**
```
Chitanta:
  - Denumire - Linia N         # Tax name (up to 10 lines)
  - Cod - Linia N              # Budget classification code
  - Debit Cumulat - Linia N    # Current principal
  - RESTANTE - Linia N         # Overdue principal
  - Dobanzi - Linia N          # Interest/penalties
  - Total - Linia N            # Line total
  - TOTAL - Bonificatii        # Early payment discount
```

**4. Romanian Address Structure**
The canonical Romanian address for PrimărIA should support:
```typescript
interface RomanianAddress {
  judet: string;          // County
  localitate: string;     // City/Town
  sat?: string;           // Village (rural)
  strada?: string;        // Street
  numar?: string;         // Street number
  bloc?: string;          // Block (apartment buildings)
  scara?: string;         // Staircase
  etaj?: string;          // Floor
  apartament?: string;    // Apartment
  codPostal?: string;     // Postal code
}
```

---

## Romanian Tax Domain Knowledge

### Building Tax (Impozit pe Clădiri)

**PF (Individuals) Config Structure** (from `ConfigFormular_PF_CLADIRI_2010.txt`):
- Base rates per sqm: 806 lei (residential frame), 478 lei (annex), etc.
- Construction year bands affect rate: pre-1957, 1958-1977, etc.
- Depreciation coefficients by age bracket (2.5x down to 0.9x)
- Zone correction multipliers (urban rank A-D)
- Building material type affects base rate

**PJ (Legal Entities)** Config:
- Assessment based on accounting value (valoare de inventar)
- Date-bounded rates (between date ranges)
- Multiplier of 1.5% standard rate
- Land tax under buildings calculated separately

### Land Tax (Impozit pe Teren)

**Categories** (intravilan + extravilan):
1. Cu construcții (with buildings)
2. Arabil (arable)
3. Pășune (pasture)
4. Fânețe (meadows)
5. Vii (vineyards)
6. Livezi (orchards)
7. Păduri (forests)
8. Cu ape (water bodies)
9. Drumuri și căi ferate (roads/railways)
10. Neproductiv (unproductive)
11. Amenajări piscicole (fish farms)

Each category has rates by **4 zones** (urban ranking), and separate intravilan/extravilan rates.

**Zone correction multipliers** follow the same pattern as buildings (2.5x, 2.4x, 2.3x... down to 0.9x).

### Vehicle Tax (Impozit pe Mijloace de Transport)

**Comprehensive rate table** covering:
- **Cars** by engine capacity: <1600cc, 1600-2000, 2000-2600, 2600-3000, >3000
- **Buses, minibuses**
- **Trucks** by axle configuration and weight (C2, C3, C4, C2+1, C2+2, C2+3, C3+2, C3+3)
  - Each with **pneumatic (P)** and **other suspension** variants
  - Weight ranges in tonnes with step-based rates
- **Trailers** by weight: ≤1t, 1-3t, 3-5t, >5t
- **Tractors** (registered)
- **Motorcycles** (with/without sidecar, and sidecar alone)
- Rate type 30 = per unit × cc, type 31 = per unit × tonnes

**Config format:** `##flag##code##description##rateType##calcMethod##fixedRate##variableRate##maxAge##ccMin##ccMax##tonsMin##tonsMax##extra##`

### ANAF Integration (PatrimVen)

The `_DUKIntegrator_PatrimVen` component reveals:
- **URL:** `http://static.anaf.ro/static/10/Anaf/update5/versiuni.xml`
- **Declaration type:** P2000 (patrimony/income)
- **D112** declaration support (social contributions)
- **Smart card** authentication (`defSmartCard=*autoDetect`)
- **Output:** XML + PDF to configurable folder
- **Java-based** with bundled JRE6

### Budget Classification (Clasificația Bugetară)

ContAS reveals extensive budget structure:
- **Venituri** (Revenue) classification codes
- **Cheltuieli** (Expenditure) by functional/economic
- **DDS** (Darea de seamă) quarterly financial reports
- **FOREXEBUG** integration (national budget execution system)
- **Situații Financiare** (Financial statements) with 15+ annexes
- **D112** salary declarations
- **L153** salary law compliance
- **M500** statistical reports

---

## Technology Recommendations for PrimărIA

### What to Replicate (Domain Logic)

1. **Tax calculation engine** — Port the exact rate tables and coefficient logic
2. **Document generation** — Recreate all FR3 report layouts as modern PDF templates
3. **Taxpayer data model** — Use the proven field structure with ROL as primary key
4. **PF/PJ dual-track** — Every feature needs individual vs. legal entity variants
5. **Year-versioned configurations** — Tax rates MUST be versioned by fiscal year

### What to Modernize

| Legacy Pattern | Modern Replacement |
|---|---|
| DBF files | PostgreSQL with proper schema |
| FastReport (.fr3) | PDF generation (puppeteer/pdfkit) or Jasper |
| Delphi desktop app | Web app (React/Next.js) |
| Java 6 PatrimVen bridge | Direct REST API to ANAF |
| Custom grid configs (.grd) | Standard data grid components |
| File-based updates | CI/CD with automatic migration |

### Missing in Legacy (PrimărIA Opportunities)

1. **Online citizen portal** — Legacy is desktop-only for officials
2. **Online payments** — No payment gateway integration
3. **Mobile access** — Not possible with Win32 apps
4. **Real-time dashboards** — Only batch reports
5. **Multi-primărie** — Each installation is standalone
6. **API integrations** — No REST/SOAP services
7. **Audit trail** — No visible change tracking
8. **Automated notifications** — No email/SMS to citizens

---

## Implementation Priorities

### Phase 1: Foundation (Immediate)
1. ✅ Port **vehicle tax rate tables** to database seed
2. ✅ Port **building tax coefficients** by year/zone/material
3. ✅ Port **land tax rates** with all 11 categories × 4 zones
4. ✅ Implement **Romanian address model** (județ → sat → bloc → ap)
5. ✅ Implement **ROL + CNP/CUI identification** system

### Phase 2: Documents (Week 2-3)
1. Recreate **Chitanță** (receipt) template with number-to-words
2. Recreate **Certificat Fiscal** (tax clearance certificate)
3. Recreate **Decizie de Impunere** (tax assessment notice)
4. Recreate **Somație** and **Titlu Executoriu** (enforcement docs)
5. Add **ANULAT** / **COPIE** watermark support

### Phase 3: Integration (Week 4+)
1. ANAF PatrimVen XML generation
2. D112 declaration export
3. Budget classification code system
4. FOREXEBUG compatibility layer

---

## Romanian Number-to-Words Algorithm

Extracted from Chitanță FR3, this proven Romanian algorithm handles:
- Units: zero, unu/una/un, doi/două, trei... nouă
- Teens: unsprezece... nouăsprezece  
- Tens: douăzeci, treizeci...
- Hundreds: o sută, două sute, N sute
- Thousands: o mie, N mii
- Millions: un milion, N milioane
- Billions: un miliard, N miliarde
- Gender agreement: feminine for "mii" (una mie), masculine for "milioane"
- Special case: "douămii" concatenation fix

**Port this to TypeScript** for receipt generation.

---

## Key Observations

1. **This software is the de facto standard** in Romanian primării — understanding its conventions means understanding what officials expect
2. **Config file format** (`##field##` delimited with `^^` as decimal separator) is simple but effective — consider YAML/JSON equivalents
3. **Report volume is enormous** — 155 FR3 templates in ItAS alone, covering every conceivable local government document
4. **The software vendor (PFA Szász Alpár)** has been updating continuously since at least 2007 through 2025, showing long-term market presence
5. **APIA integration** (agricultural payments agency) is a separate concern but important for rural primării
6. **Social assistance module** suggests primării need integrated solutions beyond just taxes

---

## File Inventory Summary

| Type | Count | Description |
|---|---|---|
| .fr3 | 1,341 | FastReport templates (XML-based) |
| .txt | 1,973 | Configuration/data files |
| .pdf | 748 | Help docs, legal references |
| .asz | 178 | Skin/UI theme files |
| .dbf/.DBF | 137 | dBASE database files |
| .SDef | 78 | Schema definitions |
| .rtf | 68 | Rich text templates |
| .dll | 65 | Shared libraries |
| .grd | 51 | Grid layout files |
| .cdx/.CDX | 75 | Database indexes |
| .jar | 32 | Java archives (ANAF integration) |
| .exe | 26 | Executables |
| .zip | 102 | Update packages |
| .properties | 23 | Java config files |

**Total: ~5,412 files across 4 applications**
