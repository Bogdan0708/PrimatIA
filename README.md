# PrimărIA — Sistem Integrat de Administrare a Impozitelor și Taxelor Locale

*Prototip de platformă SaaS pentru administrarea impozitelor și taxelor locale în comunele din România*

---

> **Project status:** PrimărIA is a portfolio/pilot project. There is no current
> public deployment, no municipality production rollout, and no certification or
> regulatory approval represented by this repository. The code and deployment
> materials demonstrate an implementation approach that still requires technical,
> security, operational, and Romanian legal review before use with real taxpayer data.
>
> **Naming:** **PrimărIA** is the product/brand name (Primărie + IA). **PrimatIA**
> is the ASCII GitHub repository slug used in clone URLs and local path examples.

## Overview

PrimărIA is a multi-tenant portfolio prototype for exploring local-tax administration in Romanian communes. Built with Next.js 14, PostgreSQL, and TypeScript, the repository contains tax-calculation, document-generation, and citizen self-service workflows for evaluation in local or controlled pilot environments.

The name combines **Primărie** (town hall) + **IA** (AI / Inteligență Artificială), reflecting the vision of intelligent digitization for local public administration.

**Target market:** ~2,800 Romanian communes (500--5,000 population) currently using Excel, legacy desktop apps, or manual processes for local tax administration.

## Key Features

- **Multi-tenant architecture** -- Tenant-scoped schema and PostgreSQL RLS controls implemented for evaluation; not independently audited as an isolation guarantee
- **Tax Engine** -- Calculation rules for buildings, land, and vehicles modeled on Cod Fiscal (Titlul IX, L227/2015); outputs require expert validation
- **Document Generation** -- PDF fiscal decisions, certificates, summons, collection logs via @react-pdf/renderer
- **PatrimVen XML Export** -- Experimental XML generation for selected PatrimVen form families (F3001--F3003, F3101); not certified by or interoperability-tested with ANAF
- **Citizen Portal** -- Self-service portal for viewing taxes, payments, and certificate requests
- **Online Payments** -- Ghișeul.ro integration (mock implementation for development)
- **Notifications** -- Email notification system for payment reminders, due dates, and document delivery
- **Multilingual** -- Romanian (primary), Hungarian, and English via next-intl
- **PWA / Offline Support** -- Service worker with offline capabilities for rural areas with intermittent connectivity
- **Enforcement Workflow** -- Prototype summons and penalty-tracking workflow modeled on Cod de Procedură Fiscală concepts

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5 (strict mode) |
| **UI** | React 18, Tailwind CSS 3, shadcn/ui, Radix UI primitives |
| **Database** | PostgreSQL 16 with Row-Level Security |
| **ORM** | Prisma 6 |
| **Connection Pool** | PgBouncer (transaction mode) |
| **Cache / Queue** | Redis 7, BullMQ |
| **Auth** | NextAuth.js v5 (Auth.js), JWT, TOTP 2FA |
| **Object Storage** | MinIO (S3-compatible) |
| **PDF Generation** | @react-pdf/renderer |
| **XML Processing** | fast-xml-parser |
| **Charts** | Recharts |
| **i18n** | next-intl (ICU message format) |
| **Validation** | Zod |
| **Testing** | Vitest |
| **Containerization** | Docker, Docker Compose |

## Prerequisites

- **Node.js** 20+
- **Docker** & **Docker Compose** (for PostgreSQL, PgBouncer, Redis, MinIO)
- **npm** (ships with Node.js)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Bogdan0708/PrimatIA.git
cd PrimatIA

# 2. Start infrastructure services (PostgreSQL, PgBouncer, Redis, MinIO)
docker compose up -d

# 3. Copy environment configuration
cp .env.example .env.local

# 4. Install dependencies
npm install

# 5. Run database migrations
npx prisma migrate dev

# 6. Seed the database with demo data
npm run db:seed

# 7. Start the development server
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

**Demo credentials — local development only:**

