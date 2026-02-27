# PrimărIA — Workflow Schemes

> Generated: 2026-02-27

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph "Clients"
        STAFF[Staff Browser<br/>NextAuth JWT]
        CITIZEN[Citizen Browser<br/>Custom JWT]
    end

    subgraph "Next.js App (Cloud Run)"
        MW[Middleware<br/>Rate Limit / Security Headers / CORS / RLS Tenant Header]

        subgraph "Staff Surface"
            SPAGES[Staff Pages<br/>/locale/authenticated/]
            SACTIONS[Server Actions<br/>requireStaff / requireAdmin]
        end

        subgraph "Citizen Surface"
            PPAGES[Portal Pages<br/>/locale/portal/]
            PAPI[Portal API Routes<br/>getCitizenFromRequest]
        end

        subgraph "Shared API"
            WEBHOOK[Stripe Webhook<br/>Signature Verification]
            CHATBOT[Chatbot API<br/>Streaming SSE]
            DOCS_API[Documents API<br/>Generate / Download]
            HEALTH[Health Check]
        end

        subgraph "Core Libraries"
            AUTH_STAFF[auth.ts<br/>NextAuth v5]
            AUTH_CITIZEN[portal-auth.ts<br/>jose JWT]
            DB[db.ts<br/>Prisma Proxy<br/>AsyncLocalStorage]
            TAX_ENGINE[tax-engine/<br/>Building / Land / Vehicle]
            DOC_GEN[documents/<br/>React-PDF Generator]
            PAY_GW[payments/<br/>Stripe Provider]
            AI[ai/<br/>RAG Knowledge Base]
            VALID[validations.ts<br/>Zod Schemas]
        end
    end

    subgraph "Data Stores"
        PG[(PostgreSQL 16<br/>36 tables + RLS)]
        PGBOUNCER[PgBouncer<br/>Transaction Mode]
        REDIS[(Redis 7<br/>BullMQ Queues)]
        MINIO[(MinIO S3<br/>Documents/PDFs)]
    end

    subgraph "External Services"
        STRIPE[Stripe<br/>Checkout + Webhooks]
        AI_GW[AI Gateway<br/>Gemini / OpenAI / Claude]
        EMAIL[Email Service<br/>SMTP]
    end

    STAFF -->|HTTPS| MW
    CITIZEN -->|HTTPS| MW
    MW --> SPAGES & PPAGES & WEBHOOK & CHATBOT & DOCS_API & HEALTH

    SPAGES --> SACTIONS
    SACTIONS --> DB & TAX_ENGINE & DOC_GEN & VALID
    PPAGES --> PAPI
    PAPI --> DB & PAY_GW & AI

    WEBHOOK --> PAY_GW
    CHATBOT --> AI
    DOCS_API --> DOC_GEN

    DB --> PGBOUNCER --> PG
    DOC_GEN --> MINIO
    PAY_GW --> STRIPE
    AI --> AI_GW
    DOC_GEN -.->|Notifications| EMAIL

    AUTH_STAFF -.-> PG
    AUTH_CITIZEN -.-> PG
```

## 2. Sequence: Citizen Online Payment → Receipt

```mermaid
sequenceDiagram
    participant C as Citizen Browser
    participant API as Next.js API
    participant DB as PostgreSQL
    participant S as Stripe
    participant WH as Webhook Handler
    participant FS as MinIO Storage

    C->>API: POST /api/portal/payments/initiate<br/>{contribuabilId, items[]}
    API->>API: getCitizenFromRequest(JWT)
    API->>DB: Verify CitizenContribuabilLink
    API->>S: createCheckoutSession({metadata, items})
    S-->>API: {sessionId, url}
    API->>DB: INSERT OnlinePayment(status=initiated, gatewayRef=sessionId)
    API-->>C: {redirectUrl}

    C->>S: Complete payment on Stripe Checkout
    S->>WH: POST /api/payments/webhook<br/>checkout.session.completed

    WH->>WH: constructEvent(body, sig, secret)
    WH->>DB: Check stripeEventId dedup
    alt Already processed
        WH-->>S: 200 {received: true}
    else New event
        WH->>DB: BEGIN TRANSACTION (withTenantScope)
        WH->>DB: SELECT ... FOR UPDATE (OnlinePayment)
        WH->>DB: SELECT ... FOR UPDATE (Impozit rows)
        WH->>WH: Validate amounts (±0.01 RON tolerance)
        WH->>DB: INSERT ChitantaSequence ON CONFLICT UPDATE<br/>→ CHT-2026-000042
        WH->>DB: INSERT Plata(suma, nrChitanta, modalitate=card)
        WH->>DB: UPDATE OnlinePayment(status=confirmed, stripeEventId)
        loop Each selected debt
            WH->>DB: INSERT PlataDistributie
            WH->>DB: UPDATE Impozit(sumaPlatita+=, status)
        end
        WH->>DB: INSERT Document(tip=chitanta, numarDocument)
        WH->>DB: COMMIT
        WH-->>S: 200 {received: true}
    end

    C->>API: GET /api/documents/{id}/download
    API->>DB: Verify ownership
    API->>FS: Generate presigned URL
    API-->>C: 302 Redirect to presigned URL
