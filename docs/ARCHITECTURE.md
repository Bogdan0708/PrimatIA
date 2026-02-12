# PrimărIA — System Architecture

**Version**: 1.0  
**Date**: 2026-02-12  

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Staff UI │  │ Citizen  │  │  Mayor   │  │  PWA / Mobile │  │
│  │ (Next.js)│  │  Portal  │  │Dashboard │  │   (Future)    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
└───────┼──────────────┼─────────────┼───────────────┼───────────┘
        │              │             │               │
┌───────▼──────────────▼─────────────▼───────────────▼───────────┐
│                      API GATEWAY / MIDDLEWARE                    │
│  Auth (JWT + ROeID) │ RLS Tenant Context │ Rate Limiting │ i18n │
├─────────────────────────────────────────────────────────────────┤
│                      APPLICATION LAYER                          │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────┐ │
│  │ Tax Engine │ │  Document  │ │  Payment   │ │  Reporting  │ │
│  │            │ │ Generator  │ │  Service   │ │   Engine    │ │
│  └────────────┘ └────────────┘ └────────────┘ └─────────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────┐ │
│  │ Exemption  │ │Enforcement │ │Notification│ │  AI Service │ │
│  │  Engine    │ │  Workflow  │ │  Service   │ │  (Future)   │ │
│  └────────────┘ └────────────┘ └────────────┘ └─────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      INTEGRATION LAYER                          │
│                                                                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐  │
│  │ PatrimVen │ │Ghișeul.ro │ │ Forexebug │ │  RO e-Factura │  │
│  │  (XML)    │ │  (SNEP)   │ │           │ │               │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────┘  │
│  ┌───────────┐ ┌───────────┐                                   │
│  │   ROeID   │ │OCPI/Cadast│                                   │
│  └───────────┘ └───────────┘                                   │
├─────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                               │
│                                                                 │
│  ┌──────────────────┐  ┌─────────┐  ┌──────────────────────┐  │
│  │   PostgreSQL 16   │  │  Redis  │  │  S3/MinIO (docs,    │  │
│  │   (RLS multi-     │  │ (cache, │  │   PDFs, exports)    │  │
│  │    tenant)        │  │  queue) │  │                      │  │
│  └──────────────────┘  └─────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      INFRASTRUCTURE                             │
│  Docker Compose (dev) │ Kubernetes (prod) │ Romanian Datacenter │
│  CI/CD (GitHub Actions) │ Monitoring (Grafana) │ PgBouncer     │
│  Backups │ Read Replicas (at scale)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript | SSR/SSG, excellent DX, reuse from hospitality-saas |
| **UI** | Tailwind CSS + shadcn/ui | Fast development, accessible components |
| **State** | React Query (TanStack Query) | Server state management, caching |
| **i18n** | next-intl | Built for Next.js App Router, ICU message format |
| **Backend** | Next.js API Routes + Server Actions | Unified stack, reduced complexity |
| **Database** | PostgreSQL 16 with RLS | Multi-tenant isolation, proven pattern from hospitality-saas |
| **ORM** | Drizzle ORM | Type-safe, lightweight, great migration support |
| **Connection Pool** | PgBouncer (transaction mode) | Connection pooling from day one, essential for serverless/k8s [UPDATED per review] |
| **Cache/Queue** | Redis (BullMQ for jobs) | Background job processing (reports, bulk operations) |
| **Auth** | NextAuth.js v5 (Auth.js) | Flexible providers, JWT + session |
| **Storage** | MinIO (S3-compatible) | PDFs, exports, document templates |
| **PDF** | @react-pdf/renderer or Puppeteer | Official document generation |
| **XML** | fast-xml-parser | PatrimVen DUKIntegrator format |
| **Monitoring** | OpenTelemetry + Grafana | Observability |
| **CI/CD** | GitHub Actions | Automated testing and deployment |

---

## 3. Multi-Tenant Design

Reusing the proven RLS pattern from hospitality-saas, adapted for municipalities:

### Tenant Context

```typescript
// [UPDATED per review] Middleware sets tenant context on every request
// SECURITY: Use parameterized query to prevent SQL injection
async function setTenantContext(db: Pool, tenantId: string) {
  await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
}
```

### RLS Policy Pattern