These fixed accounts are created by the demo seed flow. Never use these credentials
or run the demo seed against a public, shared, staging, pilot, or production environment.

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@bogdanvoda.ro` | `Admin123!` |
| Operator | `operator@bogdanvoda.ro` | `Operator123!` |
| Citizen Portal | `cetatean@example.ro` | `Citizen123!` |

Demo tenant: **Primăria Comunei Bogdan Vodă, Maramureș**

**Infrastructure ports (development):**

| Service | Port |
|---------|------|
| Next.js App | 3000 |
| PostgreSQL | 5433 |
| PgBouncer | 6432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

## Project Structure

```
PrimatIA/
├── prisma/
│   ├── schema.prisma              # Database schema (Prisma)
│   ├── migrations/                # SQL migrations (RLS, init)
│   └── seed.ts                    # Seed data (50 taxpayers, 100+ properties)
├── src/
│   ├── app/
│   │   ├── (authenticated)/       # Protected routes (staff)
│   │   │   ├── dashboard/         # Main dashboard with KPIs
│   │   │   ├── contribuabili/     # Taxpayer management
│   │   │   ├── proprietati/       # Property management
│   │   │   ├── plati/             # Payment recording
│   │   │   ├── documente/         # Document generation
│   │   │   ├── rapoarte/          # Reports
│   │   │   ├── somatii/           # Enforcement workflow
│   │   │   └── admin/             # Admin panel
│   │   │       ├── calcul/        # Mass tax calculation
│   │   │       ├── hcl/           # HCL rate configuration
│   │   │       ├── import/        # CSV/Excel import
│   │   │       ├── patrimven/     # PatrimVen XML export
│   │   │       ├── scutiri/       # Exemption rules
│   │   │       ├── notificari/    # Notification management
│   │   │       └── tenants/       # Tenant management (super admin)
│   │   ├── api/                   # API routes
│   │   │   ├── auth/              # Authentication endpoints
│   │   │   ├── health/            # Health check (/api/health)
│   │   │   ├── plati/             # Payment API
│   │   │   └── portal/            # Citizen portal API
│   │   ├── portal/                # Citizen self-service portal
│   │   │   ├── dashboard/         # Citizen dashboard
│   │   │   ├── impozite/          # Tax balance viewing
│   │   │   ├── plati/             # Online payments
│   │   │   ├── documente/         # Document downloads
│   │   │   ├── certificate/       # Certificate requests
│   │   │   └── proprietati/       # Property declarations
│   │   └── login/                 # Login page
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── layout/                # App shell, header, sidebar
│   │   └── portal/                # Citizen portal layout
│   ├── lib/
│   │   ├── tax-engine/            # Tax calculation logic
│   │   ├── documents/             # PDF document generation
│   │   │   └── templates/         # Document templates (decizie, certificat, somatie)
│   │   ├── patrimven/             # PatrimVen XML generator
│   │   ├── payments/              # Payment gateway (Ghiseul.ro mock)
│   │   ├── notifications/         # Email notification service
│   │   ├── reports/               # Report generation
│   │   ├── auth.ts                # NextAuth configuration
│   │   ├── db.ts                  # Prisma client
│   │   ├── crypto.ts              # CNP encryption (AES-256-GCM)
│   │   ├── tenant-context.ts      # RLS tenant context
│   │   ├── storage.ts             # MinIO client
│   │   ├── queue.ts               # BullMQ / Redis queue
│   │   └── sanitize.ts            # Input sanitization
│   ├── messages/                  # i18n translations
│   │   ├── ro.json                # Romanian (primary)
│   │   ├── hu.json                # Hungarian
│   │   └── en.json                # English
│   ├── __tests__/                 # Vitest test suites
│   │   └── tax-engine/            # Tax calculator tests
│   ├── middleware.ts              # Auth, RLS, rate limiting, security headers
│   └── i18n.ts                   # next-intl configuration
├── docker/
│   ├── nginx.conf                 # Nginx reverse proxy (SSL, rate limiting)
│   ├── postgres/init.sql          # PostgreSQL initialization (roles, RLS)
│   └── pgbouncer/                 # PgBouncer configuration
├── docs/                          # Project documentation
│   ├── PRD.md                     # Product Requirements Document
│   ├── ARCHITECTURE.md            # System architecture
│   ├── DATA_MODEL.md              # Database schema design
│   ├── IMPLEMENTATION.md          # Implementation roadmap
│   ├── DEPLOYMENT.md              # Production deployment guide
│   ├── USER_GUIDE.md              # User guide (Romanian)
│   └── INCIDENT_RESPONSE.md       # Incident response plan
├── docker-compose.yml             # Development infrastructure
├── docker-compose.production.yml  # Production deployment
├── Dockerfile                     # Multi-stage production build
├── vitest.config.ts               # Test configuration
├── CHANGELOG.md                   # Version changelog
└── .env.example                   # Environment variable template
```

## Architecture

### Multi-Tenancy

The repository implements a tenant-isolation design using PostgreSQL Row-Level Security (RLS). Tenant-scoped tables include a `tenant_id` column, and application database access is designed to set tenant context before queries. This is valuable implementation evidence, not proof of an independently audited or deployed security boundary.

```sql
-- Tenant context set on every request via parameterized query
SELECT set_config('app.current_tenant_id', $1, true);

-- RLS policy applied to all tenant-scoped tables
CREATE POLICY tenant_isolation ON contribuabili FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### Authentication & Authorization

- **Staff authentication:** NextAuth.js v5 with email/password + optional TOTP 2FA
- **Citizen authentication:** Separate auth flow with email verification
- **RBAC roles:** `super_admin`, `admin`, `operator`, `contabil`, `cetatean`
- **Tenant resolution:** Staff users are bound to a tenant; citizens authenticate via the portal subdomain

### Security

- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Rate limiting middleware (configurable per route)
- CNP encryption at rest (AES-256-GCM) with separate hash column for lookups
- Input sanitization for all user inputs
- Audit logging for all CRUD operations (immutable, INSERT + SELECT only)
- CORS configuration for portal API

