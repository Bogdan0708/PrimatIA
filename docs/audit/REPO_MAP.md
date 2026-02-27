# PrimărIA — Repository Map

> Generated: 2026-02-27 | Audit scope: backend, auth, DB, payments, AI, compliance

## Component Inventory

| Component | Location | Purpose |
|-----------|----------|---------|
| **Next.js App Router** | `src/app/` | SSR pages + API routes |
| **Staff Admin Portal** | `src/app/[locale]/(authenticated)/` | Tax admin UI (NextAuth) |
| **Citizen Portal** | `src/app/[locale]/portal/` | Self-service taxpayer UI (custom JWT) |
| **API Routes** | `src/app/api/` | 33 route handlers |
| **Tax Engine** | `src/lib/tax-engine/` | Building, land, vehicle tax calculation |
| **AI Gateway Client** | `src/lib/ai/` | RAG chatbot, anomaly detection, forecasts |
| **Payment System** | `src/lib/payments/` + `src/app/api/payments/` | Stripe + bank transfer + cash |
| **Document Generator** | `src/lib/documents/` | PDF receipts, certificates, decisions |
| **OCR Processor** | `src/lib/ocr/` | Document text extraction |
| **Database (Prisma)** | `prisma/schema.prisma` | 36 models, PostgreSQL 16, RLS |
| **Tenant Isolation** | `src/lib/db.ts` | AsyncLocalStorage + Proxy for RLS context |
| **Auth (Staff)** | `src/lib/auth.ts` | NextAuth v5, JWT strategy |
| **Auth (Citizens)** | `src/lib/portal-auth.ts`, `src/lib/citizen-auth.ts` | Custom JWT (jose) |
| **Validation** | `src/lib/validations.ts` | Zod schemas for all entities |
| **i18n** | `src/messages/{ro,en,hu}.json` | 3 locales, next-intl |
| **Docker/Deploy** | `Dockerfile`, `deploy/deploy.sh` | Multi-stage Docker, GCP Cloud Run |
| **Tests** | `src/__tests__/` | Vitest (tax engine, AI, payments, formatting) |

## Key Entrypoints

| Entrypoint | File | Auth |
|------------|------|------|
| Staff login | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth Credentials |
| Citizen login | `src/app/api/portal/auth/login/route.ts` | Custom JWT |
| Citizen register | `src/app/api/portal/auth/register/route.ts` | Public |
| Record payment (admin) | `src/app/api/plati/record/route.ts` | Staff session |
| Initiate payment (citizen) | `src/app/api/portal/payments/initiate/route.ts` | Citizen JWT |
| Stripe webhook | `src/app/api/payments/webhook/route.ts` | Stripe signature |
| Bank transfer confirm | `src/app/api/payments/bank-transfer/confirm/route.ts` | Staff session |
| Document generate | `src/app/api/documents/generate/route.ts` | Staff session |
| Document download | `src/app/api/documents/[id]/download/route.ts` | Staff or citizen |
| Chatbot | `src/app/api/chatbot/route.ts` | Public (rate-limited) |
| Tax explain (AI) | `src/app/api/portal/taxes/[id]/explain/route.ts` | Citizen JWT |
| Certificate request | `src/app/api/portal/certificates/route.ts` | Citizen JWT |
| Health check | `src/app/api/health/route.ts` | Public |

## Hot Paths

### Path 1: Citizen views liabilities → pays online → receives receipt

```
1. POST /api/portal/auth/login          → citizen-token cookie
2. GET  /api/portal/debts               → outstanding taxes list
3. POST /api/portal/payments/initiate   → Stripe checkout URL
4.     → Citizen completes Stripe checkout
5. POST /api/payments/webhook           → Stripe calls back
   └─ withTenantScope() transaction:
      ├─ Lock OnlinePayment + Impozit rows (FOR UPDATE)
      ├─ Validate amounts, generate CHT-YYYY-NNNNNN
      ├─ Create Plata + PlataDistributie records
      ├─ Update Impozit.sumaPlatita & status
      └─ Create Document (chitanta) record
6. GET  /api/documents/[id]/download    → presigned MinIO URL
```

### Path 2: Admin records cash payment → auto-distributes → receipt

```
1. POST /api/auth (NextAuth)            → next-auth.session-token
2. POST /api/plati/record               → requireStaff()
   ├─ setTenantContext(tenantId)
   ├─ Validate contribuabil exists
   ├─ Create Plata record
   └─ distributePayment():
      ├─ Fetch outstanding taxes (oldest first)
      ├─ Apply penalties first, then principal
      ├─ Create PlataDistributie records
      └─ Update Impozit status
3. POST /api/documents/generate         → generate chitanta PDF
4. GET  /api/documents/[id]/download    → presigned MinIO URL
```

### Path 3: Admin creates/edits asset → tax recalculation

```
1. Server action: createCladire()       → requireAdmin()
   ├─ Validate via Zod schema (cladireSchema)
   ├─ withTenantScope(tenantId)
   ├─ Create/update ProprietateCladire
   └─ AuditLog entry
2. Server action: calculateTaxes()
   ├─ resolveActiveHcl(tenantId, fiscalYear)
   ├─ getApplicableExemptions(contribuabilId)
   └─ calculateAllTaxesForContribuabil()
      ├─ building-tax.ts → Decimal calculations
      ├─ land-tax.ts     → per-hectare rates
      └─ vehicle-tax.ts  → Euro norm brackets
3. Impozit records created/updated with calculated amounts
```

### Path 4: Citizen uses chatbot

```
1. POST /api/chatbot (stream=true)      → Rate-limited (15/min middleware)
   ├─ Parse message + history
   ├─ streamLLMResponse():
   │  ├─ retrieveContext() → keyword search regulations + FAQ
   │  ├─ Build prompt with <context>/<user_query> XML delimiters
   │  ├─ Stream via OpenAI-compatible API (Gateway/LM Studio/OpenAI)
   │  ├─ Sanitize HTML from chunks
   │  └─ Fallback to keyword search if empty stream
   └─ SSE response with sanitized chunks
```

## Database Models (36 total)

| Domain | Models |
|--------|--------|
| **Tenancy** | Tenant, TenantUser |
| **Citizens** | CitizenUser, CitizenContribuabilLink, PasswordResetToken |
| **Geography** | Adresa, ZonaFiscala |
| **Tax Registry** | TaxTypeRegistry (global), BudgetCode (global) |
| **Taxpayers** | Contribuabil, ProprietateDetinator |
| **Properties** | ProprietateCladire, ProprietateTeren, ProprietateVehicul |
| **Tax Rules** | HclDecision, TaxRateTable, ScutireRegula, ScutireContribuabil |
| **Tax Liabilities** | Impozit, Penalitate |
| **Payments** | Plata, PlataDistributie, OnlinePayment, ChitantaSequence |
| **Documents** | Document, Somatie, SomatieImpozit |
| **Portal** | CertificateRequest, Notificare, ContactMessage, Consimtamant |
| **Import/Audit** | ImportBatch, ImportRowLedger, AuditLog, ExportJob |
| **Integration** | PatrimvenCodeMapping |

## Infrastructure

- **Runtime**: Node 20 Alpine (Docker), GCP Cloud Run
- **Database**: PostgreSQL 16 + PgBouncer (transaction mode)
- **Storage**: MinIO (S3-compatible) for documents
- **Cache**: Redis 7 (BullMQ job queue)
- **Secrets**: GCP Secret Manager
- **AI**: AI Gateway (Gemini/OpenAI/Claude) or LM Studio (local)
- **Payments**: Stripe (checkout sessions + webhooks)
