# PrimărIA — Implementation Roadmap

**Version**: 1.0  
**Date**: 2026-02-12  

---

## Overview

22-week implementation in 5 phases. Each phase builds on the previous, delivering incrementally usable functionality. [UPDATED per review: expanded from 20 to 22 weeks]

**Team assumption**: 1-2 full-stack developers + 1 domain expert (commune secretary/accountant for validation).

---

## Phase 1: Foundation (Weeks 1–4)

### Objective
Project scaffolding, database schema, authentication, tenant management, and i18n setup.

### Deliverables

| # | Deliverable | Details |
|---|-------------|---------|
| 1.1 | **Project setup** | Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Drizzle ORM, Docker Compose |
| 1.2 | **Database schema** | PostgreSQL 16: tenants, users, contribuabili, proprietati (cladiri/terenuri/vehicule), core lookup tables, **structured `adrese` table**, **`consimtaminte` table**, **`tax_type_registry`** [UPDATED per review] |
| 1.2a | **PgBouncer** | Connection pooling in transaction mode from day one [UPDATED per review] |
| 1.2b | **DPIA** | Conduct Data Protection Impact Assessment, document formally (GDPR Art. 35) [UPDATED per review] |
| 1.2c | **SEAP registration** | Register at e-licitatie.ro, list in electronic catalog [UPDATED per review] |
| 1.3 | **RLS implementation** | Row-level security on all tenant-scoped tables, middleware for tenant context (**parameterized queries, not string interpolation**) [UPDATED per review] |
| 1.4 | **Authentication** | NextAuth.js v5: email/password + 2FA (TOTP), JWT sessions, role-based middleware |
| 1.5 | **Tenant management** | Super-admin: create/configure tenants, assign users, set tier |
| 1.6 | **i18n setup** | next-intl with RO (primary) + HU + EN, locale detection, all base UI strings in 3 languages |
| 1.7 | **UI shell** | Layout, navigation, dashboard skeleton, responsive design |
| 1.8 | **CI/CD pipeline** | GitHub Actions: lint, type-check, test, build, deploy to staging |
| 1.10 | **Basic PWA / Service Worker** | Offline-first shell, basic service worker for rural communes with intermittent internet [UPDATED per review] |
| 1.9 | **Seed data** | Romanian-specific: zone classification, commune ranks, tax type registry, demo tenant |

### Acceptance Criteria
- [ ] Developer can run `docker compose up` and have full local environment
- [ ] Admin can create a tenant (primărie) and assign users with roles
- [ ] RLS prevents cross-tenant data access (verified by tests)
- [ ] UI renders in Romanian by default, switchable to English
- [ ] All models have TypeScript types matching DB schema
- [ ] CI pipeline passes on every PR

### Risks
| Risk | Mitigation |
|------|------------|
| Drizzle ORM RLS integration complexity | Fallback to raw SQL for RLS-sensitive queries |
| Scope creep on UI polish | Stick to shadcn defaults, polish in Phase 5 |

---

## Phase 2: Tax Engine (Weeks 5–10) [UPDATED per review: expanded to 6 weeks]

### Objective
Tax calculation engine for **3 core tax types** (buildings, land, vehicles), rate configuration, taxpayer CRUD, and property management. Includes bonificație, partial year proration, age coefficients, and daily penalty accrual. *Taxa firmă/hotelieră/spectacole deferred to post-MVP.*

### Deliverables

| # | Deliverable | Details |
|---|-------------|---------|
| 2.1 | **Taxpayer CRUD** | Full contribuabil management: PF (CNP encrypted) + PJ (CUI), search, filter, fiscal summary view |
| 2.2 | **Property management** | Clădiri: type, area, year, zone, rank, value. Terenuri: category, area, zone. Vehicule: type, capacity, pollution norm, year. **Co-ownership via `proprietati_detinatori`** [UPDATED per review] |
| 2.3 | **HCL configuration** | Admin creates HCL decision with effective dates, links rate tables |
| 2.4 | **Rate tables** | Full rate table UI: per tax type, category, zone, rank — with legal min/max validation |
| 2.5 | **Tax calculation engine** | Automated calculation per taxpayer: resolve HCL → lookup rate → calculate → apply exemptions → **apply bonificație** → **partial year proration** → split installments [UPDATED per review] |
| 2.6 | **Exemption rules** | Configurable exemptions with document requirements (veteran, handicap, etc.) per Art. 456 |
| 2.7 | **Mass calculation** | Batch job: calculate all taxes for a fiscal year (BullMQ worker) |
| 2.8 | **Payment recording** | Record payments: cash, bank transfer, postal order — auto-distribute across debts (oldest first per CPF) |
| 2.9 | **Penalty calculation** | Daily penalty accrual with `penalitati` detail table per Cod Procedură Fiscală [UPDATED per review] |
| 2.10 | **Data import** | CSV/Excel import with **`import_batches`** tracking and rollback support [UPDATED per review] |
| 2.11 | **Building age coefficient** | Art. 457 reduction by building age [UPDATED per review] |
| 2.12 | **Vehicle tax brackets** | Art. 470 bracket formulas per vehicle category [UPDATED per review] |

