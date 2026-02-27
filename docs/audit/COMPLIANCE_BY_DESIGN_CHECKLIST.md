# PrimărIA — Compliance-by-Design Checklist (Engineering View)

> Generated: 2026-02-27
> Disclaimer: This is an engineering assessment, not legal advice. Each item marked NEEDS LEGAL CONFIRMATION must be validated with legal counsel familiar with Romanian local tax administration law.

## Status Legend

| Status | Meaning |
|--------|---------|
| IMPLEMENTED | Engineering control fully in place |
| PARTIAL | Some controls exist, gaps identified |
| MISSING | No engineering control exists |
| NEEDS LEGAL CONFIRMATION | Engineering cannot determine if requirement applies or if implementation is sufficient |

---

## 1. Financial Traceability & Immutability

| # | Requirement | Status | Evidence / Gap |
|---|-------------|--------|----------------|
| 1.1 | Every payment must produce a unique, sequential receipt number | PARTIAL | `ChitantaSequence` provides atomic numbering (CHT-YYYY-NNNNNN) in webhook and bank-transfer paths. **Gap**: `/api/plati/record` (admin cash) does not auto-generate receipt numbers — relies on optional client input. |
| 1.2 | Payment records must be immutable (no DELETE, no UPDATE of amount) | PARTIAL | `Plata` model has no `deletedAt` field (cannot soft-delete). **Gap**: No DB constraint prevents `UPDATE` of `suma` after creation. Application logic doesn't update amounts, but no DB-level guard. |
| 1.3 | Payment reversals / corrections must be append-only (storno records) | MISSING | No storno/reversal model exists. If a payment is recorded incorrectly, there is no defined correction flow. |
| 1.4 | All payment distributions must be traceable to individual tax liabilities | IMPLEMENTED | `PlataDistributie` links each `Plata` to specific `Impozit` records with `sumaDebit` and `sumaPenalitati` splits. |
| 1.5 | Receipt document must contain: issuing authority, date, amount, taxpayer, sequential number, items paid | IMPLEMENTED | `ChitantaPDF` template includes tenant info, contribuabil info, date, amount (in digits and words), receipt number, line items from `PlataDistributie`. |
| 1.6 | Tax decisions must be sequentially numbered and reproducible | PARTIAL | `Document` model stores `numarDocument` and `dataJson` for re-rendering. **Gap**: Document number generation in `generateChitanta()` uses COUNT query (race condition), not atomic sequence. |

**NEEDS LEGAL CONFIRMATION**: Whether the current receipt format meets requirements of Ordin MFP 2634/2015 (chitanțe fiscale). Whether electronic receipts require a specific signature/seal format.

---

## 2. Document Numbering & Registers

| # | Requirement | Status | Evidence / Gap |
|---|-------------|--------|----------------|
| 2.1 | Receipts (chitanțe) must have uninterrupted sequential numbering per fiscal year | PARTIAL | Atomic sequence via `ChitantaSequence` exists but only used in webhook/bank-confirm paths. Admin cash payment path has gap. |
| 2.2 | Tax decisions (decizii de impunere) must be sequentially numbered | PARTIAL | `getNextDocumentNumber()` uses `COUNT + 1` — not gap-free or atomic. |
| 2.3 | Enforcement notices (somații) must be numbered and tracked | IMPLEMENTED | `Somatie` model has `numar`, `dataEmitere`, `status`, and communication tracking. |
| 2.4 | Certificates (certificate de atestare fiscală) must be numbered | PARTIAL | `Document` model stores `numarDocument` but same race-condition issue as 2.2. |
| 2.5 | A register of all issued documents must be maintained | IMPLEMENTED | `Document` table serves as the document register with type, number, date, status, and contribuabil. |

**NEEDS LEGAL CONFIRMATION**: Whether gap-free numbering is legally required (it typically is for chitanțe). Whether separate numbering series are needed per document type. Whether the digital register satisfies requirements of OMFP 2634/2015.

---

## 3. Cashier Sessions & Daily Closing

| # | Requirement | Status | Evidence / Gap |
|---|-------------|--------|----------------|
| 3.1 | Cash payments must be attributable to the registering operator | IMPLEMENTED | `Plata.inregistratDeId` FK tracks which `TenantUser` recorded the payment. |
| 3.2 | Daily cash register closing (borderou de încasări) | PARTIAL | `BordeRouIncasariPDF` template exists for generating daily collection summaries. **Gap**: No automatic daily closing workflow; no enforcement that all cash is accounted for. |
| 3.3 | Cashier session start/end with opening/closing balances | MISSING | No cashier session model. No opening balance, no closing reconciliation, no session-level totals. |
| 3.4 | Multiple cashiers must have separate registers | MISSING | No per-operator session isolation. Borderou can be filtered by operator but no formal separation. |