```sql
-- Every tenant-scoped table follows this pattern:
ALTER TABLE contribuabili ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON contribuabili
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Soft-delete variant for master data:
CREATE POLICY tenant_isolation_active ON contribuabili
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id')::UUID
    AND deleted_at IS NULL
  );
```

### Tenant Resolution

- **Staff**: Tenant derived from authenticated user's `tenant_id`
- **Citizen Portal**: Tenant derived from subdomain (`comuna-name.primaria.ro`) or URL path
- **Super Admin**: Bypass RLS via separate DB role for platform operations

---

## 4. Tax Engine Design

The tax engine is the core domain module. It must be **configurable, not hardcoded**, to survive legislative changes.

### 4.1 Tax Type Registry

```
┌─────────────────────────────────────────────────┐
│                TAX TYPE REGISTRY                 │
├─────────────────────────────────────────────────┤
│ impozit_cladiri_rezidentiale    (Art. 457)      │
│ impozit_cladiri_nerezidentiale  (Art. 458)      │
│ impozit_cladiri_mixte           (Art. 459)      │
│ impozit_teren_intravilan        (Art. 465)      │
│ impozit_teren_extravilan        (Art. 465)      │
│ impozit_teren_curti             (Art. 465)      │
│ impozit_mijloace_transport      (Art. 470)      │
│ taxa_firma                      (Art. 475)      │
│ taxa_hoteliera                  (Art. 478)      │
│ taxa_spectacole                 (Art. 480)      │
│ taxa_utilizare_domeniu_public   (Art. 486)      │
│ alte_taxe_locale                (Art. 486)      │
└─────────────────────────────────────────────────┘
```

### 4.2 Rate Configuration Model

```
┌──────────────────────────┐     ┌──────────────────────────┐
│      hcl_decisions       │     │      tax_rate_tables     │
│──────────────────────────│     │──────────────────────────│
│ id                       │────▶│ hcl_decision_id          │
│ tenant_id                │     │ tax_type                 │
│ hcl_number (e.g. "45")  │     │ category                 │
│ hcl_date                 │     │ zone (A/B/C/D)           │
│ fiscal_year              │     │ rank (0-V for communes)  │
│ valid_from               │     │ rate_percent / rate_fixed│
│ valid_to                 │     │ min_rate (legal floor)   │
│ inflation_index          │     │ max_rate (legal ceiling) │
│ status (draft/active)    │     │ unit (lei/mp, lei/ha...) │
└──────────────────────────┘     └──────────────────────────┘
```

### 4.3 Tax Calculation Flow

```
Input: Contribuabil + Proprietate + Fiscal Year
  │
  ▼
┌─────────────────────────────┐
│ 1. Resolve applicable HCL   │ (latest active for fiscal year)
│ 2. Look up rate table entry  │ (by tax_type + category + zone + rank)
│ 3. Apply base calculation    │ (rate × base_value)
│ 4. Apply exemptions          │ (rules engine: veteran? handicap? etc.)
│ 5. Apply indexation          │ (inflation coefficient if applicable)
│ 6. Round per legal rules     │ (Art. 489 rounding)
│ 7. Split into installments   │ (Q1: Mar 31, Q2: Sep 30)
│ 8. Generate debit records    │
└─────────────────────────────┘
  │
  ▼
Output: Impozit record + Decizie de Impunere (document)
```

### 4.4 Exemption Rules Engine

```typescript
interface ExemptionRule {
  id: string;
  name_ro: string;          // "Scutire veterani de război"
  legal_basis: string;       // "Art. 456 alin. (1) lit. a)"
  tax_types: TaxType[];      // Which taxes it applies to
  discount_percent: number;  // 100 = full exemption, 50 = half
  conditions: Condition[];   // JSON-defined conditions
  required_documents: string[]; // ["certificat veteran", "CI"]
  auto_renewable: boolean;
  valid_from?: Date;
  valid_to?: Date;
}
```

---

## 5. Integration Layer

### 5.1 PatrimVen (ANAF) — Priority: P0

```
PrimărIA DB ──▶ XML Generator ──▶ DUKIntegrator XML ──▶ ePatrim.anaf.ro
                                   │
                                   ├── F3001 (Property declarations)
                                   ├── F3002 (Vehicle declarations)
                                   └── F3101 (Income certificates)
```

- **Format**: XML per DUKIntegrator schema (XSD provided by ANAF)
- **Frequency**: On-demand + batch (quarterly/annual)
- **Authentication**: Digital certificate (qualified electronic signature)

