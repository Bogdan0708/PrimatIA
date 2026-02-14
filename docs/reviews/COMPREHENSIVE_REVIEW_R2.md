# PrimarIA Comprehensive Code Review — Round 2

**Date:** 2026-02-14
**Reviewer:** Gemini CLI + Claude Opus (hybrid review)
**Scope:** All recent changes — pre-production readiness

---

## 1. Payment Webhook (src/app/api/payments/webhook/route.ts)

**Score: 8/10** ✅

### Strengths
- Proper Stripe signature verification with `constructEvent`
- `$transaction` wraps all DB writes atomically
- Atomic chitanță sequence via `INSERT ... ON CONFLICT ... RETURNING` (no race conditions)
- Server-side amount validation against actual debts (prevents tampered checkout amounts)
- Overpayment detection per impozit
- Idempotent: skips already-confirmed payments
- Handles expired + failed events properly

### Issues & Improvements
- **🐛 BUG (Medium):** Failed payment handler fetches ALL `initiated` payments and loops through them to match `paymentIntentId` in JSON. This is O(n) and will degrade at scale. Should store `paymentIntentId` as a separate indexed column, or at minimum use a `Prisma.JsonFilter`.
- **⚠️ Security:** `setTenantContext()` is called outside the transaction. If the tenant context affects RLS, this could be stale inside `$transaction`. Verify that `setTenantContext` sets a session variable that persists across the transaction connection.
- **⚠️ Missing:** No webhook replay protection. If Stripe retries a `checkout.session.completed` event and the first attempt partially failed (e.g., after creating `plata` but before creating `document`), the idempotency check (`status === "confirmed"`) won't catch it since the status wasn't updated yet. Consider using Stripe's event ID for deduplication.
- **💡 Improvement:** The debt validation queries happen OUTSIDE the transaction. A concurrent payment could modify `sumaPlatita` between validation and the transaction. Move validation inside `$transaction` with `FOR UPDATE` locks on the impozit rows.
- **💡 Improvement:** Return 200 for unhandled event types (currently does at the end, good), but the error responses for processing failures should still return 200 to prevent Stripe from retrying indefinitely on business logic errors.

---

## 2. Bank Transfer Confirmation (src/app/api/payments/bank-transfer/confirm/route.ts)

**Score: 8/10** ✅

### Strengths
- Auth check: only `admin` and `operator` roles
- Status validation: only processes `initiated` or `pending` payments
- Amount tolerance check (0.01)
- Full `$transaction` with atomic chitanță sequence (same pattern as webhook — good consistency)
- Records `confirmedBy` user ID in gateway response (audit trail)

### Issues & Improvements
- **⚠️ Security (Medium):** No CSRF protection. This is a state-changing POST endpoint — ensure Next.js middleware or the auth layer provides CSRF tokens.
- **⚠️ Missing:** No validation that the admin's tenant matches the payment's tenant. An admin from tenant A could theoretically confirm a payment belonging to tenant B if they know the `onlinePaymentId`. Add `onlinePayment.tenantId === session.user.tenantId` check.
- **💡 Improvement:** `bankReference` is not validated for format. Should at minimum check it's a non-empty string with reasonable length limits (prevent injection of huge strings into `gatewayResponse` JSON).
- **💡 Improvement:** Same concern as webhook — debt validation should happen inside the transaction. Currently not validated at all (trusts `selectedDebts` from original payment).
- **💡 DRY:** The payment distribution logic (create `plataDistributie`, update `impozit`, create `document`) is duplicated between webhook and bank-transfer. Extract to a shared `confirmPayment()` utility.

---

## 3. Chatbot (src/app/api/chatbot/route.ts)

**Score: 9/10** ✅

### Strengths
- In-memory rate limiter with periodic cleanup (10 req/min per IP)
- Input length validation (1000 chars max)
- Graceful degradation: keyword-based fallback when LM Studio is unavailable
- `AbortSignal.timeout(10_000)` — proper timeout on LLM calls
- History support with validation and cap (`MAX_HISTORY = 5`)
- Configurable model via `LM_STUDIO_MODEL` env var
- Good Unicode normalization for Romanian text matching (NFD + diacritic strip)

### Issues & Improvements
- **⚠️ Scaling:** In-memory rate limiter won't work with multiple instances/pods. Fine for single-server deployment but document this limitation. Consider Redis for multi-instance.
- **💡 Minor:** `setInterval` for cleanup runs forever. In serverless environments (Vercel), this interval would be recreated on each cold start. The `typeof setInterval` guard helps, but the map also grows unbounded between cleanups.
- **💡 Minor:** The `scoreEntry` function doesn't weight longer keyword matches higher. "impozit pe cladiri" and "impozit" would each count as 1 matched keyword, but the former is more specific.
- **💡 Security:** The history messages are passed directly to the LLM. While they're validated for shape, content injection is possible. Consider truncating individual history messages.

---

## 4. Payment Gateway Rename

**Score: 6/10** ⚠️

