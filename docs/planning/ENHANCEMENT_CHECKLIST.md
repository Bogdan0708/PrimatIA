# PrimarIA Enhancement Checklist
**Created:** 2026-02-14 | **Status:** In Progress

## Execution Order (Smart Priority)

### 🔴 Phase 1: Payment Infrastructure (Highest Business Value)
- [ ] **1.1 Stripe Integration** — Replace mock gateway with real Stripe Checkout
  - Agent: Claude Code
  - Files: portal/plati/, api/payments/, lib/stripe.ts
  - Includes: webhook handler, auto-update Plata records, chitanță generation
- [ ] **1.2 Bank Transfer with Auto-Reference** — Generate unique payment ref per taxpayer
  - Agent: Claude Code (same session as 1.1)
  - Display bank details + reference code, import reconciliation later

### 🟡 Phase 2: AI Quick Wins (Biggest Differentiator)
- [ ] **2.1 AI Chatbot Widget** — Citizen portal chat answering tax questions in Romanian
  - Agent: Codex
  - RAG over tax regulations, FAQ, fee schedules
  - LM Studio / API for generation, embedded widget on portal
- [ ] **2.2 Auto Report Generation** — Monthly tax collection summaries
  - Agent: Codex  
  - Prisma aggregation queries, PDF/HTML output, email to staff

### 🟢 Phase 3: Compliance & Intelligence
- [ ] **3.1 Taxpayer Compliance Score** — Green/yellow/red rating per taxpayer
  - Weighted: payment timeliness (40%), completeness (25%), consistency (20%), disputes (15%)
  - Display on contribuabil detail page + dashboard
- [ ] **3.2 Payment Anomaly Detection** — Flag unusual patterns
  - Statistical rules: duplicate payments, amounts outside normal range, missing declarations
  - Alert in dashboard + optional email notification

### 🔵 Phase 4: Document Intelligence  
- [ ] **4.1 OCR Document Intake** — Scan property docs/IDs → auto-fill forms
  - Tesseract/PaddleOCR + LM Studio for field extraction
- [ ] **4.2 Auto-Generated Official Documents** — One-click certificat fiscal, decizie impunere
  - Wire existing templates to actual data, generate PDF

### ⚪ Phase 5: Advanced Features
- [ ] **5.1 Revenue Forecasting Dashboard** — Predict next quarter's collections
- [ ] **5.2 Natural Language Search** — Search regulations in plain Romanian
- [ ] **5.3 Bank Reconciliation** — Import CSV statements, auto-match to plăți
- [ ] **5.4 ROeID Integration** — National digital identity for citizen login

---

## Review Protocol
After each phase: spawn Gemini to review code quality, security, and completeness.
