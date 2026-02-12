# PrimărIA — Security & Legal Compliance Review

**Reviewer**: Security & Legal Compliance  
**Date**: 2026-02-12  
**Version**: 1.0  
**Status**: 🔴 Multiple critical gaps identified  

---

## Executive Summary

PrimărIA's architecture demonstrates solid foundational security choices (PostgreSQL RLS, TLS 1.3, AES-256, audit logging). However, the current design has **critical gaps** in GDPR implementation details, Romanian fiscal legislation coverage, digital signature requirements, and public procurement readiness. This review identifies **8 critical**, **12 high**, and **9 medium** severity findings.

---

## 1. GDPR Compliance Gaps

### 1.1 🔴 CRITICAL — CNP Handling & Encryption Implementation

The schema stores CNP in `contribuabili.cnp` as `VARCHAR(13)` with a comment "encrypted at rest." However:

- **No column-level encryption is defined in the schema.** AES-256 is mentioned in the PRD/Architecture but no implementation exists (no `pgcrypto` extension, no application-level encryption, no envelope encryption scheme).
- CNP is a **national identification number** — classified as a **special identifier** under GDPR Art. 87 and Romanian Law 190/2018 Art. 5. It requires heightened protection.
- CNP appears in **full-text search indexes** (`idx_contribuabili_search`) — this means it's stored **in plaintext in the index**, defeating any column encryption.
- CNP is used in PatrimVen XML exports — ensure exports are encrypted in transit and at rest in MinIO.

**Recommendation:**
- Implement application-level encryption for CNP (encrypt before DB, decrypt after retrieval)
- Store a **hashed** CNP for search/lookup (SHA-256 + salt per tenant), store encrypted CNP for display
- Remove CNP from full-text search GIN index — use exact-match on hash instead
- Alternatively: use PostgreSQL TDE (Transparent Data Encryption) available in PG16+ enterprise editions

### 1.2 🔴 CRITICAL — No Data Protection Impact Assessment (DPIA)

Processing CNP, property data, financial records, and enforcement actions for Romanian citizens **mandates a DPIA** under GDPR Art. 35(3)(b) — systematic monitoring/processing of special identifiers at large scale.

**Missing:** No mention of DPIA in any document.

**Recommendation:** Conduct and document a DPIA before any production deployment. Required elements:
- Systematic description of processing operations (Art. 35(7)(a))
- Assessment of necessity and proportionality
- Risk assessment to rights/freedoms
- Measures to address risks (including DPO consultation)

### 1.3 🟡 HIGH — Right to Erasure Implementation Incomplete

The architecture mentions "soft-delete + anonymization after legal retention period (10 years)." Issues:

- **No anonymization procedure is defined.** What fields get anonymized? When? How?
- The 10-year fiscal retention (per Cod Procedură Fiscală Art. 131) applies to **fiscal records**, not all PII. Contact details (phone, email) used for notifications have **no legal retention basis** after the taxpayer relationship ends.
- **No automated anonymization job** exists in the schema or architecture
- Citizen portal accounts (`tenant_users` with role `cetatean`) — what happens when a citizen requests erasure?
- `audit_logs` contain `user_id` — these become dangling references after anonymization

**Recommendation:**
- Define a **data retention matrix**: field-by-field, with legal basis and retention period
- Implement an automated anonymization cron job
- For audit logs: replace user references with anonymized tokens after retention period
- Document the erasure procedure in a GDPR Art. 30 processing register

### 1.4 🟡 HIGH — No Data Processing Register (Art. 30)

GDPR Art. 30 requires controllers (each primărie) and processors (PrimărIA SaaS) to maintain records of processing activities. Not mentioned anywhere.

**Recommendation:** Create and maintain an Art. 30 register template that each tenant (primărie) can access. PrimărIA as processor must also maintain its own register.

### 1.5 🟡 HIGH — DPO Requirements Underspecified

The Architecture mentions "DPO contact information in system" — this is insufficient.

- Each primărie (as public authority) **must** designate a DPO under GDPR Art. 37(1)(a)
- PrimărIA as processor handling data for public authorities should also have a DPO
- The platform should support **per-tenant DPO configuration** with contact details displayed in citizen portal
- DPO must be involved in DPIA process

### 1.6 🟡 HIGH — Data Portability (Art. 20) — Incomplete