**NEEDS LEGAL CONFIRMATION**: Whether local tax offices are required to implement formal cashier sessions (per OMFP 2634/2015 or local practice). Whether an electronic borderou de încasări is sufficient or paper is required.

---

## 4. Tax Calculation & Assessment

| # | Requirement | Status | Evidence / Gap |
|---|-------------|--------|----------------|
| 4.1 | Tax rates must be based on current HCL decisions | IMPLEMENTED | `resolveActiveHcl()` finds the active HCL for the fiscal year. `TaxRateTable` stores rates per decision. |
| 4.2 | Tax calculations must follow Cod Fiscal L227/2015 Titlul IX | IMPLEMENTED | Tax engine modules implement the formulas. **Separate audit needed by Codex agent for edge cases.** |
| 4.3 | Proration by months owned must be supported | IMPLEMENTED | All tax modules calculate `nrLuni` based on `dataDobandire`/`dataInstrainare`. |
| 4.4 | Exemptions must have legal basis and approval workflow | PARTIAL | `ScutireRegula` has `legalBasis` field. `ScutireContribuabil` has `approvedById`/`approvedAt`. **Gap**: No dual-approval or supervisor review for exemption grants. |
| 4.5 | Tax decisions must be sent to taxpayers | PARTIAL | `Document` and `Notificare` models support generation and notification. **Gap**: No tracking that a decizie was actually delivered/acknowledged. |
| 4.6 | Early payment bonuses (bonificații) must follow legal limits | IMPLEMENTED | `Impozit.bonificatie` stores the applied bonus. Engine calculates per HCL rates. |

**NEEDS LEGAL CONFIRMATION**: Whether bonificație percentages are set by each local council (HCL) or have a national maximum. Whether exemptions require specific approval workflows per Cod Fiscal Art. 456.

---

## 5. Payment Distribution Rules

| # | Requirement | Status | Evidence / Gap |
|---|-------------|--------|----------------|
| 5.1 | Payments must be applied to oldest debts first (per Cod Procedură Fiscală) | IMPLEMENTED | `distributePayment()` orders by `fiscalYear ASC, rata1Scadenta ASC`. |
| 5.2 | Penalties must be collected before principal (per fiscal code) | IMPLEMENTED | Distribution logic applies to penalties first, then principal. |
| 5.3 | Overpayment must be handled (credit or refund) | PARTIAL | `distributePayment()` returns remainder amount. **Gap**: No credit balance model, no refund workflow, no carry-forward to future periods. |
| 5.4 | Installment deadlines (rate) must be tracked | IMPLEMENTED | `Impozit.rata1`, `rata1Scadenta`, `rata2`, `rata2Scadenta` fields. |

**NEEDS LEGAL CONFIRMATION**: Whether the specific penalty-before-principal ordering matches current Cod Procedură Fiscală Art. 165-167. How overpayments should be handled per local practice.

---

## 6. Penalties & Enforcement

| # | Requirement | Status | Evidence / Gap |
|---|-------------|--------|----------------|
| 6.1 | Late payment penalties must accrue automatically | PARTIAL | `penalty.ts` module calculates penalties. `Penalitate` model stores calculations with unique constraint `(tenantId, impozitId, dataCalcul)`. **Gap**: No automated daily/monthly job runs this. |
| 6.2 | Enforcement notices (somații) must precede any forced execution | IMPLEMENTED | `Somatie` model with workflow: emis → comunicata → (partial_platita | platita | executare). |
| 6.3 | Somație must have a payment deadline (termen) | IMPLEMENTED | `Somatie.termenPlata` field. |
| 6.4 | Communication of somație must be tracked | IMPLEMENTED | `dataComunicare`, `modalitateComunicare`, `confirmarePrimire` fields. |

**NEEDS LEGAL CONFIRMATION**: Penalty interest rate and accrual method per current Cod Procedură Fiscală (changes periodically). Whether email notification counts as legal communication of somație.

---

## 7. Data Privacy (GDPR Basics)