```

## 3. Sequence: Admin Cash Payment → Receipt

```mermaid
sequenceDiagram
    participant A as Admin Browser
    participant API as Next.js API
    participant DB as PostgreSQL
    participant GEN as Document Generator
    participant FS as MinIO Storage

    A->>API: POST /api/plati/record<br/>{contribuabilId, suma, modalitate=numerar}
    API->>API: auth() → requireStaff()
    API->>API: setTenantContext(tenantId)
    API->>DB: Verify Contribuabil exists
    API->>DB: INSERT Plata(suma, modalitate, inregistratDeId)

    Note over API,DB: distributePayment()
    API->>DB: SELECT outstanding Impozit<br/>ORDER BY fiscalYear ASC, rata1Scadenta ASC
    loop Each outstanding tax (oldest first)
        API->>API: Calculate: penalties first, then principal
        API->>DB: UPDATE Impozit(sumaPlatita, status)
    end
    API->>DB: INSERT PlataDistributie[] (batch)
    API->>DB: UPDATE Plata(distribuit=true)
    API-->>A: 201 {success: true, id: plataId}

    A->>API: POST /api/documents/generate<br/>{type: chitanta, plataId}
    API->>API: requireStaff()
    GEN->>DB: Fetch Plata + distributions + tenant + contribuabil
    GEN->>GEN: getNextDocumentNumber(CHT, year)
    GEN->>GEN: Render React-PDF (ChitantaPDF template)
    GEN->>FS: Upload PDF to MinIO
    GEN->>DB: INSERT Document(tip=chitanta, fileUrl, numarDocument)
    API-->>A: {documentId, numarDocument}

    A->>API: GET /api/documents/{id}/download
    API->>FS: Generate presigned URL
    API-->>A: 302 Redirect
```

## 4. Sequence: Certificate Request Flow

```mermaid
sequenceDiagram
    participant C as Citizen
    participant API as Portal API
    participant DB as PostgreSQL
    participant ADMIN as Admin Staff
    participant GEN as Doc Generator
    participant FS as MinIO

    C->>API: POST /api/portal/certificates<br/>{tipCertificat, scop, contribuabilId}
    API->>API: getCitizenFromRequest(JWT)
    API->>DB: Verify CitizenContribuabilLink
    API->>DB: INSERT CertificateRequest(status=pending)
    API-->>C: {requestId, status: pending}

    Note over ADMIN: Admin reviews request in dashboard

    ADMIN->>API: Server action: processCertificateRequest()
    API->>API: requireStaff()
    API->>DB: UPDATE CertificateRequest(status=processing)
    GEN->>DB: Fetch taxpayer debts, properties, payments
    GEN->>GEN: Render CertificatAtestarePDF
    GEN->>FS: Upload to MinIO
    GEN->>DB: INSERT Document(tip=certificat_atestare)
    API->>DB: UPDATE CertificateRequest(status=ready, documentId)

    C->>API: GET /api/portal/certificates (poll)
    API-->>C: {status: ready, documentId}

    C->>API: GET /api/documents/{id}/download
    API->>DB: Verify citizen ownership
    API->>FS: Presigned URL
    API-->>C: 302 Redirect to PDF