PRD mentions "JSON/CSV per GDPR Art. 20." But:
- No API endpoint exists for citizen data export in the API design
- The `/portal` endpoints don't include a data export route
- Export must include **all** personal data: properties, taxes, payments, documents, notifications, enforcement actions

### 1.7 🟡 MEDIUM — Consent Management for Notifications

PRD mentions "consent tracking for notifications" and "opt-in per channel." But:
- No `consents` table exists in the data model
- No consent withdrawal mechanism in the API
- WhatsApp/SMS/Telegram notifications require **explicit opt-in** with granular channel selection
- Consent records must be timestamped and auditable

**Recommendation:** Add a `consimtaminte` (consents) table:
```sql
CREATE TABLE consimtaminte (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    contribuabil_id UUID NOT NULL,
    canal VARCHAR(20) NOT NULL,  -- email, sms, whatsapp, telegram
    consimtamant BOOLEAN NOT NULL,
    acordat_la TIMESTAMPTZ,
    retras_la TIMESTAMPTZ,
    ip_address INET,
    metoda VARCHAR(30)  -- portal, formular, verbal
);
```

### 1.8 🟡 MEDIUM — Data Breach Notification

No breach notification procedure is documented. GDPR Art. 33 requires notification to ANSPDCP within 72 hours. Art. 34 requires notification to affected individuals for high-risk breaches.

**Recommendation:** Document an incident response plan including:
- Breach detection mechanisms (anomaly detection on audit logs)
- 72-hour notification procedure to ANSPDCP
- Citizen notification templates
- Breach register

### 1.9 🟡 MEDIUM — Sub-processor Management

PrimărIA uses third-party services (Twilio for SMS/WhatsApp, Resend for email, potentially cloud providers). GDPR Art. 28(2) requires:
- Prior authorization from controllers (primării) for sub-processors
- Sub-processor list maintained and communicated
- Sub-processor agreements ensuring equivalent protection

---

## 2. Romanian Legislation Compliance

### 2.1 🔴 CRITICAL — PatrimVen: Missing Form Types

The architecture covers F3001 (property), F3002 (vehicles), F3101 (fiscal certificates). **Missing forms per OMF 109/2022:**

- **F3003** — Land declarations (terenuri) — separate from property
- **F3004** — Tax on means of transport (detailed, separate from F3002 for certain categories)
- **F3005** — Tax on advertising/signage (taxa firmă)
- **F3100** — Consolidated taxpayer fiscal file
- **F3102** — Tax payment confirmations

The DUKIntegrator schema is regularly updated by ANAF. The architecture should specify **versioned XSD handling** and an update mechanism.

**Recommendation:** Audit the full OMF 109/2022 annex for all required form types. Build an abstract XML generator that can be updated per ANAF schema versions.

### 2.2 🔴 CRITICAL — Cod Fiscal Title IX Coverage Incomplete

The Tax Type Registry lists 11 tax types. **Missing from Art. 486 "Alte taxe locale":**

- **Taxa pentru eliberarea certificatelor, avizelor și autorizațiilor** (Art. 474) — building permits, urbanism certificates
- **Taxa pentru eliberarea autorizațiilor de funcționare** (Art. 475 covers taxa firmă only, but there are subcategories)
- **Taxa pentru servicii de reclamă și publicitate** (Art. 477) — separate from taxa firmă
- **Taxa specială** (Art. 484) — special taxes set by local council for specific services
- **Impozitul pe spectacole** has subcategories not reflected
- **Taxa de salubrizare** — while not Cod Fiscal, it's commonly managed in the same system
- **Taxe judiciare de timbru** — collected by primării

**The data model lacks a generic "other local tax" handler.** The `tax_type` enum in `impozite` appears hardcoded.

**Recommendation:** Add `taxa_certificat_urbanism`, `taxa_autorizatie_construire`, `taxa_reclama_publicitate`, `taxa_speciala`, and a generic `taxa_locala_personalizata` type. Better: make tax types **fully configurable** via a registry table, not an enum.

### 2.3 🟡 HIGH — L239/2025 Exemption Changes Not Fully Addressed

L239/2025 made significant changes:
- **Eliminated** the 50% reduction for buildings used for tourism (was Art. 456(2)(a))
- **Limited council discretion** on certain exemptions — some exemptions are now mandatory, councils cannot override
- **Changed vehicle tax brackets** with 5%–146% increases based on Euro norms
- **Fixed 0.4% rate** for non-residential agricultural buildings

