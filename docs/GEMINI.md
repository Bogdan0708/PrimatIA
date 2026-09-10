# PrimărIA — Instructional Context

This document provides foundational context, architectural mandates, and development workflows for the PrimărIA project. All AI interactions within this workspace must adhere to these guidelines.

## Project Overview
PrimărIA is a multi-tenant SaaS platform built with **Next.js 14 (App Router)** for managing local taxes in Romanian communes. It automates tax calculation (Buildings, Land, Vehicles), fiscal document generation, and mandatory PatrimVen XML exports.

### Tech Stack
- **Framework:** Next.js 14, TypeScript 5, Tailwind CSS, shadcn/ui.
- **Database:** PostgreSQL 16 with Row-Level Security (RLS), Prisma 6 ORM.
- **Infrastructure:** PgBouncer (Transaction Mode), Redis 7 (BullMQ), MinIO (Object Storage).
- **Auth:** NextAuth.js v5 (Staff), Custom JWT/Cookie (Citizen Portal), ROeID (OIDC).
- **AI/LLM:** Shared Gateway abstraction supporting GCP (Gemini), Anthropic, OpenAI, and LM Studio.
- **i18n:** `next-intl` (Romanian, Hungarian, English).

## Core Architectural Mandates

### 1. Multi-Tenancy & Data Isolation (RLS)
- **Database level:** Every tenant-scoped table has a `tenant_id` (UUID). Isolation is enforced by PostgreSQL RLS policies.
- **Application level:** Database queries **MUST** be wrapped in `withTenantContext` or `withTenantScope` (from `src/lib/tenant-context.ts`) to ensure the `app.current_tenant_id` session variable is set within the transaction.
- **Direct Queries:** Never use the raw `prisma` client directly for tenant data; use the scoped utility to prevent data leaks.

### 2. Tax Engine & Explanation
- **Legal Compliance:** Tax calculations must strictly follow **Cod Fiscal (L227/2015, Titlul IX)**.
- **Precision:** Use `Decimal` types for all currency and rate calculations.
- **Tax Explainer:** Core logic for reverse-engineering tax amounts into human-readable steps resides in `src/lib/tax-engine/tax-explainer.ts`.

### 3. AI Integration (Shared Config)
- **Provider Priority:** The system prioritizes the GCP-deployed AI Gateway if configured.
- **Configuration:** Always use `getLLMConfig` from `src/lib/ai/config.ts` to retrieve LLM settings.
- **Modules:** AI is used for the **RAG Chatbot** (`src/lib/ai/knowledge-base.ts`) and **Intelligent OCR** (`src/lib/ocr/document-processor.ts`).

### 4. Security & Privacy
- **CNP/CUI Encryption:** Sensitive identifiers (CNP) are encrypted at rest using AES-256-GCM (see `src/lib/crypto.ts`).
- **Audit Logging:** All CRUD operations must be logged to the `audit_logs` table. The UI supports paginated viewing for admins.
- **Input Validation:** Use Zod schemas for all API entry points (especially notifications and profile updates).

## Development Workflows

### Building & Running
- **Setup:** `npm install`
- **Infrastructure:** `docker compose up -d` (Postgres, Redis, MinIO)
- **Database:** `npm run db:migrate` then `npm run db:seed`
- **Dev Server:** `npm run dev` (available at localhost:3000)

### Testing
- **Runner:** Vitest
- **Command:** `npm test` or `npx vitest src/__tests__/ai/`
- **Requirement:** New logic or API changes **MUST** include comprehensive test cases in `src/__tests__/`.

### i18n
- **Translations:** Located in `src/messages/`.
- **Convention:** Use ICU message format. UI must support RO/HU/EN. For the chatbot, use translation keys for suggestions.

## Key Project Locations
- `src/app/[locale]/(authenticated)/`: Staff dashboard and management.
- `src/app/[locale]/portal/`: Citizen self-service portal.
- `src/lib/tax-engine/`: Automated tax calculation and explanation formulas.
- `src/lib/ai/`: Centralized AI configuration and RAG logic.
- `prisma/schema.prisma`: Source of truth for the data model.

## Key Commands
| Action | Command |
| :--- | :--- |
| **Sync DB Schema** | `npm run db:migrate` |
| **Regenerate Client**| `npm run db:generate` |
| **Run Tests** | `npm test` |
| **Type Check** | `npm run type-check` |
| **Audit Logs** | Accessible at `/admin/audit-log` (Staff UI) |