| # | Requirement | Status | Evidence / Gap |
|---|-------------|--------|----------------|
| 7.1 | Personal data (CNP) must be encrypted at rest | IMPLEMENTED | CNP encrypted with AES-256-GCM in `Contribuabil.cnp` (BYTEA). Hashed per-tenant for lookups (`cnpHash`). |
| 7.2 | CNP must be masked in outputs | IMPLEMENTED | `decryptCnp()` shows only last 4 digits in documents (`*********1234`). |
| 7.3 | Consent for electronic communication must be tracked | IMPLEMENTED | `Consimtamant` model per contribuabil per channel (email/sms/in_app) with dates and IP. |
| 7.4 | Data retention policies must be defined | MISSING | No automatic data purge or archival mechanism. No configurable retention periods. |
| 7.5 | Right to access (Art. 15 GDPR) | PARTIAL | Citizen portal shows own data. **Gap**: No formal DSAR (Data Subject Access Request) export. |
| 7.6 | Right to rectification (Art. 16 GDPR) | PARTIAL | Citizens cannot self-edit; must contact admin. Admin can edit via staff portal. |
| 7.7 | Right to erasure (Art. 17 GDPR) | PARTIAL | Soft delete exists but fiscal data has mandatory retention periods that conflict with erasure. **Gap**: No mechanism to distinguish between "must retain for legal obligation" and "can erase". |
| 7.8 | PII must not appear in application logs | PARTIAL | No structured log redaction. `console.error` calls in payment flows could log metadata containing PII. |
| 7.9 | AI chatbot must not retain PII from conversations | PARTIAL | Conversations are not persisted. **Gap**: LLM provider may log prompts server-side. No PII scrubbing before sending to AI gateway. |

**NEEDS LEGAL CONFIRMATION**: Data retention periods for fiscal records (typically 5-10 years per Romanian fiscal code). Whether the current consent tracking model satisfies GDPR Art. 7. Whether the AI gateway data processing agreement (DPA) is in place.

---

## 8. Citizen Access & Self-Service

| # | Requirement | Status | Evidence / Gap |
|---|-------------|--------|----------------|
| 8.1 | Citizens must be able to view their tax liabilities | IMPLEMENTED | `/api/portal/debts` and `/api/portal/taxes` endpoints. |
| 8.2 | Citizens must be able to pay online | IMPLEMENTED | Stripe checkout via `/api/portal/payments/initiate`. |
| 8.3 | Citizens must be able to request fiscal certificates | IMPLEMENTED | `/api/portal/certificates` with status tracking. |
| 8.4 | Citizens must be verified against existing taxpayer records | IMPLEMENTED | Registration matches by CNP hash or CUI to `Contribuabil`. |
| 8.5 | Access logs for citizen data must be maintained | PARTIAL | `AuditLog` table exists. **Gap**: Not used for citizen data access events (views, downloads). |

**NEEDS LEGAL CONFIRMATION**: Whether citizen portal access satisfies requirements of OUG 38/2020 (Ghișeul.ro compatibility). Whether a specific identity verification level is required (eIDAS, ROeID).

---

## 9. Multi-Tenancy & Isolation

| # | Requirement | Status | Evidence / Gap |
|---|-------------|--------|----------------|
| 9.1 | Each municipality's data must be completely isolated | IMPLEMENTED | PostgreSQL RLS policies + `tenant_id` on all scoped tables + `withTenantScope()` / `setTenantContext()`. |
| 9.2 | Staff from one municipality cannot access another's data | IMPLEMENTED | JWT contains `tenantId`; all queries filter by it; RLS enforces at DB level. |
| 9.3 | Citizens are scoped to their municipality | IMPLEMENTED | `CitizenUser` has `tenantId`; login resolves tenant from env or header. |

---

## 10. Audit Trail

| # | Requirement | Status | Evidence / Gap |
|---|-------------|--------|----------------|
| 10.1 | All data changes must be logged with who/when/what | PARTIAL | `AuditLog` model exists with `action`, `entityType`, `entityId`, `oldValues`, `newValues`, `userId`, `createdAt`. **Gap**: Not populated for all operations (payments, tax calculations). |
| 10.2 | Audit logs must be immutable | PARTIAL | No `deletedAt` on `AuditLog`. **Gap**: No DB constraint prevents DELETE/UPDATE. |
| 10.3 | Audit logs must include IP address and user agent | IMPLEMENTED | `AuditLog` has `ipAddress` and `userAgent` fields. |
| 10.4 | Financial operations must have complete audit trail | MISSING | Payment creation, distribution, and status changes are not logged to `AuditLog`. |

**NEEDS LEGAL CONFIRMATION**: Whether Romanian fiscal audit requirements mandate specific retention periods for audit logs. Whether electronic audit trails satisfy Curtea de Conturi (Court of Auditors) inspection requirements.

---

## Summary

| Category | IMPLEMENTED | PARTIAL | MISSING |
|----------|:-----------:|:-------:|:-------:|
| Financial Traceability | 2 | 3 | 1 |
| Document Numbering | 2 | 3 | 0 |
| Cashier Sessions | 1 | 1 | 2 |
| Tax Calculation | 4 | 2 | 0 |
| Payment Distribution | 2 | 1 | 0 |
| Penalties & Enforcement | 2 | 1 | 0 |
| Data Privacy (GDPR) | 3 | 5 | 1 |
| Citizen Access | 4 | 1 | 0 |
| Multi-Tenancy | 3 | 0 | 0 |
| Audit Trail | 1 | 2 | 1 |
| **TOTAL** | **24** | **19** | **5** |
