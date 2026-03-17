-- 0000_init: Baseline migration
-- Creates all tables, indexes, and foreign keys that existed BEFORE the first incremental migration.
-- Tables created by later migrations are excluded:
--   chitanta_sequences      (20260214_chitanta_sequence)
--   import_row_ledgers      (20260218_import_row_ledger)
--   password_reset_tokens   (20260218_password_reset_tokens)
--   stripe_webhook_events   (20260221_stripe_webhook_dedup)
--   document_sequences      (20260304_document_sequence)

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "cui" VARCHAR(20),
    "siruta_code" VARCHAR(10),
    "county" VARCHAR(50) NOT NULL,
    "commune_type" VARCHAR(20) NOT NULL DEFAULT 'comuna',
    "commune_rank" INTEGER NOT NULL DEFAULT 5,
    "population" INTEGER,
    "zone_count" INTEGER NOT NULL DEFAULT 4,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" TEXT,
    "website" VARCHAR(255),
    "logo_url" VARCHAR(500),
    "header_text" TEXT,
    "tier" VARCHAR(20) NOT NULL DEFAULT 'comuna',
    "status" VARCHAR(20) NOT NULL DEFAULT 'trial',
    "subscription_start" DATE,
    "subscription_end" DATE,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'operator',
    "phone" VARCHAR(50),
    "cnp" VARCHAR(13),
    "limba_preferata" VARCHAR(2) DEFAULT 'ro',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "totp_secret" VARCHAR(100),
    "last_login_at" TIMESTAMPTZ,
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adrese" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "strada" VARCHAR(255),
    "numar" VARCHAR(20),
    "bloc" VARCHAR(20),
    "scara" VARCHAR(10),
    "etaj" VARCHAR(10),
    "apartament" VARCHAR(10),
    "sat" VARCHAR(100),
    "localitate" VARCHAR(100) NOT NULL,
    "judet" VARCHAR(50) NOT NULL,
    "cod_postal" VARCHAR(10),
    "zona_fiscala" VARCHAR(1),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adrese_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_fiscale" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "zona" VARCHAR(1) NOT NULL,
    "denumire" VARCHAR(255),
    "delimitare" TEXT,
    "hcl_decision_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_fiscale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_type_registry" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" JSONB NOT NULL,
    "legal_basis" VARCHAR(100),
    "category" VARCHAR(30) NOT NULL,
    "formula_type" VARCHAR(30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_type_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribuabili" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tip" VARCHAR(2) NOT NULL,
    "cnp" BYTEA,
    "cnp_hash" VARCHAR(64),
    "cui" VARCHAR(20),
    "nume" VARCHAR(255) NOT NULL,
    "prenume" VARCHAR(255),
    "adresa_domiciliu_id" UUID,
    "adresa_corespondenta_id" UUID,
    "telefon" VARCHAR(50),
    "email" VARCHAR(255),
    "reprezentant_legal" VARCHAR(255),
    "nr_registru_comert" VARCHAR(50),
    "cod_rol" VARCHAR(50),
    "nr_dosar_fiscal" VARCHAR(50),
    "data_inregistrare" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "limba_preferata" VARCHAR(2) DEFAULT 'ro',
    "status" VARCHAR(20) NOT NULL DEFAULT 'activ',
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "contribuabili_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proprietati_cladiri" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "adresa_id" UUID NOT NULL,
    "zona" VARCHAR(1) NOT NULL DEFAULT 'A',
    "numar_cadastral" VARCHAR(50),
    "numar_carte_funciara" VARCHAR(50),
    "destinatie" VARCHAR(20) NOT NULL,
    "tip_constructie" VARCHAR(50) NOT NULL,
    "an_constructie" INTEGER NOT NULL,
    "suprafata_construita" DECIMAL(12,2) NOT NULL,
    "suprafata_utila" DECIMAL(12,2),
    "suprafata_desfasurata" DECIMAL(12,2),
    "nr_etaje" INTEGER NOT NULL DEFAULT 1,
    "valoare_impozabila" DECIMAL(15,2),
    "valoare_inventar" DECIMAL(15,2),
    "suprafata_rezidentiala" DECIMAL(12,2),
    "suprafata_nerezidentiala" DECIMAL(12,2),
    "cota_parte" DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    "nr_proprietari" INTEGER NOT NULL DEFAULT 1,
    "tip_act_proprietate" VARCHAR(50),
    "nr_act_proprietate" VARCHAR(50),
    "data_act_proprietate" DATE,
    "data_dobandire" DATE NOT NULL,
    "data_instrainare" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'activ',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "proprietati_cladiri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proprietati_terenuri" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "adresa_id" UUID,
    "zona" VARCHAR(1) NOT NULL DEFAULT 'A',
    "numar_cadastral" VARCHAR(50),
    "numar_carte_funciara" VARCHAR(50),
    "categorie" VARCHAR(30) NOT NULL,
    "suprafata_mp" DECIMAL(12,2) NOT NULL,
    "suprafata_ha" DECIMAL(10,4),
    "cota_parte" DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    "tip_act_proprietate" VARCHAR(50),
    "nr_act_proprietate" VARCHAR(50),
    "data_act_proprietate" DATE,
    "data_dobandire" DATE NOT NULL,
    "data_instrainare" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'activ',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "proprietati_terenuri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proprietati_vehicule" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "numar_inmatriculare" VARCHAR(20),
    "serie_sasiu" VARCHAR(50),
    "nr_carte_identitate" VARCHAR(50),
    "tip_vehicul" VARCHAR(30) NOT NULL,
    "marca" VARCHAR(100),
    "model" VARCHAR(100),
    "an_fabricatie" INTEGER NOT NULL,
    "cilindree_cmc" INTEGER,
    "putere_kw" DECIMAL(8,2),
    "masa_totala_kg" INTEGER,
    "nr_locuri" INTEGER,
    "norma_poluare" VARCHAR(10),
    "tip_combustibil" VARCHAR(20),
    "data_dobandire" DATE NOT NULL,
    "data_instrainare" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'activ',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "proprietati_vehicule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hcl_decisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "hcl_number" VARCHAR(20) NOT NULL,
    "hcl_date" DATE NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "title" TEXT,
    "inflation_index" DECIMAL(6,4),
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "approved_by" VARCHAR(255),
    "document_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hcl_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rate_tables" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "hcl_decision_id" UUID NOT NULL,
    "tax_type" VARCHAR(50) NOT NULL,
    "category" VARCHAR(50),
    "zona" VARCHAR(1),
    "rang" INTEGER,
    "rate_type" VARCHAR(10) NOT NULL DEFAULT 'percent',
    "rate_value" DECIMAL(12,6) NOT NULL,
    "unit" VARCHAR(20),
    "min_rate" DECIMAL(12,6),
    "max_rate" DECIMAL(12,6),
    "description_ro" TEXT,
    "legal_article" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rate_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scutiri_reguli" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name_ro" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "legal_basis" VARCHAR(100) NOT NULL,
    "tax_types" TEXT[],
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "required_documents" TEXT[],
    "auto_renewable" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE,
    "valid_to" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scutiri_reguli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scutiri_contribuabil" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "scutire_regula_id" UUID NOT NULL,
    "proprietate_type" VARCHAR(20),
    "proprietate_id" UUID,
    "fiscal_year" INTEGER NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "documente_verificate" JSONB NOT NULL DEFAULT '[]',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scutiri_contribuabil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impozite" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "tax_type_id" UUID NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "proprietate_type" VARCHAR(20),
    "proprietate_id" UUID,
    "data_start_calcul" DATE,
    "data_stop_calcul" DATE,
    "nr_luni" INTEGER NOT NULL DEFAULT 12,
    "bonificatie" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hcl_decision_id" UUID,
    "rate_table_id" UUID,
    "baza_impozabila" DECIMAL(15,2) NOT NULL,
    "rata_aplicata" DECIMAL(12,6) NOT NULL,
    "suma_calculata" DECIMAL(12,2) NOT NULL,
    "suma_scutire" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "suma_datorata" DECIMAL(12,2) NOT NULL,
    "rata_1" DECIMAL(12,2) NOT NULL,
    "rata_1_scadenta" DATE NOT NULL,
    "rata_2" DECIMAL(12,2) NOT NULL,
    "rata_2_scadenta" DATE NOT NULL,
    "suma_platita" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "suma_penalitati" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'calculat',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impozite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plati" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "suma" DECIMAL(12,2) NOT NULL,
    "data_plata" DATE NOT NULL,
    "modalitate" VARCHAR(30) NOT NULL,
    "nr_chitanta" VARCHAR(50),
    "nr_document" VARCHAR(50),
    "ghiseul_ro_ref" VARCHAR(100),
    "distribuit" BOOLEAN NOT NULL DEFAULT false,
    "nota" TEXT,
    "inregistrat_de" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plati_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plati_distributie" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plata_id" UUID NOT NULL,
    "impozit_id" UUID NOT NULL,
    "suma_debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "suma_penalitati" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plati_distributie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documente" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contribuabil_id" UUID,
    "tip" VARCHAR(50) NOT NULL,
    "numar_document" VARCHAR(50) NOT NULL,
    "data_document" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "template_id" VARCHAR(100),
    "data_json" JSONB NOT NULL,
    "file_url" VARCHAR(500),
    "file_size_bytes" BIGINT,
    "semnat" BOOLEAN NOT NULL DEFAULT false,
    "semnat_de" UUID,
    "semnat_la" TIMESTAMPTZ,
    "impozit_id" UUID,
    "somatie_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'generat',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "somatii" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "tip" VARCHAR(30) NOT NULL,
    "numar" VARCHAR(50) NOT NULL,
    "data_emitere" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suma_debit" DECIMAL(12,2) NOT NULL,
    "suma_penalitati" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "suma_totala" DECIMAL(12,2) NOT NULL,
    "termen_plata" DATE NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'emis',
    "data_comunicare" DATE,
    "modalitate_comunicare" VARCHAR(30),
    "confirmare_primire" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "somatii_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "somatii_impozite" (
    "somatie_id" UUID NOT NULL,
    "impozit_id" UUID NOT NULL,

    CONSTRAINT "somatii_impozite_pkey" PRIMARY KEY ("somatie_id","impozit_id")
);