```

## 5. Data Model Overview (Core Entities)

```mermaid
erDiagram
    Tenant ||--o{ TenantUser : "has staff"
    Tenant ||--o{ CitizenUser : "has citizens"
    Tenant ||--o{ Contribuabil : "has taxpayers"
    Tenant ||--o{ HclDecision : "has decisions"
    Tenant ||--o{ AuditLog : "has logs"

    CitizenUser ||--o{ CitizenContribuabilLink : "linked to"
    Contribuabil ||--o{ CitizenContribuabilLink : "linked from"

    Contribuabil ||--o{ ProprietateCladire : "owns buildings"
    Contribuabil ||--o{ ProprietateTeren : "owns land"
    Contribuabil ||--o{ ProprietateVehicul : "owns vehicles"
    Contribuabil ||--o{ Impozit : "owes taxes"
    Contribuabil ||--o{ Plata : "makes payments"
    Contribuabil ||--o{ Document : "has documents"
    Contribuabil ||--o{ Somatie : "receives notices"

    HclDecision ||--o{ TaxRateTable : "defines rates"
    HclDecision ||--o{ ZonaFiscala : "defines zones"

    Impozit }o--|| TaxTypeRegistry : "tax type"
    Impozit ||--o{ PlataDistributie : "payments applied"
    Impozit ||--o{ Penalitate : "accrued penalties"
    Impozit }o--o{ SomatieImpozit : "in notices"

    Plata ||--o{ PlataDistributie : "distributed to"
    OnlinePayment |o--o| Plata : "settles as"

    Somatie ||--o{ SomatieImpozit : "covers taxes"
    Somatie ||--o{ Document : "generates"

    CertificateRequest |o--o| Document : "produces"

    ScutireRegula ||--o{ ScutireContribuabil : "applied as"
    Contribuabil ||--o{ ScutireContribuabil : "has exemptions"

    Contribuabil ||--o{ Consimtamant : "gives consent"
    CitizenUser ||--o{ Notificare : "receives"
    CitizenUser ||--o{ OnlinePayment : "initiates"
    CitizenUser ||--o{ CertificateRequest : "requests"
```

## 6. Tax Calculation Flow

```mermaid
flowchart TD
    START[calculateAllTaxesForContribuabil] --> HCL[resolveActiveHcl<br/>Find active HCL for fiscal year]
    HCL --> EXEMPT[getApplicableExemptions<br/>Find exemption rules]

    HCL --> BLDG[Building Tax Module]
    HCL --> LAND[Land Tax Module]
    HCL --> VEH[Vehicle Tax Module]

    BLDG --> |ProprietateCladire| BLDG_CALC[Calculate per building<br/>• Zone + construction type → rate<br/>• Apply age coefficient<br/>• Prorate by months owned<br/>• Split mixed-use buildings]

    LAND --> |ProprietateTeren| LAND_CALC[Calculate per parcel<br/>• Category + zone → rate per m²<br/>• Intravilan vs extravilan<br/>• Prorate by months]

    VEH --> |ProprietateVehicul| VEH_CALC[Calculate per vehicle<br/>• Euro norm bracket<br/>• Engine power → rate per kW<br/>• Heavy vehicle by axle/mass<br/>• Prorate by months]

    BLDG_CALC --> APPLY_EX[Apply Exemptions<br/>discountPercent from ScutireRegula]
    LAND_CALC --> APPLY_EX
    VEH_CALC --> APPLY_EX

    APPLY_EX --> BONIF[Apply Early Payment Bonus<br/>bonificatie %]

    BONIF --> IMPOZIT[Create/Update Impozit Records<br/>bazaImpozabila, rataAplicata,<br/>sumaCalculata, sumaScutire,<br/>sumaDatorata, rata1, rata2]

    IMPOZIT --> DONE[Return TaxCalculationResult[]]

    style BLDG_CALC fill:#e1f5fe
    style LAND_CALC fill:#e8f5e9
    style VEH_CALC fill:#fff3e0
```

## 7. Authentication Flow

```mermaid
flowchart TD
    subgraph "Staff Login"
        S1[POST /login] --> S2[NextAuth Credentials Provider]
        S2 --> S3{User exists & active?}
        S3 -->|No| S_FAIL[Return null]
        S3 -->|Yes| S4{Tenant active/trial?}
        S4 -->|No| S_FAIL
        S4 -->|Yes| S5{Locked out?<br/>lockedUntil > now}
        S5 -->|Yes| S_FAIL
        S5 -->|No| S6{bcrypt.compare<br/>password valid?}
        S6 -->|No| S7[loginAttempts++<br/>Lock if >= 5]
        S7 --> S_FAIL
        S6 -->|Yes| S8[Reset attempts<br/>Set lastLoginAt]
        S8 --> S9[JWT with role + tenantId<br/>Cookie: next-auth.session-token<br/>maxAge: 8h]
    end

    subgraph "Citizen Login"
        C1[POST /api/portal/auth/login] --> C2[Resolve tenantId]
        C2 --> C3{Citizen exists?<br/>active + verified}
        C3 -->|No| C_FAIL[401 Invalid credentials]
        C3 -->|Yes| C4{Locked out?}
        C4 -->|Yes| C_FAIL
        C4 -->|No| C5{bcrypt.compare}
        C5 -->|No| C6[loginAttempts++<br/>Lock if >= 5]
        C6 --> C_FAIL
        C5 -->|Yes| C7[Reset attempts]
        C7 --> C8[JWT HS256 via jose<br/>Cookie: citizen-token<br/>httpOnly, maxAge: 4h]
    end

    subgraph "Route Protection"
        MW[Middleware] --> MW1{Portal route?}
        MW1 -->|Yes| MW2{citizen-token exists?}
        MW2 -->|No| MW3[Redirect to /portal/login]
        MW2 -->|Yes| MW4[Pass through]
        MW1 -->|No| MW5{Staff route?}
        MW5 -->|Yes| MW6[NextAuth session check]
    end
```
