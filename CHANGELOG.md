# Changelog

Toate modificările notabile ale proiectului PrimărIA sunt documentate în acest fișier.

## [0.5.0] — 2026-02-12 — Phase 5: Production Hardening & Polish

### Added
- Vitest test suite for tax engine calculators (building, land, vehicle tax)
- Input sanitization library (`src/lib/sanitize.ts`)
- Health check API endpoint (`/api/health`) — database + Redis status
- Dockerfile with multi-stage build (Node.js 20 Alpine, standalone output)
- `docker-compose.production.yml` for full production deployment
- Nginx reverse proxy configuration with SSL termination, rate limiting, static asset caching
- `.env.production.example` with all production environment variables documented
- Deployment guide (`docs/DEPLOYMENT.md`)
- User guide in Romanian (`docs/USER_GUIDE.md`)
- Dashboard charts: revenue by month, tax breakdown, collection rate trend, overdue aging (Recharts)
- Enhanced seed data: Bogdan Vodă demo tenant, 50 contribuabili, 100+ properties, HCL 2026, payments, penalties

### Changed
- Updated security middleware with CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers
- Updated README.md with complete project documentation
- Expanded seed data with realistic Romanian names, PF/PJ mix, diverse properties

## [0.4.0] — 2026-02-11 — Phase 4: Citizen Portal, Notifications & Offline

### Added
- Citizen self-service portal (`/portal/`) with separate authentication
- Citizen dashboard with tax balance, payment history, property overview
- Online payment integration via Ghișeul.ro mock gateway
- Certificate request workflow (cerere certificat fiscal)
- Property self-declaration for citizens
- Contact form for citizen inquiries
- Email notification system (Nodemailer) for payment reminders, due dates, document delivery
- Notification management admin panel (`/admin/notificari`)
- PWA support with service worker for offline capabilities
- Offline fallback page for rural areas with intermittent connectivity
- Citizen user model with email verification flow
- Citizen-contribuabil linking system
- CORS configuration for portal API

## [0.3.0] — 2026-02-10 — Phase 3: Documents, PatrimVen XML, Reports & Enforcement

### Added
- PDF document generation via @react-pdf/renderer
  - Decizie de impunere (fiscal decision)
  - Certificat fiscal (tax certificate)
  - Somație (enforcement summons)
  - Proces-verbal de colectare (collection log)
- PatrimVen XML export for ANAF DUKIntegrator
  - F3001 — Property declarations (buildings, land)
  - F3002 — Vehicle declarations
  - F3003 — Taxpayer declarations
  - F3101 — Centralized summary
- Reporting module (`/rapoarte/`) with filterable reports
  - Revenue by tax type and period
  - Outstanding debts (restanțe)
  - Collection rate analysis
  - Daily payment register (borderou)
  - Property inventory
- Enforcement workflow (`/somatii/`) with automated penalty tracking
- MinIO integration for document storage (S3-compatible)
- Document signing (digital stamp) workflow
- Mass document generation for fiscal decisions
- Export job queue (BullMQ + Redis) for background processing

## [0.2.0] — 2026-02-09 — Phase 2: Tax Engine, CRUD, Payments & Admin

### Added
- Tax engine with calculators for:
  - Building tax (residential, non-residential, mixed) per Art. 457–459
  - Land tax (intravilan, extravilan, curți) per Art. 465
  - Vehicle tax (cars, trucks, buses, motorcycles, tractors) per Art. 470
- Bonificație 10% early payment discount (Art. 462)
- Partial year proration from month following acquisition
- Building age coefficients per Art. 457
- Penalty and interest daily accrual per Cod de Procedură Fiscală
- CRUD interfaces:
  - Contribuabili management (`/contribuabili/`) — list, add, edit, detail view
  - Properties: buildings (`/proprietati/cladiri/`), land, vehicles
  - Payment recording (`/plati/`) with automatic distribution
- Mass tax calculation (`/admin/calcul/`)
- HCL rate table configuration (`/admin/hcl/`)
- CSV/Excel import (`/admin/import/`) with validation and rollback
- Exemption rules engine (`/admin/scutiri/`) per Art. 456
- Admin panel for tenant management (`/admin/tenants/`)
- Payment distribution algorithm (debit principal → penalități)

## [0.1.0] — 2026-02-08 — Phase 1: Foundation

### Added
- Next.js 14 App Router project structure
- TypeScript 5 strict mode configuration
- PostgreSQL 16 with Row-Level Security (RLS) for multi-tenancy
- Prisma 6 ORM with complete schema (30+ models)
- PgBouncer connection pooling (transaction mode)
- Redis 7 integration for caching and BullMQ queues
- NextAuth.js v5 authentication with email/password
- RBAC roles: super_admin, primaria_admin, operator, contabil, cetatean
- TOTP 2FA support
- CNP encryption at rest (AES-256-GCM) with separate hash for lookups
- Internationalization (next-intl) with Romanian, Hungarian, English
- ICU message format for plurals and formatting
- Tailwind CSS 3 + shadcn/ui component library
- App shell with responsive sidebar, header, breadcrumbs
- Docker Compose for development (PostgreSQL, PgBouncer, Redis, MinIO)
- RLS migration with tenant isolation policies
- Seed data with tax type registry (12 tax types)
- Audit logging (immutable, INSERT + SELECT only)
- Zod validation schemas