-- CreateTable
CREATE TABLE "consimtaminte" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "canal" VARCHAR(20) NOT NULL,
    "consimtamant" BOOLEAN NOT NULL DEFAULT false,
    "data_acord" TIMESTAMPTZ,
    "data_retragere" TIMESTAMPTZ,
    "ip_address" INET,
    "sursa" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consimtaminte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalitati" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "impozit_id" UUID NOT NULL,
    "data_calcul" DATE NOT NULL,
    "suma_restanta" DECIMAL(12,2) NOT NULL,
    "rata_penalizare" DECIMAL(8,6) NOT NULL,
    "suma_penalizare" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalitati_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proprietati_detinatori" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "proprietate_type" VARCHAR(20) NOT NULL,
    "proprietate_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "cota_parte" DECIMAL(5,2) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "tip_act" VARCHAR(50),
    "nr_act" VARCHAR(50),
    "data_act" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proprietati_detinatori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "rollback_at" TIMESTAMPTZ,
    "rollback_by" UUID,
    "error_log" JSONB NOT NULL DEFAULT '[]',
    "imported_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tip" VARCHAR(30) NOT NULL,
    "parametri" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "file_url" VARCHAR(500),
    "file_size_bytes" BIGINT,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "requested_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patrimven_code_mappings" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "internal_code" VARCHAR(50) NOT NULL,
    "patrimven_code" VARCHAR(50) NOT NULL,
    "description_ro" VARCHAR(255),

    CONSTRAINT "patrimven_code_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citizen_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(50),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "roeid_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" VARCHAR(255),
    "verification_expires" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "limba_preferata" VARCHAR(2) NOT NULL DEFAULT 'ro',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "citizen_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citizen_contribuabil_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "citizen_user_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "link_type" VARCHAR(20) NOT NULL DEFAULT 'owner',
    "verified_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citizen_contribuabil_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "citizen_user_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "tip_certificat" VARCHAR(50) NOT NULL,
    "scop" VARCHAR(255),
    "nr_exemplare" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "processed_at" TIMESTAMPTZ,
    "rejected_reason" TEXT,
    "document_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificari" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contribuabil_id" UUID,
    "citizen_user_id" UUID,
    "recipient_email" VARCHAR(255),
    "canal" VARCHAR(20) NOT NULL,
    "template" VARCHAR(50) NOT NULL,
    "limba" VARCHAR(2) NOT NULL DEFAULT 'ro',
    "subject" VARCHAR(500),
    "body_html" TEXT,
    "body_text" TEXT,
    "data_json" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "external_id" VARCHAR(255),
    "trigger_event" VARCHAR(50),
    "trigger_entity_type" VARCHAR(50),
    "trigger_entity_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "citizen_user_id" UUID NOT NULL,
    "contribuabil_id" UUID NOT NULL,
    "suma" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'initiated',
    "modalitate" VARCHAR(30) NOT NULL DEFAULT 'ghiseul_ro',
    "gateway_ref" VARCHAR(255),
    "gateway_response" JSONB,
    "selected_debts" JSONB NOT NULL DEFAULT '[]',
    "plata_id" UUID,
    "initiated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "online_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "citizen_user_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "subject" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "replied_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_codes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name_ro" VARCHAR(255) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "parent_code" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenant_users_tenant_id_idx" ON "tenant_users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenant_id_email_key" ON "tenant_users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "zone_fiscale_tenant_id_zona_hcl_decision_id_key" ON "zone_fiscale"("tenant_id", "zona", "hcl_decision_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_type_registry_code_key" ON "tax_type_registry"("code");