### Findings
- `src/lib/payments/payment-gateway.ts` still has `class GhiseulMockProvider` with `name = "ghiseul_mock"`
- **8 source files** still reference `ghiseul` in various forms (as legitimate payment method names like `ghiseul_ro`)
- The schema/validation uses `ghiseul_ro` as a payment method enum value — this is **correct** (Ghișeul.ro is a real government payment gateway)
- The `.next/` build cache has stale references (expected, rebuild fixes this)

### Issues
- **⚠️ Naming confusion:** The mock provider class is named `GhiseulMockProvider` but it mocks a generic gateway, not specifically Ghișeul.ro. If the rename was meant to generalize the gateway abstraction, the mock should be `MockGatewayProvider` or similar.
- **⚠️ DB field:** `ghiseulRoRef` column name in `Plata` table is used for all gateway references (Stripe, bank transfers, etc.), not just Ghișeul.ro. Should be renamed to `gatewayRef` or `externalRef` to avoid confusion. This requires a migration.
- **💡 Recommendation:** If the intent was to rename away from "ghiseul-mock" to something generic, the job is incomplete. The class, field name, and test references need updating.

---

## 5. Budget Codes (prisma/schema.prisma + seed)

**Score: 8/10** ✅

### Strengths
- Clean model: UUID PK, unique `code`, `parentCode` for hierarchy
- Proper index on `[category, isActive]`
- `@@map("budget_codes")` — good DB naming convention
- Seed uses `upsert` — idempotent re-runs

### Issues & Improvements
- **💡 Missing:** No foreign key from `parentCode` to self (`code`). This means orphan parent codes won't be caught by the DB. Add a self-referential relation or validate in application code.
- **💡 Missing:** No `tenantId` — budget codes appear to be global. If different communes have different budget code structures (unlikely but possible), this could be a problem.
- **💡 Seed data:** Only 8 budget codes seeded. The Romanian budget classification has dozens of relevant codes (16.02.50 — alte taxe pe utilizare, 11.02.07 — taxe hoteliere, etc.). This is minimal but functional for MVP.
- **💡 Missing:** No relation to `Impozit` or `TaxRateTable`. The budget codes exist in isolation — they should eventually link to tax types for automated reporting.

---

## 6. Somație Template (src/lib/documents/templates/somatie.tsx)

**Score: 9/10** ✅

### Strengths
- Correct legal basis: Art. 226-228 Legea 207/2015 (Codul de Procedură Fiscală)
- Proper 15-day payment deadline per CPF
- Complete legal text for Art. 226, 227, 228 — accurately quoted
- Debt table with debit/penalități/total breakdown
- Property listing for enforcement (bunuri identificate)
- Consequences section (poprire, sechestru, executare silită)
- Appeal rights mentioned (contestație, Art. 260-261, 15 days)
- QES placeholder for electronic signature (eIDAS compliant)
- CNP masking for privacy

### Issues & Improvements
- **💡 Missing:** No explicit interest/penalty breakdown calculation shown. The template receives `sumaPenalitati` but doesn't show the rate (0.02%/day for interest per Art. 174, 0.01%/day for penalties per Art. 176). Would be more transparent to show the calculation.
- **💡 Legal:** Art. 228 quote could be more precise — the actual article has more nuance about execution priority and limits. Current text is a reasonable summary but not verbatim.
- **💡 Missing:** No "data comunicării" field — this is legally critical as it starts the 15-day countdown. The template has `data.documentDate` and `data.termenPlata` but should explicitly state how communication date is determined (receipt confirmation, postal date, etc.).

---

## 7. Rate Comparison Dashboard (comparatie-taxe/)

**Score: 7/10** ✅

### Strengths
- `requireAdmin()` — proper admin-only access
- Compares last two HCL decisions automatically
- Shows percentage change between years
- Graceful handling of < 2 HCL decisions (shows "no data" message)
- Uses composite key for rate matching (`taxType|category|zona`)

### Issues & Improvements
- **⚠️ Bug (Medium):** If a rate exists in the current year but not the previous, `prevRate` is 0 and `changePercent` is `null`. But if a rate was removed (exists in prev, not in curr), `currRate` is 0 — this could be confusing. Should flag deleted rates distinctly.
- **💡 Missing:** No filtering by tax type or zone. For a commune with many rate entries, the table could be overwhelming.
- **💡 Missing:** No export (CSV/PDF) functionality for council presentations.
- **💡 Missing:** Hardcoded "last two" — admin should be able to select which two years to compare.
- **💡 Missing:** No highlighting of rates that exceed legal maximums (Cod Fiscal defines max rates for most taxes).

---

## 8. Tax Engine — Vehicle & Building Tax

**Score: 9/10** ✅

### Strengths
- **Truck calculator:** Full Art. 470 axle-weight tables for C2/C3/C4 with pneumatic/other suspension
- **Trailer calculator:** Full R1/R2/R3/R4 axle-weight tables
- **PJ building tax:** Correct revaluation-date logic (Art. 460) — 1% if ≤3 years, 1.5% if 3-5 years, 5% penalty if >5 years
- **Zone multipliers:** Commune rank 0-5 with correct multipliers per Art. 457
- **Euro norm adjustments:** Non-Euro through Euro 6 with surcharge/discount factors
- **Partial year proration:** Month-based calculation
- **Exemptions:** Percentage-based, capped at full tax amount
- **Bonificație & installments:** Proper split into rata1/rata2
- **Legacy fallback:** Truck/trailer gracefully fall back to DB rates if axle data missing