The exemption engine (`scutiri_reguli`) uses a flexible JSON conditions system, which is good. But:
- No mechanism to **enforce mandatory exemptions** vs. discretionary ones
- No validation that councils don't set rates outside L239/2025 boundaries
- The `min_rate`/`max_rate` in `tax_rate_tables` should be **auto-populated** from legislation, not manually entered

**Recommendation:**
- Add an `exemption_type` field: `mandatory` (law-defined, cannot be removed) vs. `discretionary` (council choice)
- Implement rate boundary validation with reference to specific Cod Fiscal articles
- Ship default rate boundaries per fiscal year as a **platform-managed dataset** that tenants cannot modify

### 2.4 🟡 HIGH — Indexation Mechanism Underspecified

The architecture mentions `inflation_index` on `hcl_decisions`. Issues:
- **Who provides the index?** INS (National Statistics Institute) publishes it. The platform should source it automatically or at minimum provide the official value.
- **When is indexation applied?** Art. 489 specifies indexation applies to fixed-amount taxes, not percentage-based ones. The schema doesn't distinguish.
- **Compound indexation** — rates indexation is cumulative year-over-year. No historical chain is maintained.
- **Mid-year changes** — L239/2025 introduced mid-year adjustments. The `valid_from`/`valid_to` on HCL decisions supports this, but the tax calculation flow doesn't account for pro-rata mid-year changes.

### 2.5 🟡 HIGH — Enforcement Workflow Legal Requirements

The `somatii` table and workflow are basic. Cod de Procedură Fiscală (L207/2015) requirements:

- **Art. 226**: Somație must include specific legal text and payment deadline (≥15 days)
- **Art. 227**: Titlu executoriu — specific format requirements
- **Art. 228-237**: Enforcement measures (poprire, sechestru, vânzare) — each has distinct legal requirements not modeled
- **Art. 230**: Poprire requires notification to third parties (banks, employers) — no integration mentioned
- **Communication proof**: Legal service requirements (confirmare de primire, proces verbal de afișare) — `modalitate_comunicare` is too simple

**Recommendation:** Expand enforcement model significantly or mark as post-MVP with clear legal review.

### 2.6 🟡 MEDIUM — Fiscal Procedure Code Compliance

Beyond enforcement, several Cod Procedură Fiscală requirements are unaddressed:
- **Art. 46-49**: Fiscal administrative acts must have specific elements (number, date, legal basis, appeal instructions, signature). Document templates must be validated against these.
- **Art. 268-281**: Appeal procedure (contestație) — taxpayers can contest assessments. No workflow for handling appeals.
- **Art. 131**: Fiscal documents retention — 10 years from end of fiscal year (not from document date)
- **Art. 11**: Fiscal secrecy (secret fiscal) — all fiscal information is confidential. This has implications beyond GDPR.

---

## 3. Security Architecture

### 3.1 🔴 CRITICAL — SQL Injection in RLS Tenant Context

```typescript
await db.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
```

**This is a SQL injection vulnerability.** If `tenantId` is not strictly validated, an attacker could escape the string and execute arbitrary SQL, including bypassing RLS entirely.

**Recommendation:** Use parameterized queries:
```typescript
await db.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
```
Or validate UUID format strictly before interpolation. This is the **single most critical security finding** — it undermines the entire multi-tenant isolation model.

### 3.2 🔴 CRITICAL — Super Admin / Service Role RLS Bypass

The data model specifies:
- `primaria_admin` role with `BYPASSRLS` for super admin
- `primaria_service` role with `BYPASSRLS` for background workers

**Issues:**
- Any compromise of the application server running as `primaria_service` exposes **all tenant data**
- Background workers (BullMQ) should use tenant-scoped queries even with BYPASSRLS — defense in depth
- No mention of **credential rotation** for these privileged roles
- No mention of **connection pooling** and how tenant context is maintained across pooled connections (critical with PgBouncer/Supavisor)

**Recommendation:**
- Workers should set tenant context explicitly even with BYPASSRLS
- Use **separate connection pools** for service roles vs. application roles
- Implement credential rotation
- Document connection pooling strategy — `SET LOCAL` only works within transactions; if using connection pooling in transaction mode, this is safe; in session mode, it's a tenant leak risk