-- CreateIndex
CREATE INDEX "contribuabili_tenant_id_cnp_hash_idx" ON "contribuabili"("tenant_id", "cnp_hash");

-- CreateIndex
CREATE INDEX "contribuabili_tenant_id_cui_idx" ON "contribuabili"("tenant_id", "cui");

-- CreateIndex
CREATE INDEX "contribuabili_tenant_id_nume_prenume_idx" ON "contribuabili"("tenant_id", "nume", "prenume");

-- CreateIndex
CREATE INDEX "proprietati_cladiri_tenant_id_contribuabil_id_idx" ON "proprietati_cladiri"("tenant_id", "contribuabil_id");

-- CreateIndex
CREATE INDEX "proprietati_cladiri_tenant_id_zona_destinatie_idx" ON "proprietati_cladiri"("tenant_id", "zona", "destinatie");

-- CreateIndex
CREATE INDEX "proprietati_terenuri_tenant_id_contribuabil_id_idx" ON "proprietati_terenuri"("tenant_id", "contribuabil_id");

-- CreateIndex
CREATE INDEX "proprietati_vehicule_tenant_id_contribuabil_id_idx" ON "proprietati_vehicule"("tenant_id", "contribuabil_id");

-- CreateIndex
CREATE INDEX "proprietati_vehicule_tenant_id_numar_inmatriculare_idx" ON "proprietati_vehicule"("tenant_id", "numar_inmatriculare");