### Acceptance Criteria
- [ ] 3 core tax types (buildings, land, vehicles) calculated correctly
- [ ] Bonificație applied correctly for early full payment (Art. 462)
- [ ] Partial year proration works for mid-year acquisitions/disposals
- [ ] Rate tables respect legal min/max bounds (validation on save)
- [ ] Exemptions correctly reduce/eliminate taxes with required document tracking
- [ ] Mass calculation for 5,000 taxpayers completes in < 5 minutes
- [ ] Payments auto-distribute correctly (verify with accountant)
- [ ] CSV import successfully migrates sample data from a real commune

### Risks
| Risk | Mitigation |
|------|------------|
| Tax calculation edge cases (mixed buildings, partial year) | Extensive test suite with real-world data from pilot commune |
| Legislative ambiguity in rate application | Consult with commune accountant, document assumptions |
| Import data quality from Excel files | Validation layer with error reporting, not silent failures |

---

## Phase 3: Documents & Reporting (Weeks 11–14) [UPDATED per review]

### Objective
PDF document generation for all official fiscal documents, PatrimVen XML export, and basic reporting.

### Deliverables

| # | Deliverable | Details |
|---|-------------|---------|
| 3.1 | **Document template system** | Handlebars templates → PDF, customizable per tenant (logo, header, stamp) |
| 3.2 | **Decizie de impunere** | Tax assessment decision — per tax type, per taxpayer, batch generation |
| 3.3 | **Adeverință fiscală** | Fiscal certificate — on-demand, with outstanding balance info |
| 3.4 | **Certificat de atestare fiscală** | Fiscal attestation certificate for property transactions |
| 3.5 | **Somație** | Payment summons with legal basis and deadline |
| 3.6 | **Borderou de încasări** | Daily/periodic collection log |
| 3.7 | **PatrimVen XML export** | Full DUKIntegrator-compatible XML generation for **all form types** (F3001-F3005, F3100, F3101, F3102) [UPDATED per review] |
| 3.7a | **QES integration** | certSIGN/DigiSign API integration for qualified electronic signatures on all fiscal documents (PAdES format) [UPDATED per review] |
| 3.7b | **Incident response documentation** | Security incident response plan, DNSC/ANSPDCP reporting procedures (NIS2 + GDPR Art. 33) [UPDATED per review] |
| 3.8 | **Basic reports** | Registru fiscal, centralizator debite/încasări, situație restanțe, registru rol |
| 3.9 | **Document archive** | All generated documents stored in MinIO, linked to contribuabil, downloadable |
| 3.10 | **Batch operations** | Mass document generation with progress tracking (BullMQ) |

### Acceptance Criteria
- [ ] Generated PDFs match official Romanian fiscal document formats
- [ ] PatrimVen XML validates against ANAF XSD schema
- [ ] All generated documents have valid QES (certSIGN) in PAdES format
- [ ] Batch generation of 1,000 decisions completes in < 10 minutes
- [ ] Secretary can customize document header/footer per commune
- [ ] All reports are exportable to PDF and Excel
- [ ] Documents are immutable once generated (audit trail)

### Risks
| Risk | Mitigation |
|------|------------|
| PatrimVen XSD format changes | Abstract XML generation layer, monitor ANAF updates |
| PDF layout issues with variable-length data | Extensive testing with edge cases (long names, many properties) |
| Report performance with large datasets | Materialized views for complex aggregations |

---

## Phase 4: Citizen Portal & Integrations (Weeks 15–18) [UPDATED per review]

### Objective
Citizen-facing self-service portal, Ghișeul.ro payment integration, notification system, and enforcement workflow.

### Deliverables

| # | Deliverable | Details |
|---|-------------|---------|
| 4.1 | **Citizen portal** | Public-facing: login (email + ROeID), view balances, download documents |
| 4.2 | **Ghișeul.ro integration** | Mock implementation initially; payment initiation → redirect to SNEP → webhook confirmation → auto-reconciliation [UPDATED per review] |
| 4.2a | **Offline payment recording** | Record cash/bank payments while offline, sync when connected [UPDATED per review] |
| 4.3 | **Notification service** | **Email-only initially**; SMS/WhatsApp/Telegram in later iteration [UPDATED per review] |
| 4.4 | **Notification templates** | RO message templates: payment due, payment confirmed, summons issued, document ready |
| 4.5 | **Enforcement workflow** | Automated: overdue → somație → waiting period → penalizare → titlu executoriu |
| 4.6 | **Online declarations** | Citizens submit property/vehicle declarations online |
| 4.7 | **ROeID authentication** | OpenID Connect integration for citizen identity verification |
| 4.8 | **E-Factura export** | UBL 2.1 XML generation for electronic invoicing |
| 4.9 | **Forexebug export** | Budget execution reporting XML |