### 3.3 🟡 HIGH — Authentication Weaknesses

- **Password storage**: `password_hash VARCHAR(255)` — no specification of hashing algorithm. Must use bcrypt/scrypt/argon2id.
- **No password policy** defined (minimum length, complexity, breach database check)
- **Login lockout**: `locked_until` exists but no specification of lockout policy (attempts threshold, duration, progressive backoff)
- **JWT security**: No mention of token lifetime, refresh rotation, or revocation strategy
- **No session management**: No concurrent session limits, no "sign out all devices"
- **2FA**: TOTP is mentioned but not enforced for any role. Staff accounts handling PII should **require** 2FA.

### 3.4 🟡 HIGH — Missing Security Headers & API Protection

Not mentioned in architecture:
- CSP (Content Security Policy)
- CORS configuration
- HSTS
- X-Frame-Options / X-Content-Type-Options
- API rate limiting details (mentioned but not specified)
- Request size limits (important for CSV/Excel import — DoS vector)
- File upload validation (import feature — malicious file risk)

### 3.5 🟡 HIGH — Audit Log Integrity

Audit logs are stored in the same PostgreSQL database, same schema. Issues:
- An attacker with DB access could **modify or delete audit logs**
- No log integrity verification (checksums, append-only, WORM)
- RLS on audit logs means tenant admins can query them — can they also modify them? The policy is `FOR ALL` which includes INSERT/UPDATE/DELETE. Audit logs should be **insert-only**.

**Recommendation:**
- Create audit log policy as `FOR SELECT` and `FOR INSERT` only (no UPDATE/DELETE)
- Consider shipping audit logs to an external, immutable store (S3 with object lock, or dedicated SIEM)
- Add a hash chain for integrity verification

### 3.6 🟡 MEDIUM — Secrets Management

No mention of how secrets are managed:
- Database credentials
- API keys (Twilio, ANAF certificates, Ghișeul.ro)
- JWT signing keys
- Encryption keys for CNP

**Recommendation:** Use a secrets manager (HashiCorp Vault, SOPS, or cloud KMS). Never store in environment variables without encryption.

### 3.7 🟡 MEDIUM — Input Validation

The CSV/Excel import feature is a significant attack surface:
- No mention of input sanitization
- CSV injection (formula injection) risk
- Large file DoS
- Malicious XML in PatrimVen import/export

**Recommendation:** Implement strict input validation, file size limits, and sandboxed processing for imports.

---

## 4. Data Sovereignty

### 4.1 🟡 HIGH — Hosting Specifics Insufficient

Architecture mentions "Romanian Datacenter" with options: M247, Hosterion, GTS Telecom. Issues:

- **No contractual guarantees** mentioned for data residency
- **Kubernetes cluster** — who manages it? Self-managed K8s in a colo, or managed K8s?
- **MinIO** — where are document backups stored? If replicated to another region/country, this is a data transfer issue
- **Redis** — contains cached data potentially including PII. Must also be in Romania/EU
- **CI/CD (GitHub Actions)** — build artifacts and secrets pass through GitHub's infrastructure (US-based). Ensure no PII is in CI/CD pipelines.
- **Monitoring (Grafana)** — if using Grafana Cloud, data leaves Romania

**Recommendation:**
- Execute **Data Processing Agreements (DPA)** with all infrastructure providers
- Ensure all providers have GDPR adequacy or appropriate safeguards
- Document data flow map showing all locations where data is processed/stored
- For public institutions: check if **cloud hosting** is acceptable per Romanian law for fiscal data, or if on-premise/government cloud is required (HG 548/2018 regarding government cloud)

### 4.2 🟡 HIGH — Backup Strategy

PRD mentions "daily automatic backups, 90-day retention." Insufficient:

- **Where** are backups stored? Same DC? Different DC? Cross-border?
- **Encryption** of backups?
- **Tested restore procedure?**
- **Point-in-time recovery** — RPO of 1 hour means WAL archiving, not just daily backups
- **Backup access control** — who can access/restore backups?
- **Disaster recovery site** — single DC is a SPOF. Romanian law may require DR planning for public institution data.

---

## 5. Public Procurement Compliance

### 5.1 🔴 CRITICAL — SEAP Requirements

Selling to Romanian public institutions (primării) triggers **public procurement law** (Legea 98/2016, as amended):