-- CreateIndex
CREATE INDEX "hcl_decisions_tenant_id_fiscal_year_status_idx" ON "hcl_decisions"("tenant_id", "fiscal_year", "status");

-- CreateIndex
CREATE INDEX "tax_rate_tables_tenant_id_hcl_decision_id_tax_type_category_idx" ON "tax_rate_tables"("tenant_id", "hcl_decision_id", "tax_type", "category", "zona");

-- CreateIndex
CREATE INDEX "scutiri_contribuabil_tenant_id_contribuabil_id_fiscal_year_idx" ON "scutiri_contribuabil"("tenant_id", "contribuabil_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "impozite_tenant_id_contribuabil_id_fiscal_year_idx" ON "impozite"("tenant_id", "contribuabil_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "impozite_tenant_id_tax_type_id_fiscal_year_idx" ON "impozite"("tenant_id", "tax_type_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "plati_tenant_id_contribuabil_id_data_plata_idx" ON "plati"("tenant_id", "contribuabil_id", "data_plata");

-- CreateIndex
CREATE INDEX "plati_tenant_id_data_plata_idx" ON "plati"("tenant_id", "data_plata");

-- CreateIndex
CREATE INDEX "plati_distributie_tenant_id_plata_id_idx" ON "plati_distributie"("tenant_id", "plata_id");

-- CreateIndex
CREATE INDEX "plati_distributie_tenant_id_impozit_id_idx" ON "plati_distributie"("tenant_id", "impozit_id");

-- CreateIndex
CREATE INDEX "documente_tenant_id_contribuabil_id_tip_idx" ON "documente"("tenant_id", "contribuabil_id", "tip");

-- CreateIndex
CREATE INDEX "documente_tenant_id_numar_document_idx" ON "documente"("tenant_id", "numar_document");

-- CreateIndex
CREATE INDEX "somatii_tenant_id_contribuabil_id_idx" ON "somatii"("tenant_id", "contribuabil_id");

-- CreateIndex
CREATE INDEX "somatii_tenant_id_status_termen_plata_idx" ON "somatii"("tenant_id", "status", "termen_plata");

-- CreateIndex
CREATE UNIQUE INDEX "consimtaminte_tenant_id_contribuabil_id_canal_key" ON "consimtaminte"("tenant_id", "contribuabil_id", "canal");

-- CreateIndex
CREATE INDEX "penalitati_tenant_id_impozit_id_data_calcul_idx" ON "penalitati"("tenant_id", "impozit_id", "data_calcul");

-- CreateIndex
CREATE UNIQUE INDEX "penalitati_tenant_id_impozit_id_data_calcul_key" ON "penalitati"("tenant_id", "impozit_id", "data_calcul");

-- CreateIndex
CREATE INDEX "proprietati_detinatori_proprietate_type_proprietate_id_idx" ON "proprietati_detinatori"("proprietate_type", "proprietate_id");

-- CreateIndex
CREATE INDEX "proprietati_detinatori_tenant_id_contribuabil_id_idx" ON "proprietati_detinatori"("tenant_id", "contribuabil_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_created_at_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_user_id_created_at_idx" ON "audit_logs"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "patrimven_code_mappings_entity_type_internal_code_key" ON "patrimven_code_mappings"("entity_type", "internal_code");

-- CreateIndex
CREATE INDEX "citizen_users_tenant_id_idx" ON "citizen_users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "citizen_users_tenant_id_email_key" ON "citizen_users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "citizen_contribuabil_links_tenant_id_citizen_user_id_idx" ON "citizen_contribuabil_links"("tenant_id", "citizen_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "citizen_contribuabil_links_citizen_user_id_contribuabil_id_key" ON "citizen_contribuabil_links"("citizen_user_id", "contribuabil_id");

-- CreateIndex
CREATE INDEX "certificate_requests_tenant_id_citizen_user_id_status_idx" ON "certificate_requests"("tenant_id", "citizen_user_id", "status");

-- CreateIndex
CREATE INDEX "notificari_tenant_id_contribuabil_id_created_at_idx" ON "notificari"("tenant_id", "contribuabil_id", "created_at");

-- CreateIndex
CREATE INDEX "notificari_tenant_id_status_created_at_idx" ON "notificari"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "online_payments_tenant_id_citizen_user_id_status_idx" ON "online_payments"("tenant_id", "citizen_user_id", "status");

-- CreateIndex
CREATE INDEX "online_payments_gateway_ref_idx" ON "online_payments"("gateway_ref");

-- CreateIndex
CREATE INDEX "contact_messages_tenant_id_status_created_at_idx" ON "contact_messages"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "budget_codes_code_key" ON "budget_codes"("code");

-- CreateIndex
CREATE INDEX "budget_codes_category_is_active_idx" ON "budget_codes"("category", "is_active");

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adrese" ADD CONSTRAINT "adrese_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_fiscale" ADD CONSTRAINT "zone_fiscale_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_fiscale" ADD CONSTRAINT "zone_fiscale_hcl_decision_id_fkey" FOREIGN KEY ("hcl_decision_id") REFERENCES "hcl_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribuabili" ADD CONSTRAINT "contribuabili_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribuabili" ADD CONSTRAINT "contribuabili_adresa_domiciliu_id_fkey" FOREIGN KEY ("adresa_domiciliu_id") REFERENCES "adrese"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribuabili" ADD CONSTRAINT "contribuabili_adresa_corespondenta_id_fkey" FOREIGN KEY ("adresa_corespondenta_id") REFERENCES "adrese"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietati_cladiri" ADD CONSTRAINT "proprietati_cladiri_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietati_cladiri" ADD CONSTRAINT "proprietati_cladiri_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietati_cladiri" ADD CONSTRAINT "proprietati_cladiri_adresa_id_fkey" FOREIGN KEY ("adresa_id") REFERENCES "adrese"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietati_terenuri" ADD CONSTRAINT "proprietati_terenuri_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietati_terenuri" ADD CONSTRAINT "proprietati_terenuri_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietati_terenuri" ADD CONSTRAINT "proprietati_terenuri_adresa_id_fkey" FOREIGN KEY ("adresa_id") REFERENCES "adrese"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietati_vehicule" ADD CONSTRAINT "proprietati_vehicule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietati_vehicule" ADD CONSTRAINT "proprietati_vehicule_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hcl_decisions" ADD CONSTRAINT "hcl_decisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rate_tables" ADD CONSTRAINT "tax_rate_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rate_tables" ADD CONSTRAINT "tax_rate_tables_hcl_decision_id_fkey" FOREIGN KEY ("hcl_decision_id") REFERENCES "hcl_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scutiri_reguli" ADD CONSTRAINT "scutiri_reguli_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scutiri_contribuabil" ADD CONSTRAINT "scutiri_contribuabil_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scutiri_contribuabil" ADD CONSTRAINT "scutiri_contribuabil_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scutiri_contribuabil" ADD CONSTRAINT "scutiri_contribuabil_scutire_regula_id_fkey" FOREIGN KEY ("scutire_regula_id") REFERENCES "scutiri_reguli"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scutiri_contribuabil" ADD CONSTRAINT "scutiri_contribuabil_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impozite" ADD CONSTRAINT "impozite_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impozite" ADD CONSTRAINT "impozite_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impozite" ADD CONSTRAINT "impozite_tax_type_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "tax_type_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impozite" ADD CONSTRAINT "impozite_hcl_decision_id_fkey" FOREIGN KEY ("hcl_decision_id") REFERENCES "hcl_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impozite" ADD CONSTRAINT "impozite_rate_table_id_fkey" FOREIGN KEY ("rate_table_id") REFERENCES "tax_rate_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plati" ADD CONSTRAINT "plati_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plati" ADD CONSTRAINT "plati_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plati" ADD CONSTRAINT "plati_inregistrat_de_fkey" FOREIGN KEY ("inregistrat_de") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plati_distributie" ADD CONSTRAINT "plati_distributie_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plati_distributie" ADD CONSTRAINT "plati_distributie_plata_id_fkey" FOREIGN KEY ("plata_id") REFERENCES "plati"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plati_distributie" ADD CONSTRAINT "plati_distributie_impozit_id_fkey" FOREIGN KEY ("impozit_id") REFERENCES "impozite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documente" ADD CONSTRAINT "documente_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documente" ADD CONSTRAINT "documente_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documente" ADD CONSTRAINT "documente_semnat_de_fkey" FOREIGN KEY ("semnat_de") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documente" ADD CONSTRAINT "documente_impozit_id_fkey" FOREIGN KEY ("impozit_id") REFERENCES "impozite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documente" ADD CONSTRAINT "documente_somatie_id_fkey" FOREIGN KEY ("somatie_id") REFERENCES "somatii"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "somatii" ADD CONSTRAINT "somatii_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "somatii" ADD CONSTRAINT "somatii_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "somatii_impozite" ADD CONSTRAINT "somatii_impozite_somatie_id_fkey" FOREIGN KEY ("somatie_id") REFERENCES "somatii"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "somatii_impozite" ADD CONSTRAINT "somatii_impozite_impozit_id_fkey" FOREIGN KEY ("impozit_id") REFERENCES "impozite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consimtaminte" ADD CONSTRAINT "consimtaminte_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consimtaminte" ADD CONSTRAINT "consimtaminte_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalitati" ADD CONSTRAINT "penalitati_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalitati" ADD CONSTRAINT "penalitati_impozit_id_fkey" FOREIGN KEY ("impozit_id") REFERENCES "impozite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietati_detinatori" ADD CONSTRAINT "proprietati_detinatori_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proprietati_detinatori" ADD CONSTRAINT "proprietati_detinatori_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_rollback_by_fkey" FOREIGN KEY ("rollback_by") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizen_users" ADD CONSTRAINT "citizen_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizen_contribuabil_links" ADD CONSTRAINT "citizen_contribuabil_links_citizen_user_id_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizen_contribuabil_links" ADD CONSTRAINT "citizen_contribuabil_links_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_citizen_user_id_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_contribuabil_id_fkey" FOREIGN KEY ("contribuabil_id") REFERENCES "contribuabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificari" ADD CONSTRAINT "notificari_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_citizen_user_id_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_citizen_user_id_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