### Acceptance Criteria
- [ ] Citizen can view balances and pay via Ghișeul.ro end-to-end
- [ ] Notifications delivered within 5 minutes of trigger event
- [ ] Enforcement workflow correctly transitions through all stages with legal deadlines
- [ ] ROeID login works for citizen authentication
- [ ] Citizens can submit declarations that appear in staff queue for review

### Risks
| Risk | Mitigation |
|------|------------|
| Ghișeul.ro API access delayed (ADR bureaucracy) | Start ADR contact in Phase 1, mock API for development |
| WhatsApp Business API approval | Start Meta verification early, fallback to SMS |
| ROeID availability/stability | Graceful fallback to email/password auth |

---

## Phase 5: Security, Performance & Pilot (Weeks 19–22) [UPDATED per review: renamed, AI chatbot deferred]

### Objective
Security audit, performance optimization, and pilot deployment to 2-3 communes. *AI chatbot dropped from initial release — deferred to post-MVP.*

### Deliverables

| # | Deliverable | Details |
|---|-------------|---------|
| ~~5.1~~ | ~~**AI chatbot for citizens**~~ | **Deferred to post-MVP** — focus on core stability first [UPDATED per review] |
| 5.2 | **Anomaly detection** | Flag suspicious declarations: building declared as shed, high-value vehicle + low declared income |
| 5.3 | **Mayor dashboard** | KPIs: collection rate, revenue vs target, trends, top debtors, comparative analytics |
| 5.4 | **Advanced reporting** | Additional report types for Curtea de Conturi compliance |
| ~~5.5~~ | ~~**PWA mobile app**~~ | **Basic PWA moved to Phase 1 (1.10)** [UPDATED per review] |
| ~~5.6~~ | ~~**Hungarian language**~~ | **MOVED TO Phase 1 (1.6)** — HU is a launch language |
| 5.7 | **Performance optimization** | Load testing, query optimization, caching strategy, read replica setup |
| 5.8 | **Security audit** | Penetration testing, OWASP top 10, GDPR compliance review, DPIA validation |
| 5.9 | **Documentation** | User manual (RO), admin guide, API documentation |
| 5.10 | **Pilot deployment** | Deploy to **2-3 pilot communes** in Maramureș [UPDATED per review] |

### Acceptance Criteria
- [ ] Security audit passes with no critical/high findings
- [ ] Anomaly detection flags at least 80% of synthetic test cases
- [ ] Dashboard loads in < 2 seconds with 5 years of data
- [ ] System handles 50 concurrent users per tenant without degradation
- [ ] 2-3 pilot communes actively using the system

### Risks
| Risk | Mitigation |
|------|------------|
| Pilot commune resistance to adoption | Training sessions, dedicated support, gradual rollout |
| Performance at scale | Load test early (Phase 4), optimize incrementally |

---

## Timeline Summary

```
Week:  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22
       ├─────────────┤
       │  Phase 1:   │
       │  Foundation  │
                      ├──────────────────┤
                      │    Phase 2:      │
                      │    Tax Engine    │
                                         ├─────────────┤
                                         │  Phase 3:   │
                                         │  Documents  │
                                                       ├─────────────┤
                                                       │  Phase 4:   │
                                                       │  Citizen    │
                                                                     ├─────────────┤
                                                                     │  Phase 5:   │
                                                                     │  Pilot      │

MVP (Phases 1-3): Week 14 — Staff can manage taxes, generate QES-signed documents, export PatrimVen
Full Product (Phases 1-5): Week 22 — Complete with citizen portal, pilot deployment
```

---

## Key Milestones

| Week | Milestone | Gate |
|------|-----------|------|
| 4 | Foundation complete | Demo to team: tenant + auth + i18n + PgBouncer + PWA shell working |
| 10 | Tax engine complete | Validate calculations with real commune data (3 core tax types) |
| 14 | **MVP ready** | Staff can manage taxes, generate QES-signed documents, export PatrimVen |
| 18 | Citizen portal live | Citizens can view/pay online (email notifications, mock Ghișeul.ro) |
| 22 | **Production launch** | 2-3 pilot communes live, security audited |

---

*Roadmap is iterative. Phase boundaries may shift based on pilot feedback and integration dependencies (especially Ghișeul.ro/ROeID).*