| Threshold | Procedure | Implication |
|-----------|-----------|-------------|
| < 135,060 lei (~€27,000) | **Achiziție directă** (direct procurement) | Simplified, via SEAP catalog |
| 135,060 – 594,164 lei | **Procedură simplificată** | Published on SEAP, competitive |
| > 594,164 lei | **Licitație deschisă** | Full tender process |

For the "Comună" tier at 500-1,000 lei/month = 6,000-12,000 lei/year — **below direct procurement threshold**. This is the correct pricing strategy.

**However:**
- Even direct procurement must be done through **SEAP (Sistemul Electronic de Achiziții Publice)** — PrimărIA must be **registered as a supplier on SEAP** and list its offering in the SEAP electronic catalog
- Procurement must reference a **CPV code** (likely 72000000-5 "IT services" or 48000000-8 "Software packages")
- Framework agreements for multiple years require separate justification
- Annual subscriptions vs. multi-year contracts have different procurement implications

**Recommendation:**
- Register on SEAP (https://e-licitatie.ro) immediately
- List PrimărIA in the SEAP electronic catalog with correct CPV codes
- Prepare standard procurement documentation (caiet de sarcini, ofertă tehnică)
- Structure contracts as **annual subscription** to stay within direct procurement thresholds per year
- Consider obtaining **ISO 27001 certification** — increasingly required/preferred in public procurement

### 5.2 🟡 HIGH — Contract Requirements

Public institution contracts must include:
- **SLA guarantees** with penalties
- **Data ownership** clauses (primăria owns all data)
- **Exit strategy** — full data export in standard format upon contract termination
- **Escrow** provisions (source code escrow may be requested)
- **GDPR DPA** as annex to contract
- **Subcontractor disclosure**
- **Insurance** — professional liability insurance may be required

### 5.3 🟡 MEDIUM — MCID Funding Compatibility

To benefit from the MCID Digital Transformation program (200M lei):
- Software must meet **interoperability standards** per HG 908/2022
- Must demonstrate compliance with **National Interoperability Framework**
- MCID may have specific technical requirements for funded software
- Documentation in Romanian is essential

---

## 6. Missing Legislation & Tax Coverage

### 6.1 🟡 HIGH — Cod Fiscal Title IX Gaps (Detailed)

| Tax Type | Articles | Status in PrimărIA | Gap |
|----------|----------|-------------------|-----|
| Impozit clădiri (PF rezidențial) | Art. 457 | ✅ Covered | — |
| Impozit clădiri (PF nerezidențial) | Art. 458 | ✅ Covered | — |
| Impozit clădiri (PF mixt) | Art. 459 | ✅ Covered | — |
| Impozit clădiri (PJ) | Art. 460 | ⚠️ Partial | PJ uses inventory value, not surface-based. Data model has `valoare_inventar` but calculation flow unclear |
| Impozit teren intravilan | Art. 465 | ✅ Covered | — |
| Impozit teren extravilan | Art. 465 | ✅ Covered | — |
| Impozit mijloace transport | Art. 470 | ✅ Covered | Vehicle categories (Art. 470 tables I-II) not fully modeled |
| Taxa pt. certificat urbanism | Art. 474 | ❌ Missing | Common revenue source |
| Taxa pt. autorizație construire | Art. 474 | ❌ Missing | — |
| Taxa firmă (publicitate) | Art. 475 | ✅ Covered | — |
| Taxa reclamă/publicitate | Art. 477 | ❌ Missing | Distinct from taxa firmă |
| Taxa hotelieră | Art. 478 | ✅ Covered | — |
| Taxe spectacole | Art. 480 | ✅ Covered | — |
| Taxa utilizare domeniu public | Art. 486 | ✅ Covered | — |
| Taxa specială | Art. 484 | ❌ Missing | Councils create these ad-hoc |
| Alte taxe locale | Art. 486 | ⚠️ Generic | Needs configurable framework |

### 6.2 🟡 HIGH — Vehicle Tax Table Complexity

Art. 470 defines vehicle tax via **complex tables** based on:
- Engine capacity (cm³ brackets)
- Vehicle age
- Euro pollution norm (Euro 1-6 + non-Euro)
- Vehicle type (passenger, truck by tonnage, bus by seats, motorcycle)

L239/2025 changed these tables significantly. The `proprietati_vehicule` schema captures the attributes, but:
- No reference to **which table** in Art. 470 applies
- No handling of **electric vehicles** (exempt or reduced rate per Art. 470(2))
- No handling of **hybrid vehicles**
- **Heavy vehicles** (>12t) have different calculation (per axle combinations) — not modeled

### 6.3 🟡 MEDIUM — Bonificație (Early Payment Discount)

Art. 462(2) / Art. 467(2) / Art. 472(2): Councils may grant up to **10% discount** for full-year payment by March 31. This is a common and important feature — not mentioned in the architecture or data model.

**Recommendation:** Add `bonificatie_percent` to HCL decisions and implement in tax calculation flow.

### 6.4 🟡 MEDIUM — Multi-Property Surcharge

Art. 489(2): Councils **may** apply a surcharge of up to 500% for **abandoned/degraded buildings** (as of L239/2025, mandatory in some cases). No mechanism for this in the data model.

---

## 7. Digital Signatures

### 7.1 🔴 CRITICAL — Qualified Electronic Signatures Required

**Fiscal administrative acts** issued by public institutions (decizii de impunere, somații, titluri executorii, certificate de atestare fiscală) are **official administrative documents**. Per:

- **eIDAS Regulation (EU 910/2014)** + **Legea 455/2001** (electronic signature law): Documents with legal effect equivalent to paper must use **qualified electronic signatures (QES)**
- **Cod Procedură Fiscală Art. 46**: Actul administrativ fiscal must contain identification elements including **signature**
- **OUG 38/2020**: Accelerated use of electronic signatures in public administration

The architecture marks digital signatures as **P1 (Should Have)**. This is incorrect — for documents to have **legal validity**, QES is **P0**.

**Requirements:**
- Integration with a **qualified trust service provider** (QTSP) listed on EU trusted list: certSIGN, DigiSign, Trans Sped, AlfaTrust (Romanian QTSPs)
- **PAdES** (PDF Advanced Electronic Signatures) format for signed PDFs
- **Timestamp** from a qualified timestamp authority
- Batch signing capability (mass decision generation requires mass signing)
- Remote qualified electronic signature (cloud signing) for usability

**Recommendation:** Move digital signature to P0. Integrate with certSIGN or DigiSign API for remote QES. Budget for QTSP costs (typically per-signature or subscription).

### 7.2 🟡 HIGH — Document Signing for PatrimVen

PatrimVen XML uploads to ePatrim.ANAF.ro require **qualified digital certificate** authentication. The platform must:
- Support uploading/managing the institution's digital certificate
- Store certificates securely (HSM or encrypted storage, never in plaintext)
- Handle certificate expiry and renewal alerts

---

## 8. NIS2 Implications

### 8.1 🟡 HIGH — NIS2 Applicability Analysis

**NIS2 Directive (EU 2022/2555)**, transposed in Romania via **OUG 155/2024** (transposition of NIS2), applies to:

- **Essential entities**: Public administration entities at central level
- **Important entities**: Public administration entities at regional/local level

**PrimărIA as a SaaS provider to local public administrations likely falls under NIS2 as:**
1. **Digital infrastructure provider** (Annex I, Section 8) — providing SaaS to public entities
2. **ICT service management** (Annex II, Section 6) — managed service provider

**Primării themselves** are likely "important entities" under NIS2 as local public administration.

### 8.2 NIS2 Requirements Applicable to PrimărIA

| Requirement | NIS2 Article | Current Status | Gap |
|-------------|-------------|----------------|-----|
| Risk management measures | Art. 21 | Partial | No formal risk assessment documented |
| Incident handling | Art. 21(2)(b) | ❌ Missing | No incident response plan |
| Business continuity / DR | Art. 21(2)(c) | Partial | Basic backup, no DR plan |
| Supply chain security | Art. 21(2)(d) | ❌ Missing | No sub-processor security assessment |
| Security in procurement | Art. 21(2)(e) | ❌ Missing | No secure development lifecycle |
| Vulnerability handling | Art. 21(2)(e) | ❌ Missing | No vulnerability management process |
| Cyber hygiene / training | Art. 21(2)(g) | ❌ Missing | No security training plan |
| Cryptography | Art. 21(2)(h) | Partial | AES-256 mentioned, no key management |
| Access control | Art. 21(2)(i) | ✅ RBAC defined | — |
| MFA | Art. 21(2)(j) | Partial | TOTP optional, should be mandatory for staff |
| Incident reporting (24h/72h) | Art. 23 | ❌ Missing | No reporting procedure to DNSC |

**Recommendation:**
- Engage with **DNSC** (Directoratul Național de Securitate Cibernetică) for NIS2 compliance guidance
- Implement an **ISMS** (Information Security Management System) — consider ISO 27001 certification
- Mandatory 2FA for all staff roles
- Document incident response and reporting procedures (24h initial notification to DNSC, 72h detailed report)
- Implement vulnerability scanning and penetration testing program

---

## 9. Additional Findings

### 9.1 🟡 MEDIUM — Fiscal Secrecy (Secret Fiscal)

Cod Procedură Fiscală Art. 11 establishes **fiscal secrecy** — all tax information about taxpayers is confidential. This is **separate from and additional to GDPR**. Violations are criminal offenses.

- The citizen portal must ensure a citizen can ONLY see their own data (RLS handles this, but test thoroughly)
- API endpoints must be tested for **IDOR (Insecure Direct Object Reference)** — changing a UUID in URL to access another taxpayer's data
- Internal staff access should be **logged and auditable** (covered by audit logs)

### 9.2 🟡 MEDIUM — Accessibility Legal Requirements

**Directiva UE 2016/2102** (transposed by OUG 112/2018) requires public sector websites and applications to meet **WCAG 2.1 AA**. Since PrimărIA is used by public institutions and has a citizen portal, this is a **legal requirement**, not just nice-to-have.

PRD mentions WCAG 2.1 AA — ensure automated testing (axe-core) is in CI/CD pipeline.

### 9.3 🟡 MEDIUM — Romanian Language Requirements

**All fiscal documents** must be in Romanian (Constituția României Art. 13, Legea 178/1997). The i18n architecture correctly notes "Legal document generation: Romanian only." Ensure this cannot be accidentally changed by tenant configuration.

Hungarian and English for UI is fine and legally compliant (Law 215/2001 Art. 76 — local administration can use minority languages in areas with >20% minority population).

### 9.4 🟡 LOW — Insurance Requirements

Consider:
- **Professional liability insurance** (errors in tax calculation could cause financial harm)
- **Cyber insurance** (data breach costs)
- These may be required in public procurement contracts

---

## 10. Priority Action Items

### Immediate (Before Development)

| # | Finding | Severity | Section |
|---|---------|----------|---------|
| 1 | Fix SQL injection in RLS tenant context | 🔴 Critical | 3.1 |
| 2 | Conduct DPIA | 🔴 Critical | 1.2 |
| 3 | Move digital signatures to P0 | 🔴 Critical | 7.1 |
| 4 | Design CNP encryption properly | 🔴 Critical | 1.1 |
| 5 | Register on SEAP | 🔴 Critical | 5.1 |

### Before MVP Launch

| # | Finding | Severity | Section |
|---|---------|----------|---------|
| 6 | Complete PatrimVen form coverage | 🔴 Critical | 2.1 |
| 7 | Add missing tax types | 🟡 High | 2.2, 6.1 |
| 8 | Implement audit log integrity | 🟡 High | 3.5 |
| 9 | Define data retention matrix | 🟡 High | 1.3 |
| 10 | Implement consent management | 🟡 Medium | 1.7 |
| 11 | Enforce 2FA for staff | 🟡 High | 3.3 |
| 12 | Document incident response plan | 🟡 High | 8.2 |
| 13 | Add bonificație (early payment discount) | 🟡 Medium | 6.3 |
| 14 | Rate boundary validation | 🟡 High | 2.3 |

### Before Scale (100+ tenants)

| # | Finding | Severity | Section |
|---|---------|----------|---------|
| 15 | ISO 27001 certification | 🟡 High | 5.1, 8.2 |
| 16 | NIS2 full compliance | 🟡 High | 8.2 |
| 17 | DR site and tested procedures | 🟡 High | 4.2 |
| 18 | External audit log storage | 🟡 Medium | 3.5 |
| 19 | Penetration testing program | 🟡 Medium | 8.2 |
| 20 | Art. 30 processing register | 🟡 High | 1.4 |

---

*This review should be updated as the architecture evolves. A follow-up review is recommended after addressing Critical findings and before MVP deployment.*