### 5.2 Ghișeul.ro (SNEP) — Priority: P1

- **Protocol**: REST API (documentation via ADR request)
- **Flow**: PrimărIA generates payment order → citizen pays on Ghișeul.ro → webhook confirms payment → auto-reconciliation
- **Enrollment**: Institutional agreement required per commune

### 5.3 Forexebug — Priority: P1

- Budget execution reporting for public institutions
- XML export format

### 5.4 ROeID — Priority: P1

- OpenID Connect provider for citizen authentication
- National digital identity system

### 5.5 RO e-Factura — Priority: P1

- UBL 2.1 XML format
- Mandatory for B2G electronic invoicing

---

## 6. Document Generation

### Template System

```
┌──────────────────────────────────────────────────┐
│              DOCUMENT TEMPLATES                   │
├──────────────────────────────────────────────────┤
│ decizie_impunere_cladiri.hbs    (Tax assessment) │
│ decizie_impunere_teren.hbs      (Land tax)       │
│ decizie_impunere_auto.hbs       (Vehicle tax)    │
│ adeverinta_fiscala.hbs          (Tax certificate) │
│ certificat_atestare_fiscala.hbs (Fiscal cert.)   │
│ somatie.hbs                     (Summons)        │
│ titlu_executoriu.hbs            (Exec. title)    │
│ borderou_incasari.hbs           (Collection log) │
└──────────────────────────────────────────────────┘
```

Each template is:
- **Handlebars/Mustache** template → rendered with data → **PDF** via Puppeteer or react-pdf
- **Customizable per tenant**: Logo, antet, semnătură, ștampilă
- **Batch generation**: Mass produce decisions at fiscal year start (BullMQ job)
- **Qualified Electronic Signature (QES)**: All fiscal documents signed via certSIGN/DigiSign API in PAdES format (P0) [UPDATED per review]

---

## 7. Notification System

```
┌────────────────┐
│ Event Trigger  │ (payment due, penalty, document ready)
└───────┬────────┘
        ▼
┌────────────────┐     ┌──────────────────────────┐
│ Notification   │────▶│ Channel Router            │
│ Service        │     │                           │
└────────────────┘     │  ┌─────┐ ┌─────┐ ┌─────┐│
                       │  │Email│ │ SMS │ │WhApp││
                       │  └─────┘ └─────┘ └─────┘│
                       │  ┌────────┐ ┌──────────┐ │
                       │  │Telegram│ │In-App    │ │
                       │  └────────┘ └──────────┘ │
                       └──────────────────────────┘
```

- **Email**: Resend or SMTP
- **SMS**: Twilio or Romanian provider (NetSMS, SMS.ro)
- **WhatsApp**: WhatsApp Business API (via Twilio)
- **Telegram**: Bot API
- **Citizen preferences**: Opt-in per channel, GDPR compliant

---

## 8. i18n Architecture

### Setup with next-intl

```
src/
  messages/
    ro.json          # Primary — all keys defined here first
    en.json          # Secondary — English translations
    hu.json          # Hungarian — launch language
  middleware.ts      # Locale detection (default: ro)
```

### Convention
- All UI labels, form fields, error messages: defined in `ro.json` first
- Database content (tax type names, document templates): stored as **JSONB** `{"ro": "...", "en": "...", "hu": "..."}` — single convention for all translatable fields [UPDATED per review]
- User/contribuabil tables include `limba_preferata` field for notification language preference [UPDATED per review]
- Legal document generation: **Romanian only** (Constituție Art. 13 — limba oficială) [UPDATED per review]
- Date/number formatting: Romanian locale (`dd.MM.yyyy`, `1.234,56`)

---