### Issues & Improvements
- **⚠️ Data accuracy:** R4_pneumatic 29-31 tons = 513 lei, but 31-33 tons = 510 lei — tax DECREASES as weight increases. This looks like a data entry error. Verify against the actual Cod Fiscal table.
- **💡 Missing:** No validation that `masaTotalaKg` is positive or reasonable (e.g., a truck shouldn't be 500,000 kg).
- **💡 Missing:** Motorcycle tax should also consider Euro norm (Art. 470 mentions this).
- **💡 Testing:** The weight tables are exported for testing — good. But I don't see corresponding tests in the repo.

---

## 9. Number-to-Words (src/lib/formatting/number-to-words.ts)

**Score: 8/10** ✅

### Strengths
- Correct Romanian feminine forms: "una sută", "două sute", "o mie", "două mii"
- Handles millions: "un milion", "două milioane"
- Proper "de" connector: "un milion de lei"
- Lei/bani suffix with proper grammar
- Handles zero, negative numbers, bani-only
- Good test coverage

### Issues & Improvements
- **🐛 BUG (Minor):** `numberToWordsRo(1)` returns "unu lei" but correct Romanian is "un leu" (singular). Similarly, "doi lei" should technically be... actually "doi lei" is correct plural. But "unu lei" is grammatically wrong — it should be "un leu".
- **🐛 BUG (Minor):** For bani, `numberToWordsRo(0.01)` would return "una bani" — should be "un ban" (singular).
- **💡 Grammar:** Hundreds chunk doesn't use "și" connector between hundreds and tens/units (e.g., "o sută cincizeci" is acceptable but "o sută și cincizeci" is sometimes preferred in formal Romanian). Both forms are used in practice, so this is stylistic.
- **💡 Missing:** No support for billions (miliarde). Unlikely for tax amounts but would be needed for national-level reporting.

---

## 10. Seed Data (prisma/seed/)

**Score: 7/10** ✅

### Strengths
- Rate values generally match Art. 470 Cod Fiscal base rates
- Uses `legalArticle` references for each rate (good traceability)
- `minRate`/`maxRate` fields to define legal bounds
- Idempotent: deletes existing rates before re-seeding
- HCL decision metadata: number, date, inflation index, validity period

### Issues & Improvements
- **⚠️ Data concern:** Only vehicle rates shown in the seed snippet. Are building and land tax rates also seeded?
- **⚠️ Accuracy:** The vehicle rates (8 lei/200cc for sub-1600) match Art. 470 base rates but HCLs typically increase these. The seed should note these are base/minimum rates.
- **💡 Missing:** The `inflationIndex: 1.054` (5.4% for 2025) should be sourced and documented. INS publishes the official index.
- **💡 Missing:** No seed for penalties/interest rates (Art. 174-176). These are also configured by law (0.02%/day interest, 0.01%/day penalty) and should be in the rate tables.
- **💡 Missing:** Budget codes seed only has 8 entries — see area 5 above.
- **💡 Missing:** No test data for multiple tenants/communes to verify multi-tenancy works correctly.

---

## Overall Summary

| # | Area | Score | Status |
|---|------|-------|--------|
| 1 | Payment Webhook | 8/10 | ✅ Good — move validation inside tx |
| 2 | Bank Transfer Confirm | 8/10 | ✅ Good — add tenant check |
| 3 | Chatbot | 9/10 | ✅ Excellent |
| 4 | Gateway Rename | 6/10 | ⚠️ Incomplete — field naming inconsistent |
| 5 | Budget Codes | 8/10 | ✅ Good — needs relations |
| 6 | Somație Template | 9/10 | ✅ Excellent legal accuracy |
| 7 | Rate Comparison | 7/10 | ✅ Functional — needs UX polish |
| 8 | Tax Engine | 9/10 | ✅ Excellent — check R4 data |
| 9 | Number-to-Words | 8/10 | ✅ Good — singular forms buggy |
| 10 | Seed Data | 7/10 | ✅ Minimal but correct |

### **Overall Score: 7.9/10** ✅

### Verdict: **READY FOR STAGING, NOT YET FOR PRODUCTION**

**Critical items before production:**
1. Fix tenant isolation in bank-transfer confirm (security)
2. Move debt validation inside transactions (race condition)
3. Fix "unu lei" → "un leu" singular form (user-facing)
4. Verify R4 weight table data (510 vs 513 anomaly)
5. Rename `ghiseulRoRef` to `gatewayRef` (tech debt, migration needed)

**Nice-to-haves:**
- Extract shared payment confirmation logic (DRY)
- Add Stripe event ID deduplication
- Expand budget code seed data
- Add rate comparison filtering + export
- Add interest rate breakdown to somație

---

*Review generated 2026-02-14 by Claude Opus 4.6 with manual file inspection.*
