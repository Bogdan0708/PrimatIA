# PrimărIA — Merged Review Action Plan

*Generated: 2026-02-12 from Security/Legal + Architecture reviews*

---

## Critical Fixes (Before Development Starts)

| # | Issue | Source | Fix |
|---|-------|--------|-----|
| 1 | **SQL injection in RLS** — `SET LOCAL` uses string interpolation | Security §3.1 | Use parameterized `$1` or strict UUID validation |
| 2 | **Digital signatures must be P0** — fiscal docs have no legal validity without QES | Security §7.1 | Integrate certSIGN/DigiSign API, PAdES format |
| 3 | **CNP encryption missing** — also exposed in GIN full-text index | Security §1.1 | App-level encryption + hashed CNP for lookup, remove from GIN |
| 4 | **DPIA required** — GDPR Art. 35 mandatory for this processing type | Security §1.2 | Conduct before production, document formally |
| 5 | **SEAP registration** — can't sell to primării without it | Security §5.1 | Register at e-licitatie.ro, list in electronic catalog |
| 6 | **Structured address table** — unstructured TEXT breaks PatrimVen | Arch §1 | Create `adrese` table with RO-standard fields |

## High Priority (Before MVP)

| # | Issue | Source | Fix |
|---|-------|--------|-----|
| 7 | **Bonificație (early payment discount)** — Art. 462, universally expected | Both | Add to HCL config + tax calculation flow |
| 8 | **Partial year proration** — Art. 461, first-of-next-month rule | Arch §2 | Add `data_start_calcul`, `nr_luni` to impozite |
| 9 | **PatrimVen forms incomplete** — missing F3003-F3005, F3100, F3102 | Security §2.1 | Audit full OMF 109/2022, build abstract XML generator |
| 10 | **Missing tax types** — taxa certificat urbanism, autorizație construire, reclamă, taxa specială | Security §2.2 | Make tax types configurable (registry table, not enum) |
| 11 | **3 tax types lack entities** — taxa firmă, hotelieră, spectacole need tables | Arch §1 | Add `proprietati_firma`, `cazare_turistica`, `spectacole` |
| 12 | **Offline/PWA support** — rural communes have intermittent internet | Arch §7 | Move basic service worker + offline queue to Phase 1-2 |
| 13 | **Building age coefficient** — Art. 457 reduction by age | Arch §2 | Add coefficient lookup to tax calculation |
| 14 | **Vehicle tax complexity** — Art. 470 bracket formulas per type | Arch §2 | Polymorphic formula engine per vehicle category |
| 15 | **Exemption stacking policy** — mandatory vs discretionary | Security §2.3 | Add `exemption_type` field, rate boundary validation |
| 16 | **Penalties detail table** — daily accrual required for audit | Arch §1 | Add `penalitati` table with per-day tracking |
| 17 | **Consent management table** — GDPR opt-in per notification channel | Security §1.7 | Add `consimtaminte` table |
| 18 | **Audit log integrity** — INSERT-only policy, no UPDATE/DELETE | Security §3.5 | Fix RLS policy, consider external log shipping |
| 19 | **2FA mandatory for staff** — handles citizen PII | Security §3.3 | Enforce TOTP for operator/admin roles |
| 20 | **PgBouncer** — connection pooling from day one | Arch §4 | Add to Docker Compose |
| 21 | **Incident response plan** — NIS2 + GDPR Art. 33 (72h) | Security §8.2 | Document procedure, DNSC reporting |

## Medium Priority (Before Scale)

| # | Issue | Fix |
|---|-------|-----|
| 22 | Data retention matrix (field-by-field) | Document per GDPR |
| 23 | Art. 30 processing register | Template for each tenant |
| 24 | Co-ownership model (`proprietati_detinatori`) | Join table for shared properties |
| 25 | Import batch tracking with rollback | `import_batches` table |
| 26 | Column-mapping wizard for CSV import | UI for flexible imports |
| 27 | Notification templates in RO/HU/EN | Per-citizen language preference |
| 28 | JSONB for translatable DB content | Single convention for i18n fields |
| 29 | ISO 27001 certification | Required for larger procurement |
| 30 | Read replicas for reporting workloads | At 50+ tenants |

## Revised Timeline (22 Weeks)

| Phase | Weeks | Scope |
|-------|-------|-------|
| **1. Foundation** | 1–4 | Project setup, DB schema (with structured addresses, consent table), auth + 2FA, RLS (parameterized!), i18n (RO+HU+EN), basic PWA/service worker, PgBouncer, SEAP registration |
| **2. Tax Engine** | 5–10 | **6 weeks** — buildings, land, vehicles (3 core types). Bonificație, partial year, age coefficients, penalties accrual. Defer firmă/hotelieră/spectacole to post-MVP |
| **3. Documents + PatrimVen** | 11–14 | PDF with QES (certSIGN), PatrimVen XML (all forms), basic reporting. **MVP at week 14** |
| **4. Citizen Portal** | 15–18 | Self-service portal, email notifications, mock Ghișeul.ro, offline payment recording |
| **5. Polish + Pilot** | 19–22 | Security audit, performance, pilot deployment to 2-3 communes |

## Architecture Decisions Confirmed

- ✅ **Configurable tax types** via registry table (not enum)
- ✅ **JSONB** for all translatable content
- ✅ **Structured addresses** table (not TEXT fields)
- ✅ **Parameterized RLS** (no string interpolation)
- ✅ **QES from P0** (certSIGN/DigiSign integration)
- ✅ **PgBouncer** in transaction mode from day one
- ✅ **~25-30% code reuse** from hospitality-saas (RLS, BullMQ, Docker patterns)
- ✅ **3 launch languages**: RO (primary) + HU + EN
- ✅ **Legal docs always in Romanian** per Constitution Art. 13; HU/EN for informational UI only

---

*Next: Update PRD, ARCHITECTURE, DATA_MODEL, IMPLEMENTATION docs with all fixes.*
