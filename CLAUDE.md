# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev                # Next.js dev server (localhost:3000)
npm run build              # Production build (standalone output)
npm run lint               # ESLint
npm run type-check         # tsc --noEmit

# Database (Prisma 6)
npm run db:generate        # Regenerate Prisma client
npm run db:push            # Push schema to DB (no migration file)
npm run db:migrate         # Create + apply migration
npm run db:seed            # Seed demo data (tsx prisma/seed.ts)
npm run db:studio          # Prisma Studio GUI

# Testing (Vitest, Node environment, globals: true)
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report (v8)
npx vitest src/__tests__/tax-engine/building-tax.test.ts  # Single file

# Infrastructure (dev)
docker compose up -d       # PostgreSQL 16, Redis 7, MinIO, PgBouncer
```

## Architecture

**PrimărIA** is a multi-tenant SaaS for Romanian local tax administration. Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Prisma + PostgreSQL with Row-Level Security.

### Two Surfaces, Two Auth Systems

| Surface | Route group | Auth | Cookie |
|---------|-------------|------|--------|
| **Staff admin** | `src/app/[locale]/(authenticated)/` | NextAuth v5 (JWT strategy) | `next-auth.session-token` |
| **Citizen portal** | `src/app/[locale]/portal/` | Custom JWT via `src/lib/portal-auth.ts` | `citizen-token` |

Staff roles: `super_admin`, `primaria_admin`, `operator`, `contabil`. Use `requireStaff()` or `requireAdmin()` from `src/lib/auth-utils.ts`.

### Multi-Tenancy & RLS

Every tenant-scoped table has `tenant_id`. PostgreSQL RLS policies enforce isolation. **All queries must be wrapped in tenant context:**

```typescript
// Preferred: explicit transaction scope
const result = await withTenantScope(tenantId, async () => {
  return prisma.contribuabil.findMany();
});

// Alternative: sets context per-query (from src/lib/db.ts)
await setTenantContext(tenantId);
```

Never use the raw `prisma` client for tenant data without setting context first.

### Server Actions Pattern

Actions live in `_actions/` folders alongside their pages. Every action:
1. Starts with `"use server"` directive
2. Returns `{ success: true; data?: T } | { success: false; error: string }`
3. Calls auth check (`requireStaff()` / `requireAdmin()`)
4. Wraps DB access in `withTenantScope()` or `setTenantContext()`

### i18n — Three Files Must Stay in Sync

Locales: `ro` (default), `en`, `hu`. All three message files must have identical keys:
- `src/messages/ro.json`
- `src/messages/en.json`
- `src/messages/hu.json`

All internal links **must** include the locale prefix: `/${locale}/path`. The middleware uses `localePrefix: "always"`.

Server: `getTranslations("namespace")`. Client: `useTranslations("namespace")`.

### Design Tokens

Semantic CSS variables defined in `src/app/globals.css` and mapped in `tailwind.config.ts`:
- Colors: `--success`, `--warning`, `--info`, `--portal-primary`
- Sidebar: `--sidebar-active-bg`, `--sidebar-hover-bg`
- Charts: `--chart-1` through `--chart-5` (use `hsl(var(--chart-N))`)

Portal classes: `text-portal-primary`, `bg-portal-primary`, `bg-portal-primary-subtle`.

### Shared UI Components

- `src/components/ui/page-header.tsx` — Use `<PageHeader title={...} />` instead of ad-hoc h1 elements
- `src/components/ui/empty-state.tsx` — Use `<EmptyState icon={...} title={...} />` for zero-result states
- `src/components/ui/badge.tsx` — Has `success` and `warning` variants beyond default shadcn

### Tax Engine

Located in `src/lib/tax-engine/`. Separate modules for building, land, vehicle taxes. Uses `Decimal` for all currency/rate calculations. Rate tables come from HCL decisions (`TaxRateTable` model) configured per fiscal year. Legal basis: Cod Fiscal L227/2015, Titlul IX.

### Key Domain Constants

All enums and type literals are in `src/lib/constants.ts`: roles, tax categories, fiscal zones, building construction types, land categories, vehicle types, Euro norms, property/tax/import statuses.

## Database

- **36 Prisma models** in `prisma/schema.prisma`
- Prisma 6 with `url` (PgBouncer, transaction mode) and `directUrl` (direct PostgreSQL, for migrations)
- RLS policies defined in raw SQL migrations + `docker/postgres/init.sql`
- Seed data: 50 taxpayers, 100+ properties for demo tenant (Bogdan Vodă, Maramureș)

## Deployment

- **Docker**: Multi-stage Dockerfile → Node 20 Alpine, standalone Next.js output, port 8080
- **GCP Cloud Run**: Image in Artifact Registry (`europe-central2`), secrets via Secret Manager
- **Deploy script**: `deploy/deploy.sh` (requires `GCP_PROJECT_ID`, `TENANT_ID`, `NEXTAUTH_URL`)
- **Cloud Run specifics**: `AUTH_TRUST_HOST=true` required for NextAuth behind proxy; `NEXTAUTH_URL` must match the service URL

## Build Notes

- `npm run build` shows pre-existing "Dynamic server usage" warnings for `/api/reports/*` and `/api/anomalies` — these are expected, not errors
- "Compiled successfully" + "Generating static pages" = healthy build
- Radix UI Select requires non-empty string values for `<SelectItem>` — use sentinel `"__none__"` for optional/empty options