## 9. Key Data Entities

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│ Tenant   │────▶│ Contribuabil │────▶│  Proprietate │
│(Primărie)│     │ (Taxpayer)   │     │  (Property)  │
└──────────┘     └──────┬───────┘     └──────┬───────┘
                        │                     │
              ┌─────────┴──────┐    ┌─────────┴──────────┐
              │                │    │         │           │
         ┌────▼────┐    ┌─────▼──┐ │    ┌────▼───┐ ┌────▼────┐
         │ Impozit │    │  Plată │ │    │Clădire │ │ Vehicul │
         │  (Tax)  │    │(Payment│ │    │(Build.)│ │(Vehicle)│
         └────┬────┘    └────────┘ │    └────────┘ └─────────┘
              │                    │
         ┌────▼─────┐       ┌─────▼──┐
         │ Document │       │ Teren  │
         │ (Decizie,│       │ (Land) │
         │  Somație)│       └────────┘
         └──────────┘
```

See [DATA_MODEL.md](./DATA_MODEL.md) for full schema.

---

## 10. Security Architecture

### 10.1 RBAC Roles

| Role | Scope | Permissions |
|------|-------|-------------|
| **super_admin** | Platform | All tenants, system config, billing |
| **admin** | Tenant | Full tenant management, user management, configuration |
| **operator** | Tenant | CRUD contribuabili, proprietăți, documente, vizualizare plăți |
| **contabil** | Tenant | Plăți, rapoarte financiare, export Forexebug |
| **cetatean** | Tenant (own data) | Vizualizare solduri proprii, plată, descărcare documente |

### 10.2 Audit Logging

Every mutation is logged:

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,  -- 'create', 'update', 'delete'
    entity_type VARCHAR(50) NOT NULL, -- 'contribuabil', 'impozit', etc.
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 10.3 GDPR Compliance

- Data stored in Romanian datacenter
- Encryption at rest (AES-256) for PII fields (CNP, addresses)
- Right to erasure: Soft-delete + anonymization after legal retention period (10 years)
- Data export: JSON/CSV per GDPR Art. 20
- Consent tracking for notifications
- DPO contact information in system

---

## 11. API Design

REST endpoints grouped by domain:

```
/api/v1/
├── /auth
│   ├── POST   /login
│   ├── POST   /logout
│   ├── POST   /refresh
│   └── GET    /me
│
├── /contribuabili          (Taxpayers)
│   ├── GET    /             (list, search, filter)
│   ├── POST   /             (create)
│   ├── GET    /:id          (detail + fiscal summary)
│   ├── PUT    /:id          (update)
│   ├── DELETE /:id          (soft delete)
│   ├── GET    /:id/proprietati   (properties)
│   ├── GET    /:id/impozite      (taxes)
│   ├── GET    /:id/plati         (payments)
│   └── GET    /:id/documente     (documents)
│
├── /proprietati            (Properties)
│   ├── /cladiri            (Buildings)
│   ├── /terenuri           (Land)
│   └── /vehicule           (Vehicles)
│
├── /impozite               (Taxes/Assessments)
│   ├── GET    /             (list by year, type, status)
│   ├── POST   /calculeaza  (calculate for taxpayer/year)
│   └── POST   /genereaza-masa  (mass generation)
│
├── /plati                  (Payments)
│   ├── POST   /             (record payment)
│   ├── GET    /:id
│   └── POST   /reconciliere (Ghișeul.ro webhook)
│
├── /documente              (Documents)
│   ├── POST   /genereaza   (generate document)
│   ├── GET    /:id/pdf     (download PDF)
│   └── POST   /masa        (batch generation)
│
├── /rapoarte               (Reports)
│   ├── GET    /registru-fiscal
│   ├── GET    /centralizator
│   ├── GET    /restante
│   └── GET    /incasari
│
├── /configurare            (Configuration)
│   ├── /hcl-decisions      (Council decisions)
│   ├── /rate-tables        (Tax rate tables)
│   ├── /scutiri            (Exemption rules)
│   └── /tenant-settings
│
├── /export                 (Integrations)
│   ├── POST   /patrimven   (Generate PatrimVen XML)
│   ├── POST   /forexebug   (Generate Forexebug export)
│   └── POST   /e-factura   (Generate e-Invoice)
│
└── /portal                 (Citizen Portal — separate auth)
    ├── GET    /solduri      (my balances)
    ├── POST   /plata        (initiate payment)
    ├── GET    /documente    (my documents)
    └── POST   /declaratie   (submit declaration)
```

---

## 12. Deployment Architecture

### Development

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://...
      REDIS_URL: redis://redis:6379
  
  postgres:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
  
  redis:
    image: redis:7-alpine
  
  minio:
    image: minio/minio
    ports: ["9000:9000"]
```

### Production

```
┌─────────────────────────────────────────────┐
│           Romanian Datacenter (GDPR)         │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │         Kubernetes Cluster            │   │
│  │                                       │   │
│  │  ┌─────────┐  ┌─────────┐           │   │
│  │  │ App Pod │  │ App Pod │  (HPA)    │   │
│  │  │ (Next.js│  │ (Next.js│           │   │
│  │  └─────────┘  └─────────┘           │   │
│  │  ┌─────────┐  ┌─────────┐           │   │
│  │  │ Worker  │  │ Worker  │  (BullMQ) │   │
│  │  └─────────┘  └─────────┘           │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────┐ ┌───────┐ ┌────────────────┐ │
│  │PostgreSQL│ │ Redis │ │ MinIO (S3)     │ │
│  │ (HA)     │ │Cluster│ │                │ │
│  └──────────┘ └───────┘ └────────────────┘ │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Nginx Ingress + Let's Encrypt       │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Romanian DC options**: M247 (Bucharest), Hosterion, GTS Telecom, or Romanian-based cloud (potentially via Azure/AWS region when available).

---

---

## 13. Additional Data Design Decisions [UPDATED per review]

### 13.1 Structured Addresses (`adrese` table)

Unstructured TEXT address fields break PatrimVen XML export (requires strada, numar, bloc, etc. separately). All address references replaced with FK to normalized `adrese` table with RO-standard fields: strada, numar, bloc, scara, etaj, apartament, localitate, judet, cod_postal, zona_fiscala.

### 13.2 Configurable Tax Type Registry

Tax types stored in a registry table (not enum) to support:
- New tax types added by HCL without code changes
- Per-tenant activation/deactivation
- Configurable formula references

### 13.3 Co-ownership (`proprietati_detinatori`)

Joint table for shared property ownership with `cota_parte`, `valid_from`, `valid_to` — replacing inline `cota_parte` on property tables.

### 13.4 Consent Management (`consimtaminte`)

GDPR-compliant consent tracking per notification channel per contribuabil. Opt-in required before sending any notification.

### 13.5 Penalties Detail (`penalitati`)

Daily accrual tracking table for audit compliance. Each day's penalty is a separate record, enabling precise audit trails.

---

## 14. QES / Digital Signature Integration [UPDATED per review]

### Provider: certSIGN or DigiSign

- **API**: Remote QES signing via provider's cloud signing API
- **Format**: PAdES (PDF Advanced Electronic Signatures) for all signed PDFs
- **Scope**: All fiscal documents (decizii de impunere, somații, adeverințe, certificate)
- **Legal basis**: eIDAS Regulation, L455/2001 on electronic signatures
- **Flow**: Generate PDF → send to QES API → receive signed PDF → store in MinIO
- **Fallback**: Manual signing via USB token (for communes that prefer it)

---

## 15. CNP Encryption Design [UPDATED per review]

CNP (personal identification number) is highly sensitive PII:

- **Storage**: App-level encryption (AES-256-GCM) before DB write
- **Lookup**: Separate `cnp_hash` column (SHA-256 with per-tenant salt) for equality lookups
- **Search**: Remove CNP from full-text GIN index — use exact hash match only
- **Key management**: Encryption keys in environment/vault, rotatable
- **Display**: Masked in UI except for authorized roles (admin, operator)

---

## 16. Audit Log Integrity [UPDATED per review]

- RLS policy: **INSERT + SELECT only** — no UPDATE or DELETE permitted
- Service role also restricted (no DELETE on audit_logs)
- Consider external log shipping (e.g., to S3/WORM storage) for tamper evidence
- Partitioned by month for performance

---

## 17. Incident Response & NIS2 Compliance [UPDATED per review]

- **NIS2 Directive** (EU 2022/2555): Applicable to public administration entities
- **Incident response plan**: Documented procedure for security incidents
- **DNSC reporting**: Notification within 24 hours for significant incidents
- **GDPR Art. 33**: ANSPDCP notification within 72 hours for personal data breaches
- **Incident log**: All security events logged with timestamps, actions taken, personnel involved
- **Annual review**: Incident response plan reviewed and tested annually

---

## 18. Read Replica Strategy [UPDATED per review]

At scale (50+ tenants):
- **Primary**: All writes, real-time reads (staff operations)
- **Read replica**: Reporting engine, analytics dashboard, PatrimVen exports
- **Implementation**: PostgreSQL streaming replication, application-level routing via connection string
- **PgBouncer**: Separate pools for primary vs replica

---

*This document should be read alongside [DATA_MODEL.md](./DATA_MODEL.md) and [IMPLEMENTATION.md](./IMPLEMENTATION.md).*
