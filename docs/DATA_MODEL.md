# PrimărIA — Detailed Database Schema

**Version**: 1.0  
**Date**: 2026-02-12  
**Engine**: PostgreSQL 16 with Row-Level Security  

---

## 1. Schema Overview

```
tenants ─────────┬──── tenant_users
                 ├──── contribuabili ──── proprietati_cladiri
                 │                   ├─── proprietati_terenuri
                 │                   ├─── proprietati_vehicule
                 │                   ├─── scutiri_contribuabil
                 │                   ├─── impozite ──── plati_distributie
                 │                   └─── documente
                 ├──── hcl_decisions ──── tax_rate_tables
                 ├──── scutiri_reguli (exemption rules)
                 ├──── plati
                 ├──── somatii
                 ├──── notificari
                 └──── audit_logs
```

---

## 2. Core Tables

### 2.1 tenants (Primării)

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,                    -- "Primăria Comunei Bogdan Vodă"
    slug VARCHAR(100) NOT NULL UNIQUE,             -- "bogdan-voda"
    cui VARCHAR(20),                               -- CUI fiscal
    siruta_code VARCHAR(10),                       -- SIRUTA code (unique commune identifier)
    county VARCHAR(50) NOT NULL,                   -- "Maramureș"
    commune_type VARCHAR(20) NOT NULL DEFAULT 'comuna', -- comuna, oras, municipiu
    commune_rank INTEGER NOT NULL DEFAULT 5,       -- Rang 0-V (for tax rate lookup)
    population INTEGER,
    zone_count INTEGER NOT NULL DEFAULT 4,         -- A, B, C, D zones
    
    -- Contact
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    website VARCHAR(255),
    
    -- Branding
    logo_url VARCHAR(500),
    header_text TEXT,                               -- Custom document header
    
    -- Subscription
    tier VARCHAR(20) NOT NULL DEFAULT 'comuna',     -- comuna, oras, municipiu
    status VARCHAR(20) NOT NULL DEFAULT 'trial',    -- trial, active, suspended, cancelled
    subscription_start DATE,
    subscription_end DATE,
    
    -- Settings
    settings JSONB NOT NULL DEFAULT '{}',           -- locale, timezone, notification preferences
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_tenants_siruta ON tenants(siruta_code) WHERE deleted_at IS NULL;
```

### 2.2 tenant_users

```sql
CREATE TABLE tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'operator',  -- super_admin, admin, operator, contabil, cetatean
    phone VARCHAR(50),
    cnp VARCHAR(13),                                -- For citizen accounts
    limba_preferata VARCHAR(2) DEFAULT 'ro',        -- ro, hu, en [UPDATED per review]
    
    -- Auth
    is_active BOOLEAN NOT NULL DEFAULT true,
    totp_secret VARCHAR(100),                       -- 2FA
    last_login_at TIMESTAMPTZ,
    login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, email)
);

ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_users FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);
CREATE INDEX idx_tenant_users_active ON tenant_users(tenant_id) WHERE deleted_at IS NULL;
```

### 2.3 contribuabili (Taxpayers)

```sql
CREATE TABLE contribuabili (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identity
    tip VARCHAR(2) NOT NULL,                        -- 'PF' (persoană fizică) / 'PJ' (persoană juridică)
    cnp BYTEA,                                       -- CNP for PF (app-level AES-256-GCM encrypted) [UPDATED per review]
    cnp_hash VARCHAR(64),                            -- SHA-256 hash for lookup (per-tenant salt) [UPDATED per review]
    cui VARCHAR(20),                                -- CUI for PJ
    nume VARCHAR(255) NOT NULL,                     -- Full name / Company name
    prenume VARCHAR(255),                           -- First name (PF only)
    
    -- Contact [UPDATED per review: addresses now FK to adrese table]
    adresa_domiciliu_id UUID REFERENCES adrese(id), -- Domicile address
    adresa_corespondenta_id UUID REFERENCES adrese(id), -- Correspondence address (if different)
    telefon VARCHAR(50),
    email VARCHAR(255),
    
    -- PJ-specific
    reprezentant_legal VARCHAR(255),                -- Legal representative
    nr_registru_comert VARCHAR(50),                 -- Trade registry number
    
    -- Fiscal
    cod_rol VARCHAR(50),                            -- Rol number (legacy identifier)
    nr_dosar_fiscal VARCHAR(50),                    -- Fiscal file number
    data_inregistrare DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Status
    limba_preferata VARCHAR(2) DEFAULT 'ro',          -- ro, hu, en — notification language [UPDATED per review]
    status VARCHAR(20) NOT NULL DEFAULT 'activ',    -- activ, inactiv, decedat, radiat
    note TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE contribuabili ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contribuabili FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

-- [UPDATED per review] CNP is encrypted; use hash for lookup, remove from GIN
CREATE INDEX idx_contribuabili_cnp_hash ON contribuabili(tenant_id, cnp_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_contribuabili_cui ON contribuabili(tenant_id, cui) WHERE deleted_at IS NULL;
CREATE INDEX idx_contribuabili_nume ON contribuabili(tenant_id, nume, prenume) WHERE deleted_at IS NULL;
CREATE INDEX idx_contribuabili_search ON contribuabili USING gin(
    to_tsvector('romanian', coalesce(nume,'') || ' ' || coalesce(prenume,'') || ' ' || coalesce(cui,''))
) WHERE deleted_at IS NULL;
```

### 2.4 proprietati_cladiri (Buildings)

```sql
CREATE TABLE proprietati_cladiri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    
    -- Location [UPDATED per review: FK to adrese]
    adresa_id UUID NOT NULL REFERENCES adrese(id),
    zona VARCHAR(1) NOT NULL DEFAULT 'A',           -- A, B, C, D
    numar_cadastral VARCHAR(50),
    numar_carte_funciara VARCHAR(50),
    
    -- Building characteristics (per Art. 457-459)
    destinatie VARCHAR(20) NOT NULL,                 -- rezidentiala, nerezidentiala, mixta
    tip_constructie VARCHAR(50) NOT NULL,            -- 'cadre_beton', 'pereti_caramida', 'lemn', etc.
    an_constructie INTEGER NOT NULL,
    suprafata_construita DECIMAL(12,2) NOT NULL,     -- mp (square meters)
    suprafata_utila DECIMAL(12,2),
    suprafata_desfasurata DECIMAL(12,2),
    nr_etaje INTEGER NOT NULL DEFAULT 1,
    
    -- Valuation
    valoare_impozabila DECIMAL(15,2),               -- Calculated taxable value
    valoare_inventar DECIMAL(15,2),                  -- For PJ: accounting value
    
    -- Mixed building specifics (Art. 459)
    suprafata_rezidentiala DECIMAL(12,2),
    suprafata_nerezidentiala DECIMAL(12,2),
    
    -- Ownership
    cota_parte DECIMAL(5,2) NOT NULL DEFAULT 100.00, -- Ownership percentage
    nr_proprietari INTEGER NOT NULL DEFAULT 1,
    tip_act_proprietate VARCHAR(50),                  -- contract_vanzare, mostenire, donatie, etc.
    nr_act_proprietate VARCHAR(50),
    data_act_proprietate DATE,
    
    -- Status
    data_dobandire DATE NOT NULL,
    data_instrainare DATE,                           -- Date sold/transferred
    status VARCHAR(20) NOT NULL DEFAULT 'activ',     -- activ, instrainat, demolat
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE proprietati_cladiri ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON proprietati_cladiri FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE INDEX idx_cladiri_contribuabil ON proprietati_cladiri(tenant_id, contribuabil_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cladiri_zona ON proprietati_cladiri(tenant_id, zona, destinatie) WHERE deleted_at IS NULL;
```

### 2.5 proprietati_terenuri (Land)

```sql
CREATE TABLE proprietati_terenuri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    
    -- Location [UPDATED per review: FK to adrese]
    adresa_id UUID REFERENCES adrese(id),
    zona VARCHAR(1) NOT NULL DEFAULT 'A',
    numar_cadastral VARCHAR(50),
    numar_carte_funciara VARCHAR(50),
    
    -- Land characteristics (per Art. 465)
    categorie VARCHAR(30) NOT NULL,                  -- intravilan_curti, intravilan_arabil, extravilan_arabil, etc.
    suprafata_mp DECIMAL(12,2) NOT NULL,             -- Square meters
    suprafata_ha DECIMAL(10,4),                      -- Hectares (for agricultural)
    
    -- Ownership
    cota_parte DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    tip_act_proprietate VARCHAR(50),
    nr_act_proprietate VARCHAR(50),
    data_act_proprietate DATE,
    
    data_dobandire DATE NOT NULL,
    data_instrainare DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'activ',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE proprietati_terenuri ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON proprietati_terenuri FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE INDEX idx_terenuri_contribuabil ON proprietati_terenuri(tenant_id, contribuabil_id) WHERE deleted_at IS NULL;
```

### 2.6 proprietati_vehicule (Vehicles)

```sql
CREATE TABLE proprietati_vehicule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    
    -- Vehicle identification
    numar_inmatriculare VARCHAR(20),
    serie_sasiu VARCHAR(50),                         -- VIN
    nr_carte_identitate VARCHAR(50),                 -- Vehicle identity card
    
    -- Vehicle characteristics (per Art. 470)
    tip_vehicul VARCHAR(30) NOT NULL,                -- autoturism, autobuz, camion, motocicleta, etc.
    marca VARCHAR(100),
    model VARCHAR(100),
    an_fabricatie INTEGER NOT NULL,
    cilindree_cmc INTEGER,                           -- Engine displacement (cm³)
    putere_kw DECIMAL(8,2),                          -- Power in kW
    masa_totala_kg INTEGER,                          -- For trucks: total authorized mass
    nr_locuri INTEGER,                               -- For buses
    norma_poluare VARCHAR(10),                       -- Euro 1-6, non-Euro
    tip_combustibil VARCHAR(20),                     -- benzina, motorina, electric, hybrid, GPL
    
    -- Ownership
    data_dobandire DATE NOT NULL,
    data_instrainare DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'activ',     -- activ, instrainat, radiat, casat
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE proprietati_vehicule ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON proprietati_vehicule FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE INDEX idx_vehicule_contribuabil ON proprietati_vehicule(tenant_id, contribuabil_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicule_nr ON proprietati_vehicule(tenant_id, numar_inmatriculare) WHERE deleted_at IS NULL;
```

---

## 3. Tax & Financial Tables

### 3.1 hcl_decisions (Council Decisions)

```sql
CREATE TABLE hcl_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    hcl_number VARCHAR(20) NOT NULL,                 -- "45/2025"
    hcl_date DATE NOT NULL,
    fiscal_year INTEGER NOT NULL,
    title TEXT,                                       -- "Privind stabilirea impozitelor și taxelor locale pentru anul 2026"
    
    inflation_index DECIMAL(6,4),                    -- e.g., 1.073 for 7.3%
    valid_from DATE NOT NULL,
    valid_to DATE,
    
    status VARCHAR(20) NOT NULL DEFAULT 'draft',     -- draft, active, superseded
    approved_by VARCHAR(255),
    document_url VARCHAR(500),                       -- PDF of original HCL
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hcl_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hcl_decisions FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_hcl_fiscal_year ON hcl_decisions(tenant_id, fiscal_year, status);
```

### 3.2 tax_rate_tables (Rate Configuration)

```sql
CREATE TABLE tax_rate_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    hcl_decision_id UUID NOT NULL REFERENCES hcl_decisions(id),
    
    -- Tax identification
    tax_type VARCHAR(50) NOT NULL,                   -- impozit_cladiri_rezidentiale, impozit_teren_intravilan, etc.
    category VARCHAR(50),                            -- Sub-category (e.g., 'cadre_beton', 'arabil', 'autoturism_sub_1600')
    zona VARCHAR(1),                                 -- A, B, C, D (NULL if not zone-dependent)
    rang INTEGER,                                    -- 0-5 commune rank (NULL if not rank-dependent)
    
    -- Rate
    rate_type VARCHAR(10) NOT NULL DEFAULT 'percent', -- percent, fixed, per_unit
    rate_value DECIMAL(12,6) NOT NULL,               -- Rate value (percent or lei amount)
    unit VARCHAR(20),                                -- 'lei/mp', 'lei/ha', 'lei/200cmc', '%'
    
    -- Legal bounds
    min_rate DECIMAL(12,6),                          -- Legal minimum (from Cod Fiscal)
    max_rate DECIMAL(12,6),                          -- Legal maximum
    
    -- Metadata
    description_ro TEXT,
    legal_article VARCHAR(50),                       -- "Art. 457 alin. (2)"
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tax_rate_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tax_rate_tables FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_rate_tables_lookup ON tax_rate_tables(tenant_id, hcl_decision_id, tax_type, category, zona);
```

### 3.3 scutiri_reguli (Exemption Rules)

```sql
CREATE TABLE scutiri_reguli (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name_ro VARCHAR(255) NOT NULL,                   -- "Scutire veterani de război"
    name_en VARCHAR(255),
    legal_basis VARCHAR(100) NOT NULL,               -- "Art. 456 alin. (1) lit. a)"
    
    tax_types TEXT[] NOT NULL,                        -- Array of applicable tax types
    discount_percent DECIMAL(5,2) NOT NULL,          -- 100 = full exemption
    
    conditions JSONB NOT NULL DEFAULT '{}',          -- JSON rule conditions
    required_documents TEXT[],                        -- ["certificat_veteran", "copie_ci"]
    auto_renewable BOOLEAN NOT NULL DEFAULT false,
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_from DATE,
    valid_to DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scutiri_reguli ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON scutiri_reguli FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### 3.4 scutiri_contribuabil (Applied Exemptions)

```sql
CREATE TABLE scutiri_contribuabil (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    scutire_regula_id UUID NOT NULL REFERENCES scutiri_reguli(id),
    
    proprietate_type VARCHAR(20),                    -- cladire, teren, vehicul (NULL = all)
    proprietate_id UUID,                             -- Specific property (NULL = all of type)
    
    fiscal_year INTEGER NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    
    -- Documentation
    documente_verificate JSONB NOT NULL DEFAULT '[]', -- [{type, number, date, verified_by}]
    approved_by UUID REFERENCES tenant_users(id),
    approved_at TIMESTAMPTZ,
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending, approved, rejected, expired
    note TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scutiri_contribuabil ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON scutiri_contribuabil FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_scutiri_contribuabil ON scutiri_contribuabil(tenant_id, contribuabil_id, fiscal_year);
```

### 3.5 impozite (Tax Assessments)

```sql
CREATE TABLE impozite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    
    -- Tax details [UPDATED per review: FK to registry instead of enum/varchar]
    tax_type_id UUID NOT NULL REFERENCES tax_type_registry(id),
    fiscal_year INTEGER NOT NULL,
    
    -- Source property/asset
    proprietate_type VARCHAR(20),                    -- cladire, teren, vehicul
    proprietate_id UUID,
    
    -- Proration & discount [UPDATED per review]
    data_start_calcul DATE,                          -- Start date for partial year calculation
    data_stop_calcul DATE,                           -- End date (if applicable)
    nr_luni INTEGER NOT NULL DEFAULT 12,             -- Months taxable in fiscal year
    bonificatie DECIMAL(12,2) NOT NULL DEFAULT 0,    -- Early payment discount amount (Art. 462)
    
    -- Calculation
    hcl_decision_id UUID REFERENCES hcl_decisions(id),
    rate_table_id UUID REFERENCES tax_rate_tables(id),
    baza_impozabila DECIMAL(15,2) NOT NULL,         -- Tax base (value, area, etc.)
    rata_aplicata DECIMAL(12,6) NOT NULL,            -- Applied rate
    suma_calculata DECIMAL(12,2) NOT NULL,           -- Calculated amount (before exemptions)
    suma_scutire DECIMAL(12,2) NOT NULL DEFAULT 0,   -- Exemption amount
    suma_datorata DECIMAL(12,2) NOT NULL,            -- Final amount owed
    
    -- Installments (per Cod Fiscal: Mar 31 + Sep 30)
    rata_1 DECIMAL(12,2) NOT NULL,                   -- First installment
    rata_1_scadenta DATE NOT NULL,                   -- Mar 31
    rata_2 DECIMAL(12,2) NOT NULL,                   -- Second installment
    rata_2_scadenta DATE NOT NULL,                   -- Sep 30
    
    -- Payment tracking
    suma_platita DECIMAL(12,2) NOT NULL DEFAULT 0,
    suma_penalitati DECIMAL(12,2) NOT NULL DEFAULT 0,
    suma_restanta DECIMAL(12,2) GENERATED ALWAYS AS (suma_datorata + suma_penalitati - suma_platita) STORED,
    
    status VARCHAR(20) NOT NULL DEFAULT 'calculat',  -- calculat, emis, partial_platit, platit, executare
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE impozite ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON impozite FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_impozite_contribuabil ON impozite(tenant_id, contribuabil_id, fiscal_year);
CREATE INDEX idx_impozite_type_year ON impozite(tenant_id, tax_type, fiscal_year);
CREATE INDEX idx_impozite_restante ON impozite(tenant_id, fiscal_year) WHERE suma_restanta > 0;
```

### 3.6 plati (Payments)

```sql
CREATE TABLE plati (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    
    -- Payment details
    suma DECIMAL(12,2) NOT NULL,
    data_plata DATE NOT NULL,
    modalitate VARCHAR(30) NOT NULL,                 -- numerar, virament, mandat_postal, ghiseul_ro, card
    
    -- Reference
    nr_chitanta VARCHAR(50),                         -- Receipt number (cash)
    nr_document VARCHAR(50),                         -- Bank transfer reference
    ghiseul_ro_ref VARCHAR(100),                     -- Ghișeul.ro transaction ID
    
    -- Processing
    distribuit BOOLEAN NOT NULL DEFAULT false,       -- Has been distributed to debts
    nota TEXT,
    
    inregistrat_de UUID REFERENCES tenant_users(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plati ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON plati FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_plati_contribuabil ON plati(tenant_id, contribuabil_id, data_plata);
CREATE INDEX idx_plati_data ON plati(tenant_id, data_plata);
CREATE INDEX idx_plati_nedistribuite ON plati(tenant_id) WHERE distribuit = false;
```

### 3.7 plati_distributie (Payment Distribution)

```sql
CREATE TABLE plati_distributie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plata_id UUID NOT NULL REFERENCES plati(id),
    impozit_id UUID NOT NULL REFERENCES impozite(id),
    
    suma_debit DECIMAL(12,2) NOT NULL DEFAULT 0,     -- Applied to principal
    suma_penalitati DECIMAL(12,2) NOT NULL DEFAULT 0, -- Applied to penalties
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plati_distributie ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON plati_distributie FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

## 4. Document & Workflow Tables

### 4.1 documente (Generated Documents)

```sql
CREATE TABLE documente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID REFERENCES contribuabili(id),
    
    tip VARCHAR(50) NOT NULL,                        -- decizie_impunere, adeverinta_fiscala, certificat_atestare, somatie, titlu_executoriu
    numar_document VARCHAR(50) NOT NULL,             -- Document number (auto-generated, sequential per tenant/year)
    data_document DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Content
    template_id VARCHAR(100),                        -- Template used
    data_json JSONB NOT NULL,                        -- All data used to render the document
    
    -- Storage
    file_url VARCHAR(500),                           -- MinIO path to PDF
    file_size_bytes BIGINT,
    
    -- Signing
    semnat BOOLEAN NOT NULL DEFAULT false,
    semnat_de UUID REFERENCES tenant_users(id),
    semnat_la TIMESTAMPTZ,
    
    -- Related entities
    impozit_id UUID REFERENCES impozite(id),
    somatie_id UUID REFERENCES somatii(id),
    
    status VARCHAR(20) NOT NULL DEFAULT 'generat',   -- generat, semnat, trimis, anulat
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE documente ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON documente FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_documente_contribuabil ON documente(tenant_id, contribuabil_id, tip);
CREATE INDEX idx_documente_numar ON documente(tenant_id, numar_document);
```

### 4.2 somatii (Enforcement Actions)

```sql
CREATE TABLE somatii (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    
    -- Enforcement details
    tip VARCHAR(30) NOT NULL,                        -- somatie, titlu_executoriu, poprire
    numar VARCHAR(50) NOT NULL,
    data_emitere DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Amounts
    suma_debit DECIMAL(12,2) NOT NULL,
    suma_penalitati DECIMAL(12,2) NOT NULL DEFAULT 0,
    suma_totala DECIMAL(12,2) NOT NULL,
    
    -- Workflow
    termen_plata DATE NOT NULL,                      -- Payment deadline
    status VARCHAR(30) NOT NULL DEFAULT 'emis',      -- emis, comunicat, expirat, platit, executare
    
    -- Communication
    data_comunicare DATE,
    modalitate_comunicare VARCHAR(30),               -- posta, email, personal
    confirmare_primire BOOLEAN DEFAULT false,
    
    -- [UPDATED per review] Linked impozite moved to join table somatii_impozite
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- [UPDATED per review] Join table replaces UUID[] for referential integrity
CREATE TABLE somatii_impozite (
    somatie_id UUID NOT NULL REFERENCES somatii(id) ON DELETE CASCADE,
    impozit_id UUID NOT NULL REFERENCES impozite(id),
    PRIMARY KEY (somatie_id, impozit_id)
);

ALTER TABLE somatii ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON somatii FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_somatii_contribuabil ON somatii(tenant_id, contribuabil_id);
CREATE INDEX idx_somatii_status ON somatii(tenant_id, status, termen_plata);
```

### 4.3 notificari (Notifications)

```sql
CREATE TABLE notificari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID REFERENCES contribuabili(id),
    user_id UUID REFERENCES tenant_users(id),
    
    canal VARCHAR(20) NOT NULL,                      -- email, sms, whatsapp, telegram, in_app
    destinatar VARCHAR(255) NOT NULL,                -- Email/phone/chat_id
    
    subiect VARCHAR(500),
    continut TEXT NOT NULL,
    template_id VARCHAR(100),
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending, sent, delivered, failed
    provider_ref VARCHAR(200),                       -- External message ID
    error_message TEXT,
    
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notificari ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notificari FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_notificari_status ON notificari(tenant_id, status, created_at);
```

---

## 5. New Tables [UPDATED per review]

### 5.1 adrese (Structured Addresses)

```sql
CREATE TABLE adrese (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    strada VARCHAR(255),
    numar VARCHAR(20),
    bloc VARCHAR(20),
    scara VARCHAR(10),
    etaj VARCHAR(10),
    apartament VARCHAR(10),
    localitate VARCHAR(100) NOT NULL,
    judet VARCHAR(50) NOT NULL,
    cod_postal VARCHAR(10),
    zona_fiscala VARCHAR(1),                         -- A, B, C, D (for tax zone lookup)
    
    -- Full text for display/legacy
    adresa_completa TEXT GENERATED ALWAYS AS (
        coalesce(strada,'') || ' ' || coalesce(numar,'') || ', ' || localitate || ', ' || judet
    ) STORED,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE adrese ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON adrese FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### 5.2 zone_fiscale (Fiscal Zone Definitions)

```sql
CREATE TABLE zone_fiscale (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    zona VARCHAR(1) NOT NULL,                        -- A, B, C, D
    denumire VARCHAR(255),                           -- Zone name/description
    delimitare TEXT,                                  -- Boundary description
    hcl_decision_id UUID REFERENCES hcl_decisions(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, zona, hcl_decision_id)
);

ALTER TABLE zone_fiscale ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON zone_fiscale FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### 5.3 tax_type_registry (Configurable Tax Types)

```sql
CREATE TABLE tax_type_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,                -- 'impozit_cladiri_rezidentiale', etc.
    name JSONB NOT NULL,                             -- {"ro": "...", "en": "...", "hu": "..."}
    legal_basis VARCHAR(100),                        -- "Art. 457"
    category VARCHAR(30) NOT NULL,                   -- 'cladiri', 'teren', 'vehicule', 'alte_taxe'
    formula_type VARCHAR(30),                        -- 'percent', 'bracket', 'fixed', 'per_unit'
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with standard tax types from Cod Fiscal Title IX
```

### 5.4 consimtaminte (Consent Management)

```sql
CREATE TABLE consimtaminte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    
    canal VARCHAR(20) NOT NULL,                      -- email, sms, whatsapp, telegram
    consimtamant BOOLEAN NOT NULL DEFAULT false,
    data_acord TIMESTAMPTZ,
    data_retragere TIMESTAMPTZ,
    ip_address INET,
    sursa VARCHAR(50),                               -- 'portal', 'formular', 'operator'
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, contribuabil_id, canal)
);

ALTER TABLE consimtaminte ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON consimtaminte FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### 5.5 penalitati (Daily Penalty Accrual)

```sql
CREATE TABLE penalitati (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    impozit_id UUID NOT NULL REFERENCES impozite(id),
    
    data_calcul DATE NOT NULL,                       -- Day of accrual
    suma_restanta DECIMAL(12,2) NOT NULL,            -- Outstanding amount on that day
    rata_penalizare DECIMAL(8,6) NOT NULL,           -- Daily penalty rate
    suma_penalizare DECIMAL(12,2) NOT NULL,          -- Penalty amount for this day
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, impozit_id, data_calcul)
);

ALTER TABLE penalitati ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON penalitati FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_penalitati_impozit ON penalitati(tenant_id, impozit_id, data_calcul);
```

### 5.6 proprietati_detinatori (Co-ownership)

```sql
CREATE TABLE proprietati_detinatori (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    proprietate_type VARCHAR(20) NOT NULL,           -- cladire, teren, vehicul
    proprietate_id UUID NOT NULL,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    
    cota_parte DECIMAL(5,2) NOT NULL,                -- Ownership percentage
    valid_from DATE NOT NULL,
    valid_to DATE,                                   -- NULL = current owner
    
    tip_act VARCHAR(50),                             -- contract_vanzare, mostenire, etc.
    nr_act VARCHAR(50),
    data_act DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE proprietati_detinatori ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON proprietati_detinatori FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_detinatori_proprietate ON proprietati_detinatori(proprietate_type, proprietate_id);
CREATE INDEX idx_detinatori_contribuabil ON proprietati_detinatori(tenant_id, contribuabil_id);
```

### 5.7 import_batches (Import Batch Tracking)

```sql
CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    filename VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,                -- contribuabil, cladire, teren, vehicul, sold
    total_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending, processing, completed, failed, rolled_back
    rollback_at TIMESTAMPTZ,                         -- If rolled back
    rollback_by UUID REFERENCES tenant_users(id),
    error_log JSONB DEFAULT '[]',
    
    imported_by UUID REFERENCES tenant_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON import_batches FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### 5.8 Post-MVP Entity Tables

```sql
-- Taxa firmă (Art. 475) — post-MVP [UPDATED per review]
CREATE TABLE proprietati_firma (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    adresa_id UUID NOT NULL REFERENCES adrese(id),
    
    tip_activitate VARCHAR(100),
    suprafata_panou DECIMAL(8,2),                    -- For signage tax
    data_inceput DATE NOT NULL,
    data_sfarsit DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'activ',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Taxa hotelieră (Art. 478) — post-MVP
CREATE TABLE cazare_turistica (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    adresa_id UUID NOT NULL REFERENCES adrese(id),
    
    denumire VARCHAR(255),
    tip_unitate VARCHAR(50),                         -- hotel, pensiune, motel, etc.
    nr_locuri INTEGER,
    clasificare VARCHAR(10),                         -- stele/margarete
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Taxa spectacole (Art. 480) — post-MVP
CREATE TABLE spectacole (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contribuabil_id UUID NOT NULL REFERENCES contribuabili(id),
    
    denumire VARCHAR(255) NOT NULL,
    tip VARCHAR(50),                                 -- teatru, cinema, concert, sport, etc.
    data_spectacol DATE NOT NULL,
    incasari_brute DECIMAL(12,2),
    rata_taxa DECIMAL(5,2),                          -- Tax rate percentage
    suma_taxa DECIMAL(12,2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.9 patrimven_code_mappings

```sql
CREATE TABLE patrimven_code_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    entity_type VARCHAR(50) NOT NULL,                -- 'tip_constructie', 'categorie_teren', 'tip_vehicul'
    internal_code VARCHAR(50) NOT NULL,              -- PrimărIA internal code
    patrimven_code VARCHAR(50) NOT NULL,             -- PatrimVen/DUKIntegrator code
    description_ro VARCHAR(255),
    
    UNIQUE(entity_type, internal_code)
);
```

---

## 6. Audit & System Tables

### 5.1 audit_logs

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID,
    
    action VARCHAR(50) NOT NULL,                     -- create, update, delete, login, export, generate
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    
    old_values JSONB,
    new_values JSONB,
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- [UPDATED per review] INSERT + SELECT only — no UPDATE or DELETE permitted
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
-- No UPDATE or DELETE policies — audit logs are immutable

CREATE INDEX idx_audit_entity ON audit_logs(tenant_id, entity_type, entity_id, created_at);
CREATE INDEX idx_audit_user ON audit_logs(tenant_id, user_id, created_at);

-- Partition by month for performance (large table)
-- Consider: CREATE TABLE audit_logs (...) PARTITION BY RANGE (created_at);
```

### 5.2 export_jobs (Background Jobs)

```sql
CREATE TABLE export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    tip VARCHAR(30) NOT NULL,                        -- patrimven, forexebug, efactura, raport
    parametri JSONB NOT NULL DEFAULT '{}',
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending, processing, completed, failed
    progress INTEGER NOT NULL DEFAULT 0,             -- 0-100
    
    file_url VARCHAR(500),
    file_size_bytes BIGINT,
    error_message TEXT,
    
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    requested_by UUID REFERENCES tenant_users(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON export_jobs FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

## 6. RLS Summary

All tenant-scoped tables use the same pattern:

```sql
-- [UPDATED per review] Set in middleware before each request (parameterized):
SELECT set_config('app.current_tenant_id', $1, true);  -- $1 = tenant UUID string

-- Every table with tenant_id:
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <table> FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**Bypass for super_admin**: Use a separate PostgreSQL role (`primaria_admin`) that has `BYPASSRLS`.

**Service role**: Background workers (BullMQ) use `primaria_service` role with `BYPASSRLS` for cross-tenant batch operations (e.g., penalty calculation).

---

## 7. Migration Strategy (Excel/CSV Import)

### 7.1 Import Flow

```
Excel/CSV Upload → Validation → Staging Table → Transform → Production Tables
```

### 7.2 Staging Tables

```sql
CREATE TABLE import_staging (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    import_batch_id UUID NOT NULL,
    row_number INTEGER NOT NULL,
    raw_data JSONB NOT NULL,           -- Original row as JSON
    entity_type VARCHAR(50) NOT NULL,  -- contribuabil, cladire, teren, vehicul, sold
    validation_errors JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'pending', -- pending, valid, error, imported
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 Common Import Mappings

| Source Column (Excel) | Target Table | Target Column |
|----------------------|-------------|---------------|
| Nume/Denumire | contribuabili | nume |
| Prenume | contribuabili | prenume |
| CNP | contribuabili | cnp |
| CUI/CIF | contribuabili | cui |
| Adresa | contribuabili | adresa_domiciliu |
| Nr. Rol | contribuabili | cod_rol |
| Suprafață construită | proprietati_cladiri | suprafata_construita |
| Destinație | proprietati_cladiri | destinatie |
| Nr. înmatriculare | proprietati_vehicule | numar_inmatriculare |
| Sold restant | impozite | suma_datorata (opening balance) |

### 7.4 Data Cleaning Rules

- CNP validation (13 digits, checksum)
- CUI validation (format + ANAF verification API)
- Address normalization
- Duplicate detection (CNP/CUI match)
- Date format normalization (DD.MM.YYYY → ISO)
- Amount parsing (Romanian format: 1.234,56 → 1234.56)

---

## 8. PatrimVen Export Mapping

### 8.1 F3001 — Property Declarations

| PrimărIA Field | PatrimVen XML Element | Notes |
|---------------|----------------------|-------|
| contribuabili.cnp | `<CNP>` | |
| contribuabili.cui | `<CUI>` | |
| contribuabili.nume | `<Nume>` | |
| contribuabili.prenume | `<Prenume>` | |
| contribuabili.adresa_domiciliu | `<Adresa>` | Parsed into street/number/etc. |
| proprietati_cladiri.suprafata_construita | `<SuprafataC>` | |
| proprietati_cladiri.destinatie | `<TipCladire>` | Mapped to PatrimVen codes |
| proprietati_cladiri.valoare_impozabila | `<ValoareImpozabila>` | |
| proprietati_terenuri.categorie | `<CategorieTeren>` | Mapped to PatrimVen codes |
| proprietati_terenuri.suprafata_mp | `<Suprafata>` | |

### 8.2 F3002 — Vehicle Declarations

| PrimărIA Field | PatrimVen XML Element |
|---------------|----------------------|
| proprietati_vehicule.numar_inmatriculare | `<NrInmatriculare>` |
| proprietati_vehicule.serie_sasiu | `<SerieSasiu>` |
| proprietati_vehicule.tip_vehicul | `<TipVehicul>` |
| proprietati_vehicule.cilindree_cmc | `<CapacitateCilindrica>` |
| proprietati_vehicule.an_fabricatie | `<AnFabricatie>` |

### 8.3 F3101 — Fiscal Certificates

| PrimărIA Field | PatrimVen XML Element |
|---------------|----------------------|
| impozite.suma_datorata | `<SumaImpozit>` |
| impozite.suma_platita | `<SumaPlatita>` |
| impozite.suma_restanta | `<SumaRestanta>` |
| impozite.tax_type | `<TipImpozit>` |

---

*Schema will evolve through Drizzle ORM migrations. This document represents the initial design — expect additions as integration requirements are finalized.*
