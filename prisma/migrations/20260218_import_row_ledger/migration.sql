CREATE TABLE "import_row_ledgers" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "row_hash" VARCHAR(64) NOT NULL,
  "entity_record_id" UUID,
  "status" VARCHAR(20) NOT NULL DEFAULT 'imported',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "rolled_back_at" TIMESTAMPTZ,
  CONSTRAINT "import_row_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_row_ledgers_tenant_id_entity_type_row_hash_key"
  ON "import_row_ledgers"("tenant_id", "entity_type", "row_hash");

CREATE INDEX "import_row_ledgers_tenant_id_batch_id_idx"
  ON "import_row_ledgers"("tenant_id", "batch_id");

CREATE INDEX "import_row_ledgers_tenant_id_entity_type_status_idx"
  ON "import_row_ledgers"("tenant_id", "entity_type", "status");

ALTER TABLE "import_row_ledgers"
  ADD CONSTRAINT "import_row_ledgers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_row_ledgers"
  ADD CONSTRAINT "import_row_ledgers_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