## Tax Types Modeled in the Prototype

The cited legal provisions are design references, not a legal opinion, compliance
attestation, or guarantee that calculated amounts are correct for a municipality's
current HCL configuration. Validate rules, rates, rounding, forms, and effective dates
with qualified Romanian tax/legal specialists before any real-world use.

### Core (MVP)

| Tax Type | Legal Basis | Description |
|----------|-------------|-------------|
| **Impozit cladiri** | Art. 457--459 | Building tax (residential, non-residential, mixed) |
| **Impozit teren** | Art. 465 | Land tax (intravilan, extravilan, curti) |
| **Impozit mijloace de transport** | Art. 470 | Vehicle tax (cars, trucks, buses, motorcycles) |

### Deferred (Post-MVP)

| Tax Type | Legal Basis | Description |
|----------|-------------|-------------|
| Taxa firma | Art. 475 | Business signage tax |
| Taxa hoteliera | Art. 478 | Hotel/accommodation tax |
| Taxa spectacole | Art. 480 | Entertainment tax |

### Tax Engine Features

- **Bonificatie** -- 10% early payment discount for full payment by March 31 (Art. 462)
- **Partial year proration** -- Pro-rata calculation from first day of month following acquisition/disposal
- **Building age coefficients** -- Art. 457 reduction based on building age
- **Vehicle tax brackets** -- Art. 470 formulas per vehicle category and engine displacement
- **Penalty and interest** -- Daily accrual per Cod de Procedura Fiscala
- **Exemption rules engine** -- Configurable exemptions (veterans, disabilities, etc.) per Art. 456
- **HCL rate tables** -- Per-commune rate configuration with legal min/max validation

## Development

```bash
# Start development server
npm run dev

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Database commands
npm run db:generate      # Regenerate Prisma client
npm run db:migrate       # Run migrations
npm run db:seed          # Seed demo data
npm run db:studio        # Open Prisma Studio (GUI)
npm run db:reset         # Reset database (destructive)
```

## Testing

```bash
# Run all tests
npx vitest

# Run tests in watch mode
npx vitest --watch

# Run with coverage
npx vitest --coverage

# Run specific test file
npx vitest src/__tests__/tax-engine/building-tax.test.ts
```

Test coverage focuses on the tax engine (`src/lib/tax-engine/`) and PatrimVen XML generator (`src/lib/patrimven/`).

## Deployment

For the self-hosting reference, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
It is an operator-oriented example, not evidence of a current public deployment or
production-readiness approval.

**Reference Compose workflow:**

```bash
# Production deployment with Docker Compose
cp .env.production.example .env
# Edit .env with production values
docker compose -f docker-compose.production.yml up -d --build
```

The repository's deployment configuration includes:
- Multi-stage Dockerfile (Node.js 20 Alpine, standalone output)
- PostgreSQL 16 with PgBouncer connection pooling
- Redis 7 with authentication
- MinIO for document storage
- Health check endpoint at `/api/health`

## Documentation

| Document | Description |
|----------|-------------|
| [PRD](docs/PRD.md) | Product Requirements Document |
| [Architecture](docs/ARCHITECTURE.md) | System architecture and design decisions |
| [Data Model](docs/DATA_MODEL.md) | Database schema and entity relationships |
| [Implementation](docs/IMPLEMENTATION.md) | 22-week implementation roadmap |
| [Deployment](docs/DEPLOYMENT.md) | Self-hosting reference and operational checklist |
| [User Guide](docs/USER_GUIDE.md) | User guide for commune staff (Romanian) |
| [Incident Response](docs/INCIDENT_RESPONSE.md) | Security incident response procedures |
| [Changelog](CHANGELOG.md) | Version history |

## Legal and Regulatory Design References

The implementation was designed with the following sources and topics in mind. This
list does **not** establish legal compliance, ANAF acceptance, GDPR/NIS2 conformity,
eIDAS qualification, or certification. Requirements and generated outputs must be
reviewed against current official sources by qualified professionals before deployment.

- **Cod Fiscal** (L227/2015, Titlul IX) -- Tax calculation rules
- **Cod de Procedura Fiscala** -- Payment distribution, enforcement
- **OUG 11/2021** -- PatrimVen XML export obligation
- **GDPR** (EU Reg 2016/679 + L190/2018) -- Data protection
- **NIS2** (EU 2022/2555) -- Cybersecurity for public administration
- **eIDAS** -- Qualified electronic signatures for fiscal documents
- **Constitutia Romaniei, Art. 13** -- All legal/fiscal documents generated in Romanian only

## Contributing

This project is currently a portfolio/pilot project with no public deployment. For contribution guidelines, contact the development team.

## License

Copyright 2026 PrimărIA. All rights reserved.

This software is proprietary. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without express written permission.

---

*Built for Romanian communes. Construit pentru comunele din Romania.*
